
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const TbHrKv = sequelize.define(
  "TbHrKv",
  {
    IDHrKv: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    HrGroup: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    HrStatusFase: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    HrNilaiKv: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    HrNilaiSd: {
      type: DataTypes.FLOAT,
      allowNull: false
    }
  },
  {
    tableName: "TbHrKv",
    timestamps: false,
    freezeTableName: true
  }
);

module.exports = TbHrKv;
