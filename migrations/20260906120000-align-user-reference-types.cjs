"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "Sessions"
      SET "userId" = NULL
      WHERE "userId" IS NOT NULL
        AND "userId"::text !~ '^[0-9]+$'
    `);

    await queryInterface.sequelize.query(`
      UPDATE "AuditLogs"
      SET "userId" = NULL
      WHERE "userId" IS NOT NULL
        AND "userId"::text !~ '^[0-9]+$'
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM "AuthorizationCodes"
      WHERE "userId"::text !~ '^[0-9]+$'
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "Sessions"
      ALTER COLUMN "userId" TYPE INTEGER
      USING CASE
        WHEN "userId"::text ~ '^[0-9]+$' THEN "userId"::text::integer
        ELSE NULL
      END
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "AuditLogs"
      ALTER COLUMN "userId" TYPE INTEGER
      USING CASE
        WHEN "userId"::text ~ '^[0-9]+$' THEN "userId"::text::integer
        ELSE NULL
      END
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "AuthorizationCodes"
      ALTER COLUMN "userId" TYPE INTEGER
      USING "userId"::text::integer
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Sessions"
      ALTER COLUMN "userId" TYPE UUID
      USING NULL::uuid
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "AuditLogs"
      ALTER COLUMN "userId" TYPE UUID
      USING NULL::uuid
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "AuthorizationCodes"
      ALTER COLUMN "userId" TYPE UUID
      USING NULL::uuid
    `);
  },
};
