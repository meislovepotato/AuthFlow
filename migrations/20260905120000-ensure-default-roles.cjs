"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      'SELECT "name" FROM "Roles" WHERE "name" IN (\'ADMIN\', \'USER\')',
    );
    const existingNames = new Set(roles.map((role) => role.name));
    const now = new Date();
    const missingRoles = ["ADMIN", "USER"]
      .filter((name) => !existingNames.has(name))
      .map((name) => ({ name, createdAt: now, updatedAt: now }));

    if (missingRoles.length > 0) {
      await queryInterface.bulkInsert("Roles", missingRoles);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("Roles", {
      name: ["ADMIN", "USER"],
    });
  },
};
