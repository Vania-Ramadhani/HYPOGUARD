
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const TbHrvBaselinetetap = sequelize.define(
  "TbHrvBaselinetetap",
  {
    IDHrvBt: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    HrvEwmaRmssd: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    HrvEwmaSd: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    HrvStatusAktifBaseline: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    Datetime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    HrvFaseProses: {
      type: DataTypes.ENUM("action", "harusKalibrasi"),
      allowNull: true,
      defaultValue: null
    },
    Deleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    tableName: "TbHrvBaselinetetap",
    timestamps: false,
    freezeTableName: true
  }
);

module.exports = TbHrvBaselinetetap;
