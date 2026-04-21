import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class AuthorizationCode extends Model {
    static associate(models) {
      // Optional: AuthorizationCode.belongsTo(models.User, { foreignKey: "userId" });
      // Optional: AuthorizationCode.belongsTo(models.Application, { foreignKey: "clientId", targetKey: "clientId" });
    }
  }

  AuthorizationCode.init(
    {
      code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      clientId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      redirectUri: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      // PKCE support
      codeChallenge: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      codeChallengeMethod: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      expiresAt: DataTypes.DATE,
      used: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "AuthorizationCode",
    },
  );

  return AuthorizationCode;
};
