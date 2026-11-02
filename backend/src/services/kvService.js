
const {
  sequelize,
  TbCaptureState,
  TbHeartrate,
  TbHrKv,
  TbEda,
  TbEdaKv,
} = require("../models");

// ============================================================
// HYPOGUARD - KV & SD PER FASE
//
// HR  : TbHeartrate -> TbHrKv
// EDA : TbEda       -> TbEdaKv
//
// KV = (SD / |Mean|) * 100
// SD = sample standard deviation (n - 1)
//
// Fase N hanya dihitung ketika data fase N+1 mulai diterima.
// ============================================================

function calculateKvAndSd(values) {
  const numbers = values.map(Number).filter(Number.isFinite);

  if (numbers.length < 2) {
    return null;
  }

  const mean =
    numbers.reduce((sum, value) => sum + value, 0) /
    numbers.length;

  const squaredDifferences = numbers.reduce(
    (sum, value) => sum + Math.pow(value - mean, 2),
    0
  );

  const sd = Math.sqrt(
    squaredDifferences / (numbers.length - 1)
  );

  const kv =
    mean === 0
      ? null
      : (sd / Math.abs(mean)) * 100;

  return {
    kv,
    sd,
    mean,
    count: numbers.length,
  };
}

// ------------------------------------------------------------
// Simpan/perbarui hasil HR berdasarkan Group + Fase
// ------------------------------------------------------------
async function saveHrKv(group, phaseName, values, transaction) {
  const result = calculateKvAndSd(values);

  if (!result) {
    console.log(
      `[KV-HR] ${phaseName}, Group ${group}: data kurang dari 2.`
    );
    return;
  }

  const where = {
    HrGroup: group,
    HrStatusFase: phaseName,
  };

  const existing = await TbHrKv.findOne({
    where,
    transaction,
  });

  const data = {
    ...where,
    HrNilaiKv: result.kv,
    HrNilaiSd: result.sd,
  };

  if (existing) {
    await existing.update(data, { transaction });
  } else {
    await TbHrKv.create(data, { transaction });
  }

  console.log(
    `[KV-HR] ${phaseName}, Group=${group}, N=${result.count}, ` +
    `KV=${result.kv === null ? "NULL" : result.kv.toFixed(4)}, ` +
    `SD=${result.sd.toFixed(4)}`
  );
}

// ------------------------------------------------------------
// Simpan/perbarui hasil EDA berdasarkan Group + Fase
// ------------------------------------------------------------
async function saveEdaKv(group, phaseName, values, transaction) {
  const result = calculateKvAndSd(values);

  if (!result) {
    console.log(
      `[KV-EDA] ${phaseName}, Group ${group}: data kurang dari 2.`
    );
    return;
  }

  const where = {
    EdaGroup: group,
    EdaStatusFase: phaseName,
  };

  const existing = await TbEdaKv.findOne({
    where,
    transaction,
  });

  const data = {
    ...where,
    EdaNilaiKv: result.kv,
    EdaNilaiSd: result.sd,
  };

  if (existing) {
    await existing.update(data, { transaction });
  } else {
    await TbEdaKv.create(data, { transaction });
  }

  console.log(
    `[KV-EDA] ${phaseName}, Group=${group}, N=${result.count}, ` +
    `KV=${result.kv === null ? "NULL" : result.kv.toFixed(4)}, ` +
    `SD=${result.sd.toFixed(4)}`
  );
}

// ------------------------------------------------------------
// Proses fase HR yang telah selesai
// ------------------------------------------------------------
async function processCompletedHrPhases(currentPhase) {
  if (!Number.isInteger(currentPhase) || currentPhase < 1) {
    return;
  }

  return sequelize.transaction(async (transaction) => {
    const state = await TbCaptureState.findByPk(1, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!state) {
      throw new Error("TbCaptureState ID 1 tidak ditemukan.");
    }

    let lastProcessed = Number(
      state.LastHrKvPhaseProcessed || 0
    );

    // Fase aktif tidak dihitung. Hanya fase sebelum currentPhase.
    while (lastProcessed < currentPhase - 1) {
      const phaseToProcess = lastProcessed + 1;
      const phaseName = `Fase ${phaseToProcess}`;

      const rows = await TbHeartrate.findAll({
        attributes: ["Hr", "HrGroup", "HrStatusFase"],
        where: { HrStatusFase: phaseName },
        order: [["HrGroup", "ASC"]],
        transaction,
      });

      const groups = new Map();

      for (const row of rows) {
        const group = Number(row.HrGroup);
        const value = Number(row.Hr);

        if (!Number.isFinite(group) || !Number.isFinite(value)) {
          continue;
        }

        if (!groups.has(group)) {
          groups.set(group, []);
        }

        groups.get(group).push(value);
      }

      for (const [group, values] of groups) {
        await saveHrKv(
          group,
          phaseName,
          values,
          transaction
        );
      }

      // Tandai fase selesai hanya setelah seluruh proses fase ini sukses.
      lastProcessed = phaseToProcess;

      await state.update(
        { LastHrKvPhaseProcessed: lastProcessed },
        { transaction }
      );

      console.log(
        `[KV-HR] Pemrosesan ${phaseName} selesai.`
      );
    }
  });
}

// ------------------------------------------------------------
// Proses fase EDA yang telah selesai
// ------------------------------------------------------------
async function processCompletedEdaPhases(currentPhase) {
  if (!Number.isInteger(currentPhase) || currentPhase < 1) {
    return;
  }

  return sequelize.transaction(async (transaction) => {
    const state = await TbCaptureState.findByPk(1, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!state) {
      throw new Error("TbCaptureState ID 1 tidak ditemukan.");
    }

    let lastProcessed = Number(
      state.LastEdaKvPhaseProcessed || 0
    );

    while (lastProcessed < currentPhase - 1) {
      const phaseToProcess = lastProcessed + 1;
      const phaseName = `Fase ${phaseToProcess}`;

      const rows = await TbEda.findAll({
        attributes: ["Eda", "EdaGroup", "EdaStatusFase"],
        where: { EdaStatusFase: phaseName },
        order: [["EdaGroup", "ASC"]],
        transaction,
      });

      const groups = new Map();

      for (const row of rows) {
        const group = Number(row.EdaGroup);
        const value = Number(row.Eda);

        if (!Number.isFinite(group) || !Number.isFinite(value)) {
          continue;
        }

        if (!groups.has(group)) {
          groups.set(group, []);
        }

        groups.get(group).push(value);
      }

      for (const [group, values] of groups) {
        await saveEdaKv(
          group,
          phaseName,
          values,
          transaction
        );
      }

      lastProcessed = phaseToProcess;

      await state.update(
        { LastEdaKvPhaseProcessed: lastProcessed },
        { transaction }
      );

      console.log(
        `[KV-EDA] Pemrosesan ${phaseName} selesai.`
      );
    }
  });
}

module.exports = {
  calculateKvAndSd,
  processCompletedHrPhases,
  processCompletedEdaPhases,
};
