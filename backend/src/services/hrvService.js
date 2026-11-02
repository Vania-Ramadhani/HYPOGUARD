
const { Op } = require("sequelize");
const { TbHrv, TbHrvRmssd } = require("../models");

function isValidIbi(value) {
  const ibi = Number(value);
  return Number.isFinite(ibi) && ibi >= 300 && ibi <= 1500;
}

function calculateRmssd(values) {
  if (values.length < 2) return null;

  let sumSquaredDifferences = 0;

  for (let i = 1; i < values.length; i++) {
    const difference = values[i] - values[i - 1];
    sumSquaredDifferences += difference * difference;
  }

  return Math.sqrt(sumSquaredDifferences / (values.length - 1));
}

function calculateSampleSd(values) {
  if (values.length < 2) return null;

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const squaredDifferences = values.reduce(
    (sum, value) => sum + Math.pow(value - mean, 2),
    0
  );

  return Math.sqrt(squaredDifferences / (values.length - 1));
}

function parsePhase(phaseLabel) {
  const match = String(phaseLabel || "").match(/^Fase\s+(\d+)$/i);
  return match ? Number(match[1]) : null;
}

/**
 * Proses grup yang sudah ditinggalkan:
 * - seluruh grup dari fase sebelum fase aktif
 * - grup yang nomornya lebih kecil daripada grup aktif pada fase yang sama
 */
async function processCompletedHrvGroups(currentPhase, currentGroup) {
  const previousPhaseRows = await TbHrv.findAll({
    where: {
      HrvStatusFase: {
        [Op.ne]: null,
      },
    },
    attributes: ["HrvStatusFase", "HrvGroup"],
    group: ["HrvStatusFase", "HrvGroup"],
    raw: true,
  });

  const completedGroups = previousPhaseRows
    .map((row) => ({
      phaseLabel: row.HrvStatusFase,
      phase: parsePhase(row.HrvStatusFase),
      group: Number(row.HrvGroup),
    }))
    .filter((row) => {
      if (!row.phase || !Number.isFinite(row.group)) return false;

      return (
        row.phase < currentPhase ||
        (row.phase === currentPhase && row.group < currentGroup)
      );
    });

  for (const groupInfo of completedGroups) {
    const existing = await TbHrvRmssd.findOne({
      where: {
        HrvStatusFase: groupInfo.phaseLabel,
        HrvGroup: groupInfo.group,
      },
    });

    // Hindari menghitung dan menyimpan grup yang sama berulang kali.
    if (existing) continue;

    const rows = await TbHrv.findAll({
      where: {
        HrvStatusFase: groupInfo.phaseLabel,
        HrvGroup: groupInfo.group,
      },
      order: [["Time", "ASC"], ["IDHrv", "ASC"]],
      raw: true,
    });

    const ibiValues = rows
      .map((row) => Number(row.Hrv))
      .filter(isValidIbi);

    if (ibiValues.length < 2) {
      console.warn(
        `[HRV] Grup belum memiliki cukup IBI valid: ${groupInfo.phaseLabel}, ` +
        `Group ${groupInfo.group}, sampel=${ibiValues.length}`
      );
      continue;
    }

    const rmssd = calculateRmssd(ibiValues);
    const sd = calculateSampleSd(ibiValues);

    if (
      !Number.isFinite(rmssd) ||
      !Number.isFinite(sd)
    ) {
      console.warn(
        `[HRV] RMSSD/SD tidak valid: ${groupInfo.phaseLabel}, Group ${groupInfo.group}`
      );
      continue;
    }

    await TbHrvRmssd.create({
      HrvGroup: groupInfo.group,
      HrvStatusFase: groupInfo.phaseLabel,
      HrvNilaiRmssd: rmssd,
      HrvNilaiSd: sd,
      HrvisEwma: "pending",
    });

    console.log(
      `[HRV] ${groupInfo.phaseLabel} | Group ${groupInfo.group} | ` +
      `N=${ibiValues.length} | RMSSD=${rmssd.toFixed(2)} ms | SD=${sd.toFixed(2)} ms`
    );
  }
}

module.exports = {
  processCompletedHrvGroups,
  calculateRmssd,
  calculateSampleSd,
};
