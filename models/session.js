"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Session extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Session.init(
    {
      token: DataTypes.STRING,
      expiresAt: DataTypes.DATE,
      userId: DataTypes.UUID,
      refreshToken: DataTypes.STRING,
      userAgent: DataTypes.STRING,
      ipAddress: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Session",
    },
  );
  return Session;
};
