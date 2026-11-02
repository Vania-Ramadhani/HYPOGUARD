
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const TbHeartrate = sequelize.define(
  "TbHeartrate",
  {
    IDHr: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    Hr: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    HrGroup: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    HrStatusFase: {
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
    tableName: "TbHeartrate",
    timestamps: false,
    freezeTableName: true
  }
);

module.exports = TbHeartrate;
