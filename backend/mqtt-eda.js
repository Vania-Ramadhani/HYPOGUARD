
require('dotenv').config();

const mqtt = require('mqtt');
const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

const client = mqtt.connect(process.env.MQTT_BROKER, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clientId: 'hypoguard_eda_backend',
  reconnectPeriod: 5000
});

let sessionStart = null;

client.on('connect', () => {
  console.log('MQTT connected');

  client.subscribe(
    process.env.MQTT_TOPIC,
    (err) => {
      if (err) console.error(err);
      else console.log('Subscribed to EDA topic');
    }
  );
});

client.on('message', async (topic, message) => {
  try {
    const data = JSON.parse(message.toString());

    if (data.EDA === null ||
        data.EDA === undefined ||
        data.EDA === '') return;

    const eda = Number(data.EDA);

    if (!Number.isFinite(eda)) return;

    const now = new Date();

    if (sessionStart === null) {
      sessionStart = now;
    }

    const elapsedSeconds =
      Math.max(0, (now - sessionStart) / 1000);

    const edaGroup =
      Math.floor(elapsedSeconds / 300) + 1;

    const statusFase =
      Math.floor(elapsedSeconds / 3600) + 1;

    const sql = `
      INSERT INTO eda
      (Eda, \`time\`, EdaGroup, StatusFase)
      VALUES (?, ?, ?, ?)
    `;

    const timestamp = now.toISOString()
      .slice(0, 23).replace('T', ' ');

    await db.execute(sql, [
      eda,
      timestamp,
      edaGroup,
      statusFase
    ]);

    console.log({
      Eda: eda,
      time: timestamp,
      EdaGroup: edaGroup,
      StatusFase: statusFase
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
});

client.on('error', (error) => {
  console.error('MQTT error:', error.message);
});
