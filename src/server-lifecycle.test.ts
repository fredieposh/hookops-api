import { EventEmitter } from 'node:events';
import { SUPPORTED_SCHEMA_MAJOR } from '@fredieposh/hookops-shared';
import type { FastifyListenOptions } from 'fastify';
import { describe, it, vi, expect } from 'vitest';
import { createLogger } from './observability/logger.js';
import { serveUntilShutdown } from './server-lifecycle.js';
import { buildApp } from './app.js';

const listenOptions: FastifyListenOptions = {
  host: '127.0.0.1',
  port: 3000,
};

function createServerDouble() {
  return {
    listen: vi.fn(async () => '127.0.0.1:3000'),
    close: vi.fn(async () => undefined),
  };
}

describe('serveUnitShutdown', () => {
  it.each(['SIGTERM', 'SIGINT'] as const)('close the server after %s', async (signal) => {
    const server = createServerDouble();
    const signals = new EventEmitter();

    const running = serveUntilShutdown(server, listenOptions, signals);

    expect(server.listen).toHaveBeenCalledOnce();
    expect(server.listen).toHaveBeenCalledWith(listenOptions);

    signals.emit(signal);

    await expect(running).resolves.toBe(signal);
    expect(server.close).toHaveBeenCalledOnce();
    expect(signals.listenerCount('SIGTERM')).toBe(0);
    expect(signals.listenerCount('SIGINT')).toBe(0);
  });

  it('closes resources when startup fails', async () => {
    const startupError = new Error('address already in use');
    const server = createServerDouble();

    const signals = new EventEmitter();

    server.listen.mockRejectedValueOnce(startupError);
    await expect(serveUntilShutdown(server, listenOptions, signals)).rejects.toBe(startupError);

    expect(server.close).toHaveBeenCalledOnce();
    expect(signals.listenerCount('SIGTERM')).toBe(0);
    expect(signals.listenerCount('SIGINT')).toBe(0);
  });
});

describe('application shutdown', () => {
  it('closes dependency probes clients', async () => {
    const config = {
      serviceName: 'hookops-api' as const,
      serviceVersion: '1.0.0',
      gitCommitSha: '0123456789abcdef0123456789abcdef01234567',
      contractMajor: SUPPORTED_SCHEMA_MAJOR,
      probeTimeoutMs: 1_000,
    };

    const probes = {
      postgres: vi.fn(async () => undefined),
      redis: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };

    const app = buildApp(config, createLogger(config), probes);
    await app.ready();
    await app.close();

    expect(probes.close).toHaveBeenCalledOnce();
  });
});
