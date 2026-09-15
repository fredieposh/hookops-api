import { PINO_REDACTION_CENSOR, SUPPORTED_SCHEMA_MAJOR } from '@fredieposh/hookops-shared';
import { describe, expect, it } from 'vitest';
import { createLogger } from './logger.js';

describe('createLogger', () => {
  it('adds service metadata and applies shared redaction', () => {
    let output = '';

    const destination = {
      write(message: string): void {
        output += message;
      },
    };

    const logger = createLogger(
      {
        serviceName: 'hookops-api',
        serviceVersion: '1.0.0',
        contractMajor: SUPPORTED_SCHEMA_MAJOR,
      },
      destination,
    );

    logger.info(
      {
        req: {
          headers: {
            authorization: 'Bearer authorization-token',
          },
          body: {
            password: 'password-secret',
          },
        },
      },
      'test-request',
    );

    const entry = JSON.parse(output) as Record<string, unknown>;

    expect(entry).toMatchObject({
      service: 'hookops-api',
      version: '1.0.0',
      msg: 'test-request',
      req: {
        headers: {
          authorization: PINO_REDACTION_CENSOR,
        },
        body: {
          password: PINO_REDACTION_CENSOR,
        },
      },
    });

    expect(output).not.toContain('authorization-secret');
    expect(output).not.toContain('password-secret');
  });
});
