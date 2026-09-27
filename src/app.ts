import Fastify, { LogController } from 'fastify';
import type { AppConfig } from './config/index.js';
import {
  registerCorrelationHook,
  resolveRequestCorrelationId,
} from './observability/request-correlation.js';
import { assessContractMajor } from './health/contract-major.js';
import pino from 'pino';
import { checkDependencies, type DependencyProbes } from './health/dependency-probes.js';

type AppStartupConfig = Pick<
  AppConfig,
  'serviceVersion' | 'gitCommitSha' | 'contractMajor' | 'probeTimeoutMs'
>;

export function buildApp(config: AppStartupConfig, logger: pino.Logger, probes: DependencyProbes) {
  const app = Fastify({
    loggerInstance: logger,
    requestIdHeader: false,
    genReqId: resolveRequestCorrelationId,
    logController: new LogController({
      requestIdLogLabel: 'correlationId',
    }),
  });

  registerCorrelationHook(app);
  const contract = assessContractMajor(config.contractMajor, app.log);
  const probeTimeoutMs = config.probeTimeoutMs ?? 1_000;

  const versionMetadata = {
    version: config.serviceVersion,
    commitSha: config.gitCommitSha,
    contractMajor: contract.compiledMajor,
  };

  if (probes.close) {
    app.addHook('onClose', async () => {
      await probes.close?.();
    });
  }

  app.get('/health/live', () => {
    return { status: 'live' };
  });

  app.get('/health/ready', async (_request, reply) => {
    if (!contract.compatible) {
      return reply.code(503).send({
        status: 'not_ready',
        components: {
          contract: {
            status: 'incompatible',
          },
        },
      });
    }

    const dependencies = await checkDependencies(probes, probeTimeoutMs);
    const ready = dependencies.postgres === 'healthy' && dependencies.redis === 'healthy';

    return reply.code(ready ? 200 : 503).send({
      status: ready ? 'ready' : 'not_ready',
      components: {
        contract: {
          status: 'compatible',
        },
        postgres: {
          status: dependencies.postgres,
        },
        redis: {
          status: dependencies.redis,
        },
      },
    });
  });

  app.get('/version', () => {
    return versionMetadata;
  });

  return app;
}
