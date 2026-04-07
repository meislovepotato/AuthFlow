"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Sessions", "refreshToken", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("Sessions", "userAgent", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("Sessions", "ipAddress", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Sessions", "refreshToken");
    await queryInterface.removeColumn("Sessions", "userAgent");
    await queryInterface.removeColumn("Sessions", "ipAddress");
  },
};
