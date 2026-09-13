import { describe, it, expect } from 'vitest';
import { SUPPORTED_SCHEMA_MAJOR } from '@fredieposh/hookops-shared';
import { loadConfig } from './index.js';

const validEnvironment: NodeJS.ProcessEnv = {
  HOST: '127.0.0.1',
  PORT: '3000',
  GIT_COMMIT_SHA: '0123456789abcdef0123456789abcdef01234567',
  CONTRACT_MAJOR: String(SUPPORTED_SCHEMA_MAJOR),
  PROBE_TIMEOUT_MS: '1000',
  DATABASE_URL: 'postgresql://hookops:secret@localhost:5432/hookops',
  REDIS_URL: 'redis://localhost:6379',
};

describe('loadConfig', () => {
  it('pareses validated startup configuration', () => {
    const config = loadConfig(validEnvironment);

    expect(config).toEqual({
      serviceName: 'hookops-api',
      serviceVersion: '1.0.0',
      gitCommitSha: validEnvironment.GIT_COMMIT_SHA,
      contractMajor: SUPPORTED_SCHEMA_MAJOR,
      probeTimeoutMs: 1000,
      host: '127.0.0.1',
      port: 3000,
      dependencies: {
        postgresUrl: validEnvironment.DATABASE_URL,
        redisUrl: validEnvironment.REDIS_URL,
      },
    });
  });

  it('uses safe local defaults', () => {
    const config = loadConfig({
      DATABASE_URL: validEnvironment.DATABASE_URL,
      REDIS_URL: validEnvironment.REDIS_URL,
    });

    expect(config).toMatchObject({
      host: '0.0.0.0',
      port: 3000,
      probeTimeoutMs: 1000,
      gitCommitSha: 'unknown',
      contractMajor: SUPPORTED_SCHEMA_MAJOR,
    });
  });

  it.each([
    ['PORT', 'invalid'],
    ['CONTRACT_MAJOR', 'invalid'],
    ['PROBE_TIMEOUT_MS', 'invalid'],
    ['DATABASE_URL', 'http://localhost'],
    ['REDIS_URL', 'http://localhost'],
  ])('rejects invalid %s', (name, value) => {
    expect(() => {
      loadConfig({
        ...validEnvironment,
        [name]: value,
      });
    }).toThrow(name);
  });

  it('does not include dependency URLs in errors', () => {
    const secretURL = 'https://user:do-not-log@localhost/database';

    let caughtError;

    try {
      loadConfig(
        {
          ...validEnvironment,
          DATABASE_URL: secretURL,
        },
        '1.0.0',
      );
    } catch (error) {
      caughtError = error;
    }

    if (!(caughtError instanceof Error)) {
      throw new Error('Expected loadConfig to throw an Error');
    }

    expect(caughtError.message).toContain('DATABASE_URL');
    expect(caughtError.message).not.toContain(secretURL);
    expect(caughtError.message).not.toContain('do-not-log');
  });
});
