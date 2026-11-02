
const {
  sequelize,
  TbCaptureState,
  TbHrvRmssd,
  TbHrvBaselinetetap,
} = require("../models");

const ALPHA = 0.2;
const STATE_ID = 1;
const GROUPS_PER_PHASE = 12;

async function getPhaseSummary(phase, transaction) {
  const rows = await TbHrvRmssd.findAll({
    where: {
      HrvStatusFase: `Fase ${phase}`,
    },
    order: [["HrvGroup", "ASC"]],
    transaction,
  });

  if (rows.length < GROUPS_PER_PHASE) {
    console.warn(
      `[HRV Baseline] Fase ${phase} belum lengkap: ` +
        `${rows.length}/${GROUPS_PER_PHASE} grup tersedia.`
    );
    return null;
  }

  const uniqueGroups = new Set(
    rows.map((row) => Number(row.HrvGroup))
  );

  const expectedGroups = Array.from(
    { length: GROUPS_PER_PHASE },
    (_, index) => index + 1
  );

  const hasAllGroups =
    uniqueGroups.size === GROUPS_PER_PHASE &&
    expectedGroups.every((group) => uniqueGroups.has(group));

  if (!hasAllGroups) {
    console.warn(
      `[HRV Baseline] Fase ${phase} belum memiliki grup 1–12 secara lengkap.`
    );
    return null;
  }

  const rmssdValues = rows.map((row) => Number(row.HrvNilaiRmssd));
  const sdValues = rows.map((row) => Number(row.HrvNilaiSd));

  if (
    rmssdValues.some(
      (value) => !Number.isFinite(value) || value < 0
    ) ||
    sdValues.some(
      (value) => !Number.isFinite(value) || value < 0
    )
  ) {
    console.warn(
      `[HRV Baseline] Fase ${phase} memiliki nilai RMSSD/SD tidak valid.`
    );
    return null;
  }

  return {
    rows,
    rmssd:
      rmssdValues.reduce((sum, value) => sum + value, 0) /
      rmssdValues.length,
    sd:
      sdValues.reduce((sum, value) => sum + value, 0) /
      sdValues.length,
  };
}

async function getActiveBaseline(transaction) {
  return TbHrvBaselinetetap.findOne({
    where: {
      HrvStatusAktifBaseline: true,
      Deleted: false,
    },
    order: [["IDHrvBt", "DESC"]],
    transaction,
  });
}

async function saveBaseline(rmssd, sd, transaction) {
  // Nonaktifkan baseline sebelumnya.
  await TbHrvBaselinetetap.update(
    {
      HrvStatusAktifBaseline: false,
    },
    {
      where: {
        HrvStatusAktifBaseline: true,
        Deleted: false,
      },
      transaction,
    }
  );

  // Simpan baseline baru sebagai baseline aktif.
  return TbHrvBaselinetetap.create(
    {
      HrvEwmaRmssd: rmssd,
      HrvEwmaSd: sd,
      HrvStatusAktifBaseline: true,
      Datetime: new Date(),
      HrvFaseProses: "action",
      Deleted: false,
    },
    { transaction }
  );
}

async function markPhaseUsed(summary, transaction) {
  const ids = summary.rows.map((row) => row.IDHrvRmssd);

  if (ids.length === 0) return;

  await TbHrvRmssd.update(
    {
      HrvisEwma: "yes",
    },
    {
      where: {
        IDHrvRmssd: ids,
      },
      transaction,
    }
  );
}

async function processCompletedHrvBaselinePhases(currentPhase) {
  // Fase 1 dan 2 baru dapat dievaluasi setelah Fase 3 dimulai.
  if (currentPhase < 3) return;

  await sequelize.transaction(async (transaction) => {
    const state = await TbCaptureState.findByPk(STATE_ID, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!state) {
      throw new Error(
        "[HRV Baseline] TbCaptureState tidak ditemukan."
      );
    }

    let processedPhase = Number(
      state.LastHrvBaselinePhaseProcessed || 0
    );

    const baseline = await getActiveBaseline(transaction);

    if (processedPhase === 0 && baseline) {
      throw new Error(
        "[HRV Baseline] Baseline sudah ada, tetapi marker fase masih 0. " +
          "Periksa konsistensi data."
      );
    }

    if (processedPhase > 0 && !baseline) {
      throw new Error(
        "[HRV Baseline] Marker menunjukkan baseline sudah diproses, " +
          "tetapi baseline aktif tidak ditemukan."
      );
    }

    // ------------------------------------------------------------
    // INISIALISASI: BASELINE DARI FASE 1 DAN FASE 2
    // ------------------------------------------------------------
    if (processedPhase === 0) {
      const phase1 = await getPhaseSummary(1, transaction);
      const phase2 = await getPhaseSummary(2, transaction);

      // Jangan membuat baseline jika salah satu fase belum lengkap.
      if (!phase1 || !phase2) return;

      const initialRmssd = (phase1.rmssd + phase2.rmssd) / 2;
      const initialSd = (phase1.sd + phase2.sd) / 2;

      await saveBaseline(
        initialRmssd,
        initialSd,
        transaction
      );

      await markPhaseUsed(phase1, transaction);
      await markPhaseUsed(phase2, transaction);

      processedPhase = 2;

      await state.update(
        {
          LastHrvBaselinePhaseProcessed: processedPhase,
        },
        { transaction }
      );

      console.log(
        `[HRV Baseline] Baseline awal dibuat dari Fase 1 dan 2. ` +
          `RMSSD=${initialRmssd.toFixed(2)} ms, ` +
          `SD=${initialSd.toFixed(2)} ms`
      );
    }

    // ------------------------------------------------------------
    // PEMBARUAN BASELINE EWMA UNTUK FASE BERIKUTNYA
    // ------------------------------------------------------------
    while (processedPhase < currentPhase - 1) {
      const nextPhase = processedPhase + 1;

      const summary = await getPhaseSummary(
        nextPhase,
        transaction
      );

      // Jangan melompati fase yang belum lengkap.
      if (!summary) break;

      const latestBaseline = await getActiveBaseline(transaction);

      if (
        !latestBaseline ||
        latestBaseline.HrvEwmaRmssd === null ||
        latestBaseline.HrvEwmaSd === null ||
        !Number.isFinite(Number(latestBaseline.HrvEwmaRmssd)) ||
        !Number.isFinite(Number(latestBaseline.HrvEwmaSd))
      ) {
        throw new Error(
          "[HRV Baseline] Nilai baseline aktif tidak valid."
        );
      }

      const oldRmssd = Number(
        latestBaseline.HrvEwmaRmssd
      );

      const oldSd = Number(
        latestBaseline.HrvEwmaSd
      );

      const newRmssd =
        ALPHA * summary.rmssd +
        (1 - ALPHA) * oldRmssd;

      const newSd =
        ALPHA * summary.sd +
        (1 - ALPHA) * oldSd;

      await saveBaseline(
        newRmssd,
        newSd,
        transaction
      );

      await markPhaseUsed(summary, transaction);

      processedPhase = nextPhase;

      await state.update(
        {
          LastHrvBaselinePhaseProcessed: processedPhase,
        },
        { transaction }
      );

      console.log(
        `[HRV Baseline] Fase ${nextPhase} diproses. ` +
          `EWMA RMSSD=${newRmssd.toFixed(2)} ms, ` +
          `EWMA SD=${newSd.toFixed(2)} ms`
      );
    }
  });
}

module.exports = {
  processCompletedHrvBaselinePhases,
};
