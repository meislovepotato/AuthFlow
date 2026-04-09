import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Application extends Model {
    static associate(models) {
      // Optional:
      // If apps are tied to users:
      // Application.belongsTo(models.User, { foreignKey: "userId" });
    }
  }

  Application.init(
    {
      name: DataTypes.STRING,
      clientId: DataTypes.STRING,
      clientSecret: DataTypes.STRING,
      redirectUri: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Application",
    }
  );

  return Application;
};