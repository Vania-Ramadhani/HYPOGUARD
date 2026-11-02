
const sequelize = require("../config/database");

// Capture state model
const TbCaptureState = require("./TbCaptureState");

// Heartrate models
const TbHeartrate = require("./Heartrate/TbHeartrate");
const TbHrKv = require("./Heartrate/TbHrKv");
const TbHrAvg = require("./Heartrate/TbHrAvg");
const TbHrBaselinetetap = require("./Heartrate/TbHrBaselinetetap");

// EDA
const TbEda = require("./Eda/TbEda");
const TbEdaKv = require("./Eda/TbEdaKv");
const TbEdaAvg = require("./Eda/TbEdaAvg");
const TbEdaBaselinetetap = require("./Eda/TbEdaBaselinetetap");

//HRV
const TbHrv = require("./Hrv/TbHrv");
const TbHrvRmssd = require("./Hrv/TbHrvRmssd");
const TbHrvBaselinetetap = require("./Hrv/TbHrvBaselinetetap");

// Daftarkan model lainnya di sini ketika sudah dibuat.

module.exports = {
  sequelize,
  
  // Capture state 
  TbCaptureState,

  // Heartrate
  TbHeartrate,
  TbHrKv,
  TbHrAvg,
  TbHrBaselinetetap,

  // EDA
  TbEda,
  TbEdaKv,
  TbEdaAvg,
  TbEdaBaselinetetap,

  // HRV
  TbHrv,
  TbHrvRmssd,
  TbHrvBaselinetetap
};
