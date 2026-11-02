
const {
  TbHrBaselinetetap,
  TbHrvBaselinetetap,
  TbEdaBaselinetetap,
} = require("../models");

const TOPICS = {
  hr: "hypoguard/EwmaHr",
  hrv: "hypoguard/EwmaHrv",
  eda: "hypoguard/EwmaEda",
};

async function getActiveBaseline(Model, fields) {
  const row = await Model.findOne({
    where: {
      [fields.active]: true,
      Deleted: false,
    },
    order: [[fields.id, "DESC"]],
  });

  if (!row) return null;

  return row;
}

async function getBaselinePayloads() {
  const [hr, hrv, eda] = await Promise.all([
    getActiveBaseline(TbHrBaselinetetap, {
      active: "HrStatusAktifBaseline",
      id: "IDHrBt",
    }),
    getActiveBaseline(TbHrvBaselinetetap, {
      active: "HrvStatusAktifBaseline",
      id: "IDHrvBt",
    }),
    getActiveBaseline(TbEdaBaselinetetap, {
      active: "EdaStatusAktifBaseline",
      id: "IDEdaBt",
    }),
  ]);

  return [
    {
      name: "HR",
      topic: TOPICS.hr,
      payload: hr
        ? {
            HrFaseProses: hr.HrFaseProses,
            HrStatusAktifBaseline: Boolean(hr.HrStatusAktifBaseline),
            HrEwmaAvg: hr.HrEwmaAvg,
            HrEwmaSd: hr.HrEwmaSd,
          }
        : null,
    },
    {
      name: "HRV",
      topic: TOPICS.hrv,
      payload: hrv
        ? {
            HrvFaseProses: hrv.HrvFaseProses,
            HrvStatusAktifBaseline: Boolean(
              hrv.HrvStatusAktifBaseline
            ),
            HrvEwmaRmssd: hrv.HrvEwmaRmssd,
            HrvEwmaSd: hrv.HrvEwmaSd,
          }
        : null,
    },
    {
      name: "EDA",
      topic: TOPICS.eda,
      payload: eda
        ? {
            EdaFaseProses: eda.EdaFaseProses,
            EdaStatusAktifBaseline: Boolean(
              eda.EdaStatusAktifBaseline
            ),
            EdaEwmaAvg: eda.EdaEwmaAvg,
            EdaEwmaSd: eda.EdaEwmaSd,
          }
        : null,
    },
  ];
}

/**
 * Publikasikan baseline aktif.
 *
 * force=true digunakan saat koneksi MQTT tersambung kembali.
 * Jika force=false, hanya payload yang berubah yang dikirim.
 */
function createBaselineMqttPublisher(client) {
  const lastPayloadByTopic = new Map();
  let publishing = false;

  async function publishActiveBaselines(force = false) {
    if (publishing || !client.connected) return;

    publishing = true;

    try {
      const baselines = await getBaselinePayloads();

      for (const baseline of baselines) {
        if (!baseline.payload) {
          console.warn(
            `[MQTT Publisher] Baseline aktif ${baseline.name} tidak ditemukan.`
          );
          continue;
        }

        const message = JSON.stringify(baseline.payload);
        const previousMessage = lastPayloadByTopic.get(
          baseline.topic
        );

        if (!force && previousMessage === message) {
          continue;
        }

        await new Promise((resolve, reject) => {
          client.publish(
            baseline.topic,
            message,
            {
              qos: 1,
              retain: true,
            },
            (error) => {
              if (error) {
                reject(error);
                return;
              }

              resolve();
            }
          );
        });

        lastPayloadByTopic.set(baseline.topic, message);

        console.log(
          `[MQTT Publisher] ${baseline.topic} -> ${message}`
        );
      }
    } catch (error) {
      console.error(
        "[MQTT Publisher] Gagal mengirim baseline:",
        error.message
      );
    } finally {
      publishing = false;
    }
  }

  return {
    publishActiveBaselines,
  };
}

module.exports = {
  createBaselineMqttPublisher,
};
