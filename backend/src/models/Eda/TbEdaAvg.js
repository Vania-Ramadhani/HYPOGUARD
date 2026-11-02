
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const TbEdaAvg = sequelize.define(
  "TbEdaAvg",
  {
    IDEdaAvg: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    EdaStatusFase: {
      type: DataTypes.STRING,
      allowNull: false
    },
    EdaGroup: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    EdaNilaiAvg: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    EdaisEwma: {
      type: DataTypes.ENUM("pending", "yes"),
      allowNull: false,
      defaultValue: "pending"
    }
  },
  {
    tableName: "TbEdaAvg",
    timestamps: false,
    freezeTableName: true
  }
);

module.exports = TbEdaAvg;
