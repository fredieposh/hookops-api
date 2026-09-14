import Fastify from 'fastify';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { type AppConfig } from './config/index.js';
import { assessContractMajor } from './health/contract-major.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type AppStartupConfig = Pick<AppConfig, 'contractMajor'>;

export function buildApp(config: AppStartupConfig) {
  const app = Fastify({ logger: true });
  const contract = assessContractMajor(config.contractMajor, app.log);

  app.get('/health', () => {
    return { status: 'ok' };
  });

  app.get('/health/ready', (_request, reply) => {
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

    return reply.code(200).send({
      status: 'ready',
      components: {
        contract: {
          status: 'compatible',
        },
      },
    });
  });

  app.get('/version', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
    return { version: pkg.version };
  });

  return app;
}
