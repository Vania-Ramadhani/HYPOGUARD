
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const TbEdaBaselinetetap = sequelize.define(
  "TbEdaBaselinetetap",
  {
    IDEdaBt: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    EdaEwmaAvg: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    EdaEwmaSd: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    EdaStatusAktifBaseline: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    Datetime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    EdaFaseProses: {
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
    tableName: "TbEdaBaselinetetap",
    timestamps: false,
    freezeTableName: true
  }
);

module.exports = TbEdaBaselinetetap;
