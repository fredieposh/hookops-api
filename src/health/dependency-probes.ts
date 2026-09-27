import type { Logger } from 'pino';
import { Pool } from 'pg';
import { createClient } from 'redis';
import type { AppConfig } from '../config/index.js';

export type DependencyStatus = 'healthy' | 'unavailable';

type Probe = () => Promise<void>;

export interface DependencyProbes {
  readonly postgres: Probe;
  readonly redis: Probe;
  readonly close?: () => Promise<void>;
}

export interface DependencyStatuses {
  readonly postgres: DependencyStatus;
  readonly redis: DependencyStatus;
}

async function runBoundedProbe(probe: Probe, timeoutMs: number): Promise<DependencyStatus> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      Promise.resolve().then(probe),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Dependency Probe timed out')), timeoutMs);
      }),
    ]);

    return 'healthy';
  } catch {
    return 'unavailable';
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function checkDependencies(
  probes: DependencyProbes,
  timeoutMs: number,
): Promise<DependencyStatuses> {
  const [postgres, redis] = await Promise.all([
    runBoundedProbe(probes.postgres, timeoutMs),
    runBoundedProbe(probes.redis, timeoutMs),
  ]);

  return {
    postgres,
    redis,
  };
}

export function createDependecyProbes(
  config: Pick<AppConfig, 'dependencies' | 'probeTimeoutMs'>,
  logger: Logger,
): DependencyProbes {
  const postgres = new Pool({
    connectionString: config.dependencies.postgresUrl,
    max: 1,
    connectionTimeoutMillis: config.probeTimeoutMs,
    query_timeout: config.probeTimeoutMs,
  });

  const redis = createClient({
    url: config.dependencies.redisUrl,
    socket: {
      connectTimeout: config.probeTimeoutMs,
      reconnectStrategy: false,
    },
  });

  postgres.on('error', () => {
    logger.warn(
      {
        event: 'dependency_client_error',
        component: postgres,
      },
      'PostgreSQL client reported an error',
    );
  });

  redis.on('error', () => {
    logger.warn(
      {
        event: 'dependency_client_error',
        component: postgres,
      },
      'Redis client reported an error',
    );
  });

  return {
    postgres: async () => {
      await postgres.query('SELECT 1');
    },
    redis: async () => {
      if (!redis.isOpen) {
        await redis.connect();
      }

      const response = await redis.sendCommand<string>(['PING'], {
        timeout: config.probeTimeoutMs,
      });

      if (response !== 'PONG') {
        throw new Error('Unexpected redis PING response');
      }
    },
    close: async () => {
      await Promise.allSettled([postgres.end(), redis.isOpen ? redis.close() : Promise.resolve()]);
    },
  };
}
