"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert("Roles", [
      {
        name: "ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "USER",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("Roles", null, {});
  },
};
