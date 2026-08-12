import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('GET /version', () => {
  it('returns 200 and a semver version string', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/version' });

    expect(res.statusCode).toBe(200);
    expect(res.json().version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
