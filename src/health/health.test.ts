import { SUPPORTED_SCHEMA_MAJOR } from '@fredieposh/hookops-shared';
import { describe, it, vi, expect } from 'vitest';
import { buildApp } from '../app.js';
import { assessContractMajor } from './contract-major.js';
import { createLogger } from '../observability/logger.js';

type ProbeName = 'postgres' | 'redis';
type Probe = () => Promise<void>;

function createProbes(override: Partial<Record<ProbeName, Probe>> = {}) {
  return {
    postgres: vi.fn(override.postgres ?? (async () => undefined)),
    redis: vi.fn(override.redis ?? (async () => undefined)),
  };
}

function createTestApp({
  probeTimeoutMs = 1_000,
  probes = createProbes(),
  contractMajor = SUPPORTED_SCHEMA_MAJOR,
} = {}) {
  const config = {
    serviceName: 'hookops-api' as const,
    serviceVersion: '1.0.0',
    contractMajor,
    probeTimeoutMs,
  };

  return {
    app: buildApp(config, createLogger(config), probes),
    probes,
  };
}

describe('health routes', () => {
  it('liveness', async () => {
    const { app, probes } = createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/health/live',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: 'live',
      });
      expect(probes.postgres).not.toHaveBeenCalled();
      expect(probes.redis).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('readiness_when_dependencies_ healthy)', async () => {
    const { app, probes } = createTestApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: 'ready',
        components: {
          contract: {
            status: 'compatible',
          },
          postgres: {
            status: 'healthy',
          },
          redis: {
            status: 'healthy',
          },
        },
      });
      expect(probes.postgres).toHaveBeenCalledOnce();
      expect(probes.redis).toHaveBeenCalledOnce();
    } finally {
      await app.close();
    }
  });

  it.each(['postgres', 'redis'] as const)(
    'readiness_when_%s_unavailable',
    async (unavailableDependency) => {
      const secret = 'postgresql://user:do-not-log@example.test/database';
      const probes = createProbes({
        [unavailableDependency]: async () => {
          throw new Error(secret);
        },
      });
      const { app } = createTestApp({ probes });

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/health/ready',
        });

        expect(response.statusCode).toBe(503);
        expect(response.json()).toEqual({
          status: 'not_ready',
          components: {
            contract: {
              status: 'compatible',
            },
            postgres: {
              status: unavailableDependency === 'postgres' ? 'unavailable' : 'healthy',
            },
            redis: {
              status: unavailableDependency === 'redis' ? 'unavailable' : 'healthy',
            },
          },
        });
        expect(response.body).not.toContain(secret);
        expect(response.body).not.toContain('do-not-log');
      } finally {
        await app.close();
      }
    },
  );

  it('bounds_dependency_probe_time', async () => {
    vi.useFakeTimers();

    const neverCompletes = () => new Promise<void>(() => undefined);
    const probes = createProbes({
      postgres: neverCompletes,
    });

    const { app } = createTestApp({
      probes,
      probeTimeoutMs: 50,
    });

    try {
      await app.ready();

      const responsePromise = app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      await vi.advanceTimersByTimeAsync(50);

      const response = await responsePromise;

      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({
        status: 'not_ready',
        components: {
          contract: {
            status: 'compatible',
          },
          postgres: {
            status: 'unavailable',
          },
          redis: {
            status: 'healthy',
          },
        },
      });
    } finally {
      vi.useRealTimers();
      await app.close();
    }
  });
});

describe('contract-major readiness', () => {
  it('readiness_on_contract_major_mismatch', async () => {
    const { app, probes } = createTestApp({ contractMajor: SUPPORTED_SCHEMA_MAJOR + 1 });
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({
        status: 'not_ready',
        components: {
          contract: {
            status: 'incompatible',
          },
        },
      });
      expect(probes.postgres).not.toHaveBeenCalled();
      expect(probes.redis).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('allows readiness when contract majors match', async () => {
    const app = createTestApp().app;

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: 'ready',
        components: {
          contract: {
            status: 'compatible',
          },
          postgres: {
            status: 'healthy',
          },
          redis: {
            status: 'healthy',
          },
        },
      });
    } finally {
      await app.close();
    }
  });

  it('logs only bounded metadata for a mismatch', () => {
    const logger = {
      error: vi.fn(),
    };

    assessContractMajor(SUPPORTED_SCHEMA_MAJOR + 1, logger);
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(
      {
        event: 'contract_major_mismatch',
        configuredContractMajor: SUPPORTED_SCHEMA_MAJOR + 1,
        compiledContractMajor: SUPPORTED_SCHEMA_MAJOR,
      },
      'Configured contract major does not match compiled contract major',
    );
  });
});
