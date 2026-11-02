
const {
  sequelize,
  TbCaptureState,
  TbHeartrate,
  TbHrv,
  TbEda,
} = require("../models");

const {
  processCompletedHrPhases,
  processCompletedEdaPhases,
} = require("./kvService");

const {
  processCompletedHrAvgPhases,
  processCompletedEdaAvgPhases,
} = require("./avgService");

const {
  processCompletedHrBaselinePhases,
  processCompletedEdaBaselinePhases,
} = require("./baselineService");

const {
  processCompletedHrvGroups,
} = require("./hrvService");

const {
  processCompletedHrvBaselinePhases,
} = require("./hrvBaselineService");

const HOUR_MS = 60 * 60 * 1000;
const GROUP_MS = 5 * 60 * 1000;
const GROUPS_PER_PHASE = 12;
const STATE_ID = 1;

// ============================================================
// CAPTURE STATE
// ============================================================

async function getCaptureState() {
  let state = await TbCaptureState.findByPk(STATE_ID);

  if (!state) {
    state = await TbCaptureState.create({
      ID: STATE_ID,
      AccumulatedCaptureMs: 0,
      CaptureActive: false,
      LatestMpuStatus: null,
      SessionStartedAt: null,
      SessionEndAt: null,
    });
  }

  return state;
}

// ============================================================
// GROUP / PHASE CALCULATION
// ============================================================

async function getCurrentGroupAndPhase(state, measurementTime) {
  const accumulated = Number(
    state.AccumulatedCaptureMs || 0
  );

  const startTime = new Date(
    state.SessionStartedAt
  ).getTime();

  const currentElapsed = Math.max(
    0,
    Math.min(
      measurementTime.getTime() - startTime,
      HOUR_MS
    )
  );

  const totalActiveMs = accumulated + currentElapsed;

  const phase = Math.floor(totalActiveMs / HOUR_MS) + 1;

  const elapsedWithinPhase = totalActiveMs % HOUR_MS;

  const group =
    Math.floor(elapsedWithinPhase / GROUP_MS) + 1;

  return {
    group: Math.min(group, GROUPS_PER_PHASE),
    phase,
  };
}

// ============================================================
// HRV PHASE FINALIZATION
// ============================================================

/**
 * Memproses semua grup HRV yang sudah selesai sebelum fase target.
 *
 * Fungsi ini harus dipanggil sebelum AccumulatedCaptureMs diperbarui
 * pada batas satu jam, agar fase terakhir tidak terlewat.
 */
async function finalizeHrvBeforePhase(phaseToFinalize) {
  if (phaseToFinalize < 1) return;

  // Memakai fase setelah fase yang ditutup agar seluruh grup fase
  // sebelumnya dianggap sudah selesai oleh processCompletedHrvGroups.
  await processCompletedHrvGroups(
    phaseToFinalize + 1,
    1
  );

  // currentPhase = fase berikutnya menandakan fase sebelumnya selesai.
  await processCompletedHrvBaselinePhases(
    phaseToFinalize + 1
  );
}

// ============================================================
// SESSION BOUNDARY
// ============================================================

async function checkSessionBoundary() {
  let state = await getCaptureState();

  while (
    state.CaptureActive &&
    state.SessionEndAt &&
    Date.now() >= new Date(state.SessionEndAt).getTime()
  ) {
    const boundaryTime = new Date(state.SessionEndAt);

    // Selesaikan pemrosesan HRV fase yang akan ditutup sebelum
    // durasi aktif ditambahkan dan fase berikutnya dimulai.
    const completedPhase =
      Math.floor(
        Number(state.AccumulatedCaptureMs || 0) / HOUR_MS
      ) + 1;

    await finalizeHrvBeforePhase(completedPhase);

    const accumulated =
      Number(state.AccumulatedCaptureMs || 0) + HOUR_MS;

    if (state.LatestMpuStatus === "TIDUR") {
      await state.update({
        AccumulatedCaptureMs: accumulated,
        CaptureActive: true,
        SessionStartedAt: boundaryTime,
        SessionEndAt: new Date(
          boundaryTime.getTime() + HOUR_MS
        ),
      });
    } else {
      await state.update({
        AccumulatedCaptureMs: accumulated,
        CaptureActive: false,
        SessionStartedAt: null,
        SessionEndAt: null,
      });
    }

    state = await getCaptureState();
  }

  return state;
}

// ============================================================
// MPU STATUS
// ============================================================

async function handleMpuStatus(status) {
  const normalizedStatus = String(status || "")
    .trim()
    .toUpperCase();

  if (!normalizedStatus) return;

  let state = await checkSessionBoundary();

  await state.update({
    LatestMpuStatus: normalizedStatus,
  });

  state = await getCaptureState();

  if (
    !state.CaptureActive &&
    normalizedStatus === "TIDUR"
  ) {
    const now = new Date();

    await state.update({
      CaptureActive: true,
      SessionStartedAt: now,
      SessionEndAt: new Date(
        now.getTime() + HOUR_MS
      ),
    });
  }

  console.log(
    `[MPU] status=${normalizedStatus}, capture=${
      state.CaptureActive ? "active" : "inactive"
    }`
  );
}

// ============================================================
// ACTIVE CAPTURE CONTEXT
// ============================================================

async function getActiveCaptureContext() {
  const state = await checkSessionBoundary();

  if (
    !state.CaptureActive ||
    !state.SessionStartedAt ||
    !state.SessionEndAt
  ) {
    return null;
  }

  const now = new Date();

  if (
    now.getTime() >=
    new Date(state.SessionEndAt).getTime()
  ) {
    return null;
  }

  const { group, phase } =
    await getCurrentGroupAndPhase(state, now);

  return {
    group,
    phase,
    time: now,
  };
}

// ============================================================
// MAX30100: HEART RATE + HRV
// ============================================================

async function saveMaxData(payload) {
  if (
    String(payload.status || "")
      .trim()
      .toUpperCase() !== "VALID"
  ) {
    return;
  }

  const bpm = Number(payload.bpm);

  if (!Number.isFinite(bpm) || bpm <= 0) {
    console.warn(
      "[MAX] BPM tidak valid, data diabaikan."
    );
    return;
  }

  const context = await getActiveCaptureContext();

  if (!context) return;

  // Pertahankan alur HR yang sudah ada.
  await processCompletedHrPhases(context.phase);
  await processCompletedHrAvgPhases(context.phase);
  await processCompletedHrBaselinePhases(context.phase);

  // Tutup grup HRV yang telah dilewati.
  await processCompletedHrvGroups(
    context.phase,
    context.group
  );

  await processCompletedHrvBaselinePhases(
    context.phase
  );

  const rawIbi = Number(payload.raw_ibi_ms);

  const rejectReason = String(
    payload.reject_reason || ""
  )
    .trim()
    .toUpperCase();

  const validRawIbi =
    payload.raw_ibi_ms !== null &&
    payload.raw_ibi_ms !== undefined &&
    payload.raw_ibi_ms !== "" &&
    Number.isFinite(rawIbi) &&
    rawIbi >= 300 &&
    rawIbi <= 1500 &&
    rejectReason === "NONE";

  await sequelize.transaction(async (transaction) => {
    // HR tetap disimpan sesuai alur sebelumnya.
    await TbHeartrate.create(
      {
        Hr: bpm,
        HrGroup: context.group,
        HrStatusFase: `Fase ${context.phase}`,
        Time: context.time,
      },
      { transaction }
    );

    // HRV memakai IBI individual, bukan median_ibi_ms.
    if (validRawIbi) {
      await TbHrv.create(
        {
          Hrv: rawIbi,
          HrvGroup: context.group,
          HrvStatusFase: `Fase ${context.phase}`,
          Time: context.time,
        },
        { transaction }
      );
    }
  });

  console.log(
    `[MAX] Fase ${context.phase} | Group ${context.group} | ` +
      `BPM=${bpm} | ` +
      (validRawIbi
        ? `IBI=${rawIbi} ms tersimpan`
        : `IBI dilewati (raw=${payload.raw_ibi_ms}, ` +
          `reject=${rejectReason})`)
  );
}

// ============================================================
// EDA
// ============================================================

async function saveEdaData(payload) {
  if (
    String(payload.status || "")
      .trim()
      .toUpperCase() !== "KONTAK TERDETEKSI"
  ) {
    return;
  }

  const eda = Number(payload.eda);

  if (!Number.isFinite(eda)) {
    console.warn(
      "[EDA] Data diabaikan: nilai eda tidak valid."
    );
    return;
  }

  const context = await getActiveCaptureContext();

  if (!context) return;

  await processCompletedEdaPhases(context.phase);
  await processCompletedEdaAvgPhases(context.phase);
  await processCompletedEdaBaselinePhases(context.phase);

  await TbEda.create({
    Eda: eda,
    EdaGroup: context.group,
    EdaStatusFase: `Fase ${context.phase}`,
    Time: context.time,
  });

  console.log(
    `[EDA] EDA=${eda}, Group=${context.group}, Fase=${context.phase}`
  );
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  getCaptureState,
  checkSessionBoundary,
  handleMpuStatus,
  saveMaxData,
  saveEdaData,
};
