import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';
import { SUPPORTED_SCHEMA_MAJOR } from '@fredieposh/hookops-shared';

describe('GET /health', () => {
  it('returns 200 and { status: "ok" }', async () => {
    const app = buildApp({ contractMajor: SUPPORTED_SCHEMA_MAJOR });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
