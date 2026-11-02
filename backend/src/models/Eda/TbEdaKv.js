
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const TbEdaKv = sequelize.define(
  "TbEdaKv",
  {
    IDEdaKv: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    EdaGroup: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    EdaStatusFase: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    EdaNilaiKv: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    EdaNilaiSd: {
      type: DataTypes.FLOAT,
      allowNull: false
    }
  },
  {
    tableName: "TbEdaKv",
    timestamps: false,
    freezeTableName: true
  }
);

module.exports = TbEdaKv;
