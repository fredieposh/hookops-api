import {
  PINO_REDACTION_CENSOR,
  SUPPORTED_SCHEMA_MAJOR,
  isValidCorrelationId,
} from '@fredieposh/hookops-shared';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { createLogger } from './logger.js';
import { CORRELATION_ID_HEADER } from './request-correlation.js';

const config = {
  serviceName: 'hookops-api' as const,
  serviceVersion: '1.0.0',
  contractMajor: SUPPORTED_SCHEMA_MAJOR,
  probeTimeoutMs: 1_000,
};

const probes = {
  postgres: vi.fn(),
  redis: vi.fn(),
};

function createCapturedApp() {
  let output = '';
  const destination = {
    write: (message: string): void => {
      output += message;
    },
  };

  const app = buildApp(config, createLogger(config, destination), probes);

  app.post('/test/log-request', (request) => {
    request.log.info(
      {
        headers: request.headers,
        body: request.body,
      },
      'fixture request',
    );

    return { status: 'ok' };
  });

  return {
    app,
    readOutput: () => output,
  };
}

describe('request correlation', () => {
  it('correlation_and_redaction', async () => {
    const { app, readOutput } = createCapturedApp();
    const correlationId = 'client-request-123';

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/test/log-request',
        headers: {
          [CORRELATION_ID_HEADER]: correlationId,
          authorization: 'Bearer authorization-secret',
        },
        payload: {
          password: 'password-secret',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers[CORRELATION_ID_HEADER]).toBe(correlationId);

      const output = readOutput();
      const entries = output
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as Record<string, unknown>);

      const loggedCorrelationIds = entries.flatMap((entry) =>
        typeof entry.correlationId === 'string' ? entry.correlationId : [],
      );

      expect(loggedCorrelationIds.length).toBeGreaterThan(0);
      expect(new Set(loggedCorrelationIds)).toEqual(new Set([correlationId]));

      expect(output).toContain(PINO_REDACTION_CENSOR);
      expect(output).not.toContain('authorization-secret');
      expect(output).not.toContain('password-secret');
    } finally {
      await app.close();
    }
  });

  it('replace an invalid incomeing correlationID', async () => {
    const { app, readOutput } = createCapturedApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/test/log-request',
        headers: {
          [CORRELATION_ID_HEADER]: 'invalid id with spaces',
        },
      });

      const correlationId = response.headers[CORRELATION_ID_HEADER];

      expect(typeof correlationId).toBe('string');
      expect(isValidCorrelationId(correlationId)).toBe(true);
      expect(correlationId).not.toBe('invalid id with spaces');
      expect(readOutput()).toContain(`"correlationId":"${correlationId}"`);
    } finally {
      await app.close();
    }
  });
});
