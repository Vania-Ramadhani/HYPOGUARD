
const {
  sequelize,
  TbCaptureState,
  TbHrAvg,
  TbHrKv,
  TbHrBaselinetetap,
  TbEdaAvg,
  TbEdaKv,
  TbEdaBaselinetetap,
} = require("../models");

const ALPHA = 0.2;

function validNumber(value) {
  return value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value));
}

function calculateMean(values) {
  if (!values.length || !values.every(validNumber)) return null;
  return values.reduce((sum, value) => sum + Number(value), 0) /
    values.length;
}

function nextEwma(previous, current) {
  return ALPHA * Number(current) + (1 - ALPHA) * Number(previous);
}

async function processBaseline(config, currentPhase) {
  if (!Number.isInteger(currentPhase) || currentPhase < 2) return;

  return sequelize.transaction(async (transaction) => {
    const {
      avgModel,
      kvModel,
      baselineModel,
      avgValueField,
      kvSdField,
      ewmaAvgField,
      ewmaSdField,
      activeField,
      phaseProcessField,
      avgProcessedField,
      phaseField,
      groupField,
      idField,
      markerField,
      logPrefix,
    } = config;

    const state = await TbCaptureState.findByPk(1, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!state) {
      throw new Error("[BASELINE] TbCaptureState ID 1 tidak ditemukan.");
    }

    let lastProcessed = Number(state[markerField] || 0);

    async function getAvg(phaseNumber) {
      const phase = `Fase ${phaseNumber}`;

      const row = await avgModel.findOne({
        where: {
          [phaseField]: phase,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!row || !validNumber(row[avgValueField])) {
        console.warn(`${logPrefix} Menunggu Avg valid untuk ${phase}.`);
        return null;
      }

      return row;
    }

    async function getMatchingSd(row) {
      const kv = await kvModel.findOne({
        where: {
          [phaseField]: row[phaseField],
          [groupField]: row[groupField],
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!kv || !validNumber(kv[kvSdField])) {
        console.warn(
          `${logPrefix} Menunggu SD untuk ${row[phaseField]}, ` +
          `Grup ${row[groupField]}.`
        );
        return null;
      }

      return Number(kv[kvSdField]);
    }

    async function getActiveBaseline() {
      return baselineModel.findOne({
        where: {
          [activeField]: true,
          Deleted: false,
        },
        order: [[idField, "DESC"]],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    }

    async function saveBaseline(avgValue, sdValue) {
      await baselineModel.update(
        { [activeField]: false },
        {
          where: { [activeField]: true },
          transaction,
        }
      );

      return baselineModel.create(
        {
          [ewmaAvgField]: avgValue,
          [ewmaSdField]: sdValue,
          [activeField]: true,
          Datetime: new Date(),
          [phaseProcessField]: "action",
          Deleted: false,
        },
        { transaction }
      );
    }

    // Marker dan baseline harus konsisten sebelum melanjutkan.
    let activeBaseline = await getActiveBaseline();

    if ((lastProcessed === 0) !== !activeBaseline) {
      throw new Error(
        `${logPrefix} Marker fase (${lastProcessed}) tidak konsisten ` +
        "dengan baseline aktif. Periksa TbCaptureState dan tabel baseline."
      );
    }

    // Inisialisasi wajib menggunakan Fase 1 dan Fase 2.
    if (lastProcessed === 0) {
      // currentPhase harus lebih besar dari 2 agar Fase 1 dan 2 selesai.
      if (currentPhase < 3) return;

      const phase1 = await getAvg(1);
      if (!phase1) return;

      const sd1 = await getMatchingSd(phase1);
      if (sd1 === null) return;

      const phase2 = await getAvg(2);
      if (!phase2) return;

      const sd2 = await getMatchingSd(phase2);
      if (sd2 === null) return;

      if (
        phase1[avgProcessedField] === "yes" ||
        phase2[avgProcessedField] === "yes"
      ) {
        throw new Error(
          `${logPrefix} Marker baseline masih 0, tetapi Avg Fase 1/2 ` +
          "sudah berstatus yes. Periksa konsistensi data."
        );
      }

      const initialAvg = calculateMean([
        phase1[avgValueField],
        phase2[avgValueField],
      ]);

      const initialSd = calculateMean([sd1, sd2]);

      if (initialAvg === null || initialSd === null) return;

      await saveBaseline(initialAvg, initialSd);

      phase1[avgProcessedField] = "yes";
      await phase1.save({ transaction });

      phase2[avgProcessedField] = "yes";
      await phase2.save({ transaction });

      lastProcessed = 2;

      await state.update(
        { [markerField]: lastProcessed },
        { transaction }
      );

      console.log(
        `${logPrefix} Baseline awal dari Fase 1 dan 2: ` +
        `EWMA Avg=${initialAvg.toFixed(4)}, ` +
        `EWMA SD=${initialSd.toFixed(4)}.`
      );
    }

    // Proses fase berikutnya tepat satu per satu.
    while (lastProcessed < currentPhase - 1) {
      const nextPhase = lastProcessed + 1;
      const row = await getAvg(nextPhase);

      if (!row) break;

      // Jika marker tertinggal dari status yes, jangan hitung ulang diam-diam.
      if (row[avgProcessedField] === "yes") {
        throw new Error(
          `${logPrefix} ${row[phaseField]} sudah yes, tetapi marker ` +
          `baseline masih ${lastProcessed}. Perlu rekonsiliasi data.`
        );
      }

      const sd = await getMatchingSd(row);
      if (sd === null) break;

      activeBaseline = await getActiveBaseline();

      if (
        !activeBaseline ||
        !validNumber(activeBaseline[ewmaAvgField]) ||
        !validNumber(activeBaseline[ewmaSdField])
      ) {
        throw new Error(`${logPrefix} Baseline aktif tidak valid.`);
      }

      const updatedAvg = nextEwma(
        activeBaseline[ewmaAvgField],
        row[avgValueField]
      );

      const updatedSd = nextEwma(
        activeBaseline[ewmaSdField],
        sd
      );

      await saveBaseline(updatedAvg, updatedSd);

      row[avgProcessedField] = "yes";
      await row.save({ transaction });

      lastProcessed = nextPhase;

      await state.update(
        { [markerField]: lastProcessed },
        { transaction }
      );

      console.log(
        `${logPrefix} ${row[phaseField]}, Grup ${row[groupField]}: ` +
        `EWMA Avg=${updatedAvg.toFixed(4)}, ` +
        `EWMA SD=${updatedSd.toFixed(4)}.`
      );
    }
  });
}

async function processCompletedHrBaselinePhases(currentPhase) {
  return processBaseline({
    avgModel: TbHrAvg,
    kvModel: TbHrKv,
    baselineModel: TbHrBaselinetetap,
    avgValueField: "HrNilaiAvg",
    kvSdField: "HrNilaiSd",
    ewmaAvgField: "HrEwmaAvg",
    ewmaSdField: "HrEwmaSd",
    activeField: "HrStatusAktifBaseline",
    phaseProcessField: "HrFaseProses",
    avgProcessedField: "HrisEwma",
    phaseField: "HrStatusFase",
    groupField: "HrGroup",
    idField: "IDHrBt",
    markerField: "LastHrBaselinePhaseProcessed",
    logPrefix: "[HR BASELINE]",
  }, currentPhase);
}

async function processCompletedEdaBaselinePhases(currentPhase) {
  return processBaseline({
    avgModel: TbEdaAvg,
    kvModel: TbEdaKv,
    baselineModel: TbEdaBaselinetetap,
    avgValueField: "EdaNilaiAvg",
    kvSdField: "EdaNilaiSd",
    ewmaAvgField: "EdaEwmaAvg",
    ewmaSdField: "EdaEwmaSd",
    activeField: "EdaStatusAktifBaseline",
    phaseProcessField: "EdaFaseProses",
    avgProcessedField: "EdaisEwma",
    phaseField: "EdaStatusFase",
    groupField: "EdaGroup",
    idField: "IDEdaBt",
    markerField: "LastEdaBaselinePhaseProcessed",
    logPrefix: "[EDA BASELINE]",
  }, currentPhase);
}

module.exports = {
  processCompletedHrBaselinePhases,
  processCompletedEdaBaselinePhases,
};
