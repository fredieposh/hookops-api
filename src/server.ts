import { buildApp } from './app.js';
import { loadConfig } from './config/index.js';
import { createLogger } from './observability/logger.js';
import { createDependecyProbes } from './health/dependency-probes.js';
import { serveUntilShutdown } from './server-lifecycle.js';

const config = loadConfig();
const logger = createLogger(config);
const probes = createDependecyProbes(config, logger);
const app = buildApp(config, logger, probes);

try {
  const signal = await serveUntilShutdown(app, {
    host: config.host,
    port: config.port,
  });

  app.log.info(
    {
      event: 'http_server_stopped',
      signal,
    },
    'HTTP server stopped gracefully',
  );
} catch (error) {
  app.log.error(
    {
      event: 'http_server_failure',
      err: error,
    },
    'HTTP server stopped unexpectedly',
  );
}
