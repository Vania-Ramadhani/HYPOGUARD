
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const TbEda = sequelize.define(
  "TbEda",
  {
    IDEda: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    Eda: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    EdaGroup: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    EdaStatusFase: {
      type: DataTypes.STRING,
      allowNull: false
    },
    Time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: "TbEda",
    timestamps: false,
    freezeTableName: true
  }
);

module.exports = TbEda;
