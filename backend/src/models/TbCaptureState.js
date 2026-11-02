
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const TbCaptureState = sequelize.define(
  "TbCaptureState",
  {
    ID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    AccumulatedCaptureMs: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    CaptureActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    LatestMpuStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    SessionStartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    SessionEndAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    LastHrKvPhaseProcessed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    LastEdaKvPhaseProcessed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    LastHrAvgPhaseProcessed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    LastEdaAvgPhaseProcessed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    LastHrBaselinePhaseProcessed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    LastEdaBaselinePhaseProcessed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    LastHrvBaselinePhaseProcessed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "TbCaptureState",
    timestamps: false,
    freezeTableName: true,
  }
);

module.exports = TbCaptureState;
