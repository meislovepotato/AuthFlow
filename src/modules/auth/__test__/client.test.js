import request from "supertest";
import app from "../../../app.js";
import db from "../../../database/index.js";
import bcrypt from "bcrypt";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("Client credentials", () => {
  const clientId = `client-${Date.now()}`;
  const clientSecret = "s3cr3t";
  let applicationId;

  beforeAll(async () => {
    await db.sequelize.authenticate();
    const hashed = await bcrypt.hash(clientSecret, 10);
    const appRec = await db.Application.create({
      name: "test-app",
      clientId,
      clientSecret: hashed,
      redirectUri: "http://localhost/cb",
    });
    applicationId = appRec.id;
  });

  afterAll(async () => {
    try {
      if (applicationId)
        await db.Application.destroy({ where: { id: applicationId } });
    } catch (err) {
      // ignore
    }
    await db.sequelize.close();
  });

  it("issues a client access token when valid credentials provided", async () => {
    const res = await request(app)
      .post("/api/auth/client-token")
      .set("x-client-id", clientId)
      .set("x-client-secret", clientSecret);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });
});
