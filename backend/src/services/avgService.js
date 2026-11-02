
const {
  sequelize,
  TbHeartrate,
  TbHrKv,
  TbHrAvg,
  TbEda,
  TbEdaKv,
  TbEdaAvg,
} = require("../models");

// ============================================================
// HYPOGUARD - AVERAGE SERVICE
//
// HR:
//   TbHrKv -> pilih HrGroup dengan HrNilaiKv minimum per fase
//   TbHeartrate -> hitung rata-rata Hr pada group terpilih
//   TbHrAvg -> simpan hasil
//
// EDA:
//   TbEdaKv -> pilih EdaGroup dengan EdaNilaiKv minimum per fase
//   TbEda -> hitung rata-rata Eda pada group terpilih
//   TbEdaAvg -> simpan hasil
//
// EWMA belum dihitung. Status awal: pending.
// ============================================================

function calculateMean(values) {
  const numbers = values.map(Number).filter(Number.isFinite);

  if (numbers.length === 0) {
    return null;
  }

  return numbers.reduce((sum, value) => sum + value, 0) /
    numbers.length;
}

// ------------------------------------------------------------
// HR: pilih group dengan KV terendah pada setiap fase
// ------------------------------------------------------------
async function calculateHrAvg(transaction) {
  const kvRows = await TbHrKv.findAll({
    attributes: [
      "HrGroup",
      "HrStatusFase",
      "HrNilaiKv",
    ],
    order: [["HrStatusFase", "ASC"]],
    transaction,
  });

  const phaseMinimums = new Map();

  for (const row of kvRows) {
    const phase = String(row.HrStatusFase || "").trim();
    const group = Number(row.HrGroup);
    const kv = Number(row.HrNilaiKv);

    if (
      !phase ||
      !Number.isFinite(group) ||
      !Number.isFinite(kv)
    ) {
      continue;
    }

    const current = phaseMinimums.get(phase);

    if (!current || kv < current.kv) {
      phaseMinimums.set(phase, { group, kv });
    }
  }

  let processed = 0;

  for (const [phase, selected] of phaseMinimums) {
    // Ambil data mentah hanya dari fase dan group terpilih.
    const sourceRows = await TbHeartrate.findAll({
      attributes: ["Hr"],
      where: {
        HrGroup: selected.group,
        HrStatusFase: phase,
      },
      transaction,
    });

    const mean = calculateMean(sourceRows.map((row) => row.Hr));

    if (mean === null) {
      console.warn(
        `[AVG-HR] Tidak ada data mentah untuk ${phase}, ` +
        `Group ${selected.group}.`
      );
      continue;
    }

    const where = { HrStatusFase: phase };

    const existing = await TbHrAvg.findOne({
      where,
      transaction,
    });

    const data = {
      HrStatusFase: phase,
      HrGroup: selected.group,
      HrNilaiAvg: mean,
      HrisEwma: existing?.HrisEwma || "pending",
    };

    if (existing) {
      await existing.update(data, { transaction });
    } else {
      await TbHrAvg.create(data, { transaction });
    }

    processed++;

    console.log(
      `[AVG-HR] ${phase}: Group=${selected.group}, ` +
      `KV minimum=${selected.kv}, ` +
      `Avg=${mean.toFixed(4)}, EWMA=pending`
    );
  }

  return processed;
}

// ------------------------------------------------------------
// EDA: pilih group dengan KV terendah pada setiap fase
// ------------------------------------------------------------
async function calculateEdaAvg(transaction) {
  const kvRows = await TbEdaKv.findAll({
    attributes: [
      "EdaGroup",
      "EdaStatusFase",
      "EdaNilaiKv",
    ],
    order: [["EdaStatusFase", "ASC"]],
    transaction,
  });

  const phaseMinimums = new Map();

  for (const row of kvRows) {
    const phase = String(row.EdaStatusFase || "").trim();
    const group = Number(row.EdaGroup);
    const kv = Number(row.EdaNilaiKv);

    if (
      !phase ||
      !Number.isFinite(group) ||
      !Number.isFinite(kv)
    ) {
      continue;
    }

    const current = phaseMinimums.get(phase);

    if (!current || kv < current.kv) {
      phaseMinimums.set(phase, { group, kv });
    }
  }

  let processed = 0;

  for (const [phase, selected] of phaseMinimums) {
    const sourceRows = await TbEda.findAll({
      attributes: ["Eda"],
      where: {
        EdaGroup: selected.group,
        EdaStatusFase: phase,
      },
      transaction,
    });

    const mean = calculateMean(sourceRows.map((row) => row.Eda));

    if (mean === null) {
      console.warn(
        `[AVG-EDA] Tidak ada data mentah untuk ${phase}, ` +
        `Group ${selected.group}.`
      );
      continue;
    }

    const where = { EdaStatusFase: phase };

    const existing = await TbEdaAvg.findOne({
      where,
      transaction,
    });

    const data = {
      EdaStatusFase: phase,
      EdaGroup: selected.group,
      EdaNilaiAvg: mean,
      EdaisEwma: existing?.EdaisEwma || "pending",
    };

    if (existing) {
      await existing.update(data, { transaction });
    } else {
      await TbEdaAvg.create(data, { transaction });
    }

    processed++;

    console.log(
      `[AVG-EDA] ${phase}: Group=${selected.group}, ` +
      `KV minimum=${selected.kv}, ` +
      `Avg=${mean.toFixed(4)}, EWMA=pending`
    );
  }

  return processed;
}

// ------------------------------------------------------------
// Hitung HR dan EDA dalam satu transaksi
// Fungsi ini dapat dipanggil manual untuk mengolah data lama.
// ------------------------------------------------------------
async function calculateAllAvg() {
  return sequelize.transaction(async (transaction) => {
    const hrProcessed = await calculateHrAvg(transaction);
    const edaProcessed = await calculateEdaAvg(transaction);

    const result = {
      hrPhasesProcessed: hrProcessed,
      edaPhasesProcessed: edaProcessed,
    };

    console.log("[AVG] Perhitungan selesai:", result);

    return result;
  });
}


async function processCompletedHrAvgPhases(currentPhase) {
  if (!Number.isInteger(currentPhase) || currentPhase < 2) {
    return;
  }

  return sequelize.transaction(async (transaction) => {
    const state = await require("../models").TbCaptureState.findByPk(1, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!state) {
      throw new Error("TbCaptureState ID 1 tidak ditemukan.");
    }

    let lastProcessed = Number(
      state.LastHrAvgPhaseProcessed || 0
    );

    while (lastProcessed < currentPhase - 1) {
      const phaseNumber = lastProcessed + 1;
      const phase = `Fase ${phaseNumber}`;

      const kvRows = await TbHrKv.findAll({
        attributes: ["HrGroup", "HrStatusFase", "HrNilaiKv"],
        where: { HrStatusFase: phase },
        order: [["HrNilaiKv", "ASC"]],
        transaction,
      });

      if (kvRows.length === 0) {
        console.warn(
          `[AVG-HR] Menunggu hasil KV untuk ${phase}.`
        );
        break;
      }

      const candidates = kvRows.filter((row) =>
        Number.isFinite(Number(row.HrNilaiKv))
      );

      if (candidates.length === 0) {
        console.warn(
          `[AVG-HR] Tidak ada nilai KV valid untuk ${phase}.`
        );
        break;
      }

      // Group dengan KV paling rendah.
      const selected = candidates[0];
      const selectedGroup = Number(selected.HrGroup);

      const sourceRows = await TbHeartrate.findAll({
        attributes: ["Hr"],
        where: {
          HrGroup: selectedGroup,
          HrStatusFase: phase,
        },
        transaction,
      });

      const mean = calculateMean(
        sourceRows.map((row) => row.Hr)
      );

      if (mean === null) {
        console.warn(
          `[AVG-HR] Menunggu data mentah ${phase}, ` +
          `Group ${selectedGroup}.`
        );
        break;
      }

      const existing = await TbHrAvg.findOne({
        where: { HrStatusFase: phase },
        transaction,
      });

      const data = {
        HrStatusFase: phase,
        HrGroup: selectedGroup,
        HrNilaiAvg: mean,
        HrisEwma: existing?.HrisEwma || "pending",
      };

      if (existing) {
        await existing.update(data, { transaction });
      } else {
        await TbHrAvg.create(data, { transaction });
      }

      lastProcessed = phaseNumber;

      await state.update(
        { LastHrAvgPhaseProcessed: lastProcessed },
        { transaction }
      );

      console.log(
        `[AVG-HR] ${phase} selesai. ` +
        `Group=${selectedGroup}, Avg=${mean.toFixed(4)}`
      );
    }
  });
}

async function processCompletedEdaAvgPhases(currentPhase) {
  if (!Number.isInteger(currentPhase) || currentPhase < 2) {
    return;
  }

  return sequelize.transaction(async (transaction) => {
    const state = await require("../models").TbCaptureState.findByPk(1, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!state) {
      throw new Error("TbCaptureState ID 1 tidak ditemukan.");
    }

    let lastProcessed = Number(
      state.LastEdaAvgPhaseProcessed || 0
    );

    while (lastProcessed < currentPhase - 1) {
      const phaseNumber = lastProcessed + 1;
      const phase = `Fase ${phaseNumber}`;

      const kvRows = await TbEdaKv.findAll({
        attributes: ["EdaGroup", "EdaStatusFase", "EdaNilaiKv"],
        where: { EdaStatusFase: phase },
        order: [["EdaNilaiKv", "ASC"]],
        transaction,
      });

      if (kvRows.length === 0) {
        console.warn(
          `[AVG-EDA] Menunggu hasil KV untuk ${phase}.`
        );
        break;
      }

      const candidates = kvRows.filter((row) =>
        Number.isFinite(Number(row.EdaNilaiKv))
      );

      if (candidates.length === 0) {
        console.warn(
          `[AVG-EDA] Tidak ada nilai KV valid untuk ${phase}.`
        );
        break;
      }

      const selected = candidates[0];
      const selectedGroup = Number(selected.EdaGroup);

      const sourceRows = await TbEda.findAll({
        attributes: ["Eda"],
        where: {
          EdaGroup: selectedGroup,
          EdaStatusFase: phase,
        },
        transaction,
      });

      const mean = calculateMean(
        sourceRows.map((row) => row.Eda)
      );

      if (mean === null) {
        console.warn(
          `[AVG-EDA] Menunggu data mentah ${phase}, ` +
          `Group ${selectedGroup}.`
        );
        break;
      }

      const existing = await TbEdaAvg.findOne({
        where: { EdaStatusFase: phase },
        transaction,
      });

      const data = {
        EdaStatusFase: phase,
        EdaGroup: selectedGroup,
        EdaNilaiAvg: mean,
        EdaisEwma: existing?.EdaisEwma || "pending",
      };

      if (existing) {
        await existing.update(data, { transaction });
      } else {
        await TbEdaAvg.create(data, { transaction });
      }

      lastProcessed = phaseNumber;

      await state.update(
        { LastEdaAvgPhaseProcessed: lastProcessed },
        { transaction }
      );

      console.log(
        `[AVG-EDA] ${phase} selesai. ` +
        `Group=${selectedGroup}, Avg=${mean.toFixed(4)}`
      );
    }
  });
}


module.exports = {
  calculateMean,
  calculateHrAvg,
  calculateEdaAvg,
  calculateAllAvg,
  processCompletedHrAvgPhases,
  processCompletedEdaAvgPhases,
};
