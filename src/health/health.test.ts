import { SUPPORTED_SCHEMA_MAJOR } from '@fredieposh/hookops-shared';
import { describe, it, vi, expect } from 'vitest';
import { buildApp } from '../app.js';
import { assessContractMajor } from './contract-major.js';

describe('contract-major readiness', () => {
  it('readiness_on_contract_major_mismatch', async () => {
    const app = buildApp({ contractMajor: SUPPORTED_SCHEMA_MAJOR + 1 });
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
    } finally {
      await app.close();
    }
  });

  it('allows readiness when contract majors match', async () => {
    const app = buildApp({ contractMajor: SUPPORTED_SCHEMA_MAJOR });

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
