import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../../app.js";

describe("Auth API", () => {
  let user;

  beforeEach(() => {
    user = {
      email: `test${Date.now()}@mail.com`,
      password: "123456",
    };
  });

  it("registers a user", async () => {
    const res = await request(app).post("/api/auth/register").send(user);
    expect(res.statusCode).toBe(201);
  });

  it("logs in a user", async () => {
    await request(app).post("/api/auth/register").send(user);

    const res = await request(app).post("/api/auth/login").send(user);

    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });
});
