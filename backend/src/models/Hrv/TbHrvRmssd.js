
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const TbHrvRmssd = sequelize.define(
  "TbHrvRmssd",
  {
    IDHrvRmssd: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    HrvGroup: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    HrvStatusFase: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    HrvNilaiRmssd: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    HrvNilaiSd: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    HrvisEwma: {
      type: DataTypes.ENUM("pending", "yes"),
      allowNull: false,
      defaultValue: "pending"
    }
  },
  {
    tableName: "TbHrvRmssd",
    timestamps: false,
    freezeTableName: true
  }
);

module.exports = TbHrvRmssd;
