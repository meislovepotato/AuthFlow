"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Users"
      ALTER COLUMN "roleId" TYPE INTEGER
      USING CASE
        WHEN "roleId"::text ~ '^[0-9]+$' THEN "roleId"::text::integer
        ELSE NULL
      END
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Users"
      ALTER COLUMN "roleId" TYPE UUID
      USING NULL::uuid
    `);
  },
};
