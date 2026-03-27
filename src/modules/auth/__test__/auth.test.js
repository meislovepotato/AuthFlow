import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../../app.js';

describe('Auth API', () => {
  const user = { email: 'test@mail.com', password: '123456' };

  it('registers a user', async () => {
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.email).toBe(user.email);
  });

  it('logs in a user', async () => {
    const res = await request(app).post('/api/auth/login').send(user);
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});