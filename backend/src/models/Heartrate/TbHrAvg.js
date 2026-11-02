
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const TbHrAvg = sequelize.define(
  "TbHrAvg",
  {
    IDHrAvg: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    HrStatusFase: {
      type: DataTypes.STRING,
      allowNull: false
    },
    HrGroup: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    HrNilaiAvg: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    HrisEwma: {
      type: DataTypes.ENUM("pending", "yes"),
      allowNull: false,
      defaultValue: "pending"
    }
  },
  {
    tableName: "TbHrAvg",
    timestamps: false,
    freezeTableName: true
  }
);

module.exports = TbHrAvg;
