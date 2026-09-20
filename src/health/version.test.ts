import { SUPPORTED_SCHEMA_MAJOR } from '@fredieposh/hookops-shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createLogger } from '../observability/logger.js';

describe('GET /version', () => {
  it('returns a semantic version', async () => {
    const config = {
      serviceName: 'hookops-api' as const,
      serviceVersion: '1.0.0',
      contractMajor: SUPPORTED_SCHEMA_MAJOR,
    };
    const app = buildApp(config, createLogger(config));

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
