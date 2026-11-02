
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const TbHrBaselinetetap = sequelize.define(
  "TbHrBaselinetetap",
  {
    IDHrBt: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    HrEwmaAvg: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    HrEwmaSd: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    HrStatusAktifBaseline: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    Datetime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    HrFaseProses: {
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
    tableName: "TbHrBaselinetetap",
    timestamps: false,
    freezeTableName: true
  }
);

module.exports = TbHrBaselinetetap;
