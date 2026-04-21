"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("AuthorizationCodes", "codeChallenge", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(
      "AuthorizationCodes",
      "codeChallengeMethod",
      {
        type: Sequelize.STRING,
        allowNull: true,
      },
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("AuthorizationCodes", "codeChallenge");
    await queryInterface.removeColumn(
      "AuthorizationCodes",
      "codeChallengeMethod",
    );
  },
};
