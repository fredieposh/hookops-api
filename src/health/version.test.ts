import { SUPPORTED_SCHEMA_MAJOR } from '@fredieposh/hookops-shared';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { createLogger } from '../observability/logger.js';

describe('GET /version', () => {
  it('returns a semantic version', async () => {
    const config = {
      serviceName: 'hookops-api' as const,
      serviceVersion: '1.0.0',
      gitCommitSha: '0123456789abcdef0123456789abcdef01234567',
      contractMajor: SUPPORTED_SCHEMA_MAJOR,
      probeTimeoutMs: 1_000,
    };

    const probes = {
      postgres: vi.fn(async () => undefined),
      redis: vi.fn(async () => undefined),
    };

    const app = buildApp(config, createLogger(config), probes);

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/version',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        version: config.serviceVersion,
        commitSha: config.gitCommitSha,
        contractMajor: SUPPORTED_SCHEMA_MAJOR,
      });
    } finally {
      await app.close();
    }
  });
});
