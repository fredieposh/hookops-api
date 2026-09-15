import { SUPPORTED_SCHEMA_MAJOR } from '@fredieposh/hookops-shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('GET /version', () => {
  it('returns a semantic version', async () => {
    const app = buildApp({
      serviceName: 'hookops-api',
      serviceVersion: '1.0.0',
      contractMajor: SUPPORTED_SCHEMA_MAJOR,
    });

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/version',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().version).toMatch(/^\d+\.\d+\.\d+$/);
    } finally {
      await app.close();
    }
  });
});
