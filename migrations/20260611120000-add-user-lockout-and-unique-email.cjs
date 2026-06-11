"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Users", "failedLoginAttempts", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn("Users", "lockedUntil", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Add unique constraint on email to enforce DB-level uniqueness
    await queryInterface.addConstraint("Users", {
      fields: ["email"],
      type: "unique",
      name: "unique_users_email",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint("Users", "unique_users_email");
    await queryInterface.removeColumn("Users", "lockedUntil");
    await queryInterface.removeColumn("Users", "failedLoginAttempts");
  },
};
