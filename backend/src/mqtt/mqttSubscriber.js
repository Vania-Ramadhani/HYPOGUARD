
const mqtt = require("mqtt");

const {
  handleMpuStatus,
  saveMaxData,
  saveEdaData,
  checkSessionBoundary,
} = require("../services/captureService");

const {
  createBaselineMqttPublisher,
} = require("../services/baselineMqttPublisher");

function startMqttSubscriber() {
  const options = {
    clientId:
      process.env.MQTT_CLIENT_ID || "hypoguard_backend",
    reconnectPeriod: 5000,
  };

  if (process.env.MQTT_USERNAME) {
    options.username = process.env.MQTT_USERNAME;
  }

  if (process.env.MQTT_PASSWORD) {
    options.password = process.env.MQTT_PASSWORD;
  }

  const client = mqtt.connect(
    process.env.MQTT_BROKER,
    options
  );

  const baselinePublisher =
    createBaselineMqttPublisher(client);

  // Memproses pesan sensor secara berurutan.
  let messageQueue = Promise.resolve();

  function enqueue(task) {
    messageQueue = messageQueue
      .then(task)
      .catch((error) => {
        console.error(
          "[MQTT] Gagal memproses pesan:",
          error
        );
      });

    return messageQueue;
  }

  client.on("connect", () => {
    console.log("[MQTT] Terhubung ke broker.");

    client.subscribe(
      [
        "hypoguard/mpu",
        "hypoguard/max",
        "hypoguard/eda",
      ],
      { qos: 1 },
      (error) => {
        if (error) {
          console.error(
            "[MQTT] Gagal subscribe:",
            error.message
          );
          return;
        }

        console.log("[MQTT] Subscribe berhasil:");
        console.log(" - hypoguard/mpu");
        console.log(" - hypoguard/max");
        console.log(" - hypoguard/eda");
      }
    );

    // Kirim baseline aktif setiap kali koneksi broker berhasil.
    baselinePublisher.publishActiveBaselines(true);
  });

  client.on("message", (topic, message) => {
    enqueue(async () => {
      await checkSessionBoundary();

      let payload;

      try {
        payload = JSON.parse(message.toString());
      } catch (error) {
        console.warn(
          `[MQTT] JSON tidak valid pada topic ${topic}`
        );
        return;
      }

      switch (topic) {
        case "hypoguard/mpu":
          await handleMpuStatus(payload.status);
          break;

        case "hypoguard/max":
          await saveMaxData(payload);
          break;

        case "hypoguard/eda":
          await saveEdaData(payload);
          break;

        default:
          break;
      }
    });
  });

  client.on("reconnect", () => {
    console.log(
      "[MQTT] Mencoba menghubungkan ulang..."
    );
  });

  client.on("error", (error) => {
    console.error("[MQTT] Error:", error.message);
  });

  client.on("close", () => {
    console.log("[MQTT] Koneksi broker ditutup.");
  });

  // Tetap memeriksa batas sesi walaupun tidak ada pesan masuk.
  const boundaryTimer = setInterval(() => {
    enqueue(checkSessionBoundary);
  }, 1000);

  // Periksa perubahan baseline dari database setiap 5 detik.
  const baselineTimer = setInterval(() => {
    baselinePublisher.publishActiveBaselines(false);
  }, 5000);

  return {
    client,
    stop() {
      clearInterval(boundaryTimer);
      clearInterval(baselineTimer);
      client.end();
    },
  };
}

module.exports = {
  startMqttSubscriber,
};
