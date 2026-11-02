
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const TbHrv = sequelize.define(
  "TbHrv",
  {
    IDHrv: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    Hrv: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    HrvGroup: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    HrvStatusFase: {
      type: DataTypes.STRING,
      allowNull: false
    },
    Time: {
      type: DataTypes.DATE,
      allowNull: false
    }
  },
  {
    tableName: "TbHrv",
    timestamps: false,
    freezeTableName: true
  }
);

module.exports = TbHrv;
