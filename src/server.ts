import { buildApp } from './app.js';
import { loadConfig } from './config/index.js';

const config = loadConfig();
const app = buildApp(config);

const start = async () => {
  try {
    await app.listen({
      port: config.port,
      host: config.host,
    });
  } catch (err) {
    app.log.error(err);
    process.exitCode = 1;
  }
};

process.on('SIGTERM', async () => {
  await app.close();
});

process.on('SIGINT', async () => {
  await app.close();
});

await start();
