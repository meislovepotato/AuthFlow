import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {}
  }

  User.init(
    {
      email: DataTypes.STRING,
      password: DataTypes.STRING,
      failedLoginAttempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      lockedUntil: DataTypes.DATE,
      roleId: DataTypes.UUID,
    },
    {
      sequelize,
      modelName: "User",
    },
  );

  return User;
};
