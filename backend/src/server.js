require("dotenv").config();

const express = require("express");
const { sequelize } = require("./models");
const { startMqttSubscriber } = require("./mqtt/mqttSubscriber");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log("[DB] MySQL connection established");

    await sequelize.sync();
    console.log("[DB] Database models synchronized");

    startMqttSubscriber();

    app.listen(PORT, () => {
      console.log(`[SERVER] Running on port ${PORT}`);
    });
  } catch (error) {
    console.error("[SERVER] Initialization failed:", error);
    process.exit(1);
  }
}

startServer();