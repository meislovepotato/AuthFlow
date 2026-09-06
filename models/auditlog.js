import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class AuditLog extends Model {
    static associate(models) {
      // Optional but recommended:
      // AuditLog.belongsTo(models.User, { foreignKey: "userId" });
    }
  }

  AuditLog.init(
    {
      action: DataTypes.STRING,
      ipAddress: DataTypes.STRING,
      userId: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "AuditLog",
    },
  );

  return AuditLog;
};
