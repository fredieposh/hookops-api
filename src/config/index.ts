import * as fs from 'node:fs';
import { SUPPORTED_SCHEMA_MAJOR } from '@fredieposh/hookops-shared';

export interface AppConfig {
  readonly serviceName: 'hookops-api';
  readonly serviceVersion: string;
  readonly gitCommitSha: string;
  readonly contractMajor: number;
  readonly probeTimeoutMs: number;
  readonly host: string;
  readonly port: number;
  readonly dependencies: {
    readonly postgresUrl: string;
    readonly redisUrl: string;
  };
}

function invalidConfiguration(name: string): never {
  throw new Error(`Invalid configuration: ${name}`);
}

const packageJson = JSON.parse(
  fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string };

function parseNumber(name: string, value: string, min: number, max: number): number {
  const parsed = Number(value);

  if (value.trim() === '' || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    invalidConfiguration(name);
  }

  return parsed;
}

function parseUrl(name: string, value: string | undefined, protocols: readonly string[]): string {
  if (!value) {
    invalidConfiguration(name);
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    invalidConfiguration(name);
  }

  if (!protocols.includes(url.protocol) || !url.hostname) {
    invalidConfiguration(name);
  }

  return value;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
  serviceVersion = packageJson.version,
): AppConfig {
  const host = environment.HOST ?? '0.0.0.0';
  const gitCommitSha = environment.GIT_COMMIT_SHA ?? 'unknown';

  if (!host.trim()) {
    invalidConfiguration('HOST');
  }

  if (gitCommitSha !== 'unknown' && !/^[0-9a-f]{7,64}$/i.test(gitCommitSha)) {
    invalidConfiguration('GIT_COMMIT_SHA');
  }

  const serviceName = 'hookops-api';
  const contractMajor = parseNumber(
    'CONTRACT_MAJOR',
    environment.CONTRACT_MAJOR ?? String(SUPPORTED_SCHEMA_MAJOR),
    0,
    Number.MAX_SAFE_INTEGER,
  );
  const probeTimeoutMs = parseNumber(
    'PROBE_TIMEOUT_MS',
    environment.PROBE_TIMEOUT_MS ?? '1000',
    1,
    10_000,
  );
  const port = parseNumber('PORT', environment.PORT ?? '3000', 1, 65_535);
  const postgresUrl = parseUrl('DATABASE_URL', environment.DATABASE_URL, [
    'postgres:',
    'postgresql:',
  ]);
  const redisUrl = parseUrl('REDIS_URL', environment.REDIS_URL, ['redis:', 'rediss:']);

  return {
    serviceName,
    serviceVersion,
    gitCommitSha,
    contractMajor,
    probeTimeoutMs,
    host,
    port,
    dependencies: {
      postgresUrl,
      redisUrl,
    },
  };
}
