require("dotenv").config();

const { sequelize } = require("./src/models");
const { calculateAllAvg } = require("./src/services/avgService");

async function main() {
  try {
    await sequelize.authenticate();

    const result = await calculateAllAvg();

    console.log("Hasil:", result);
  } catch (error) {
    console.error("Perhitungan Avg gagal:", error);
  } finally {
    await sequelize.close();
  }
}

main();