import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Session extends Model {
    static associate(models) {
      // Example (optional):
      // Session.belongsTo(models.User, { foreignKey: "userId" });
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
    }
  );

  return Session;
};