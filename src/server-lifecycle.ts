import { FastifyListenOptions } from 'fastify';

export type ShutdownSignal = 'SIGTERM' | 'SIGINT';

export interface ShutdownSignalSource {
  once(signal: ShutdownSignal, listener: () => void): unknown;
  removeListener(signal: ShutdownSignal, listener: () => void): unknown;
}

interface ManagedServer {
  listen(options: FastifyListenOptions): Promise<unknown>;
  close(): Promise<void>;
}

function waitForShutdownSignal(source: ShutdownSignalSource) {
  let active = true;
  let resolveSignal!: (signal: ShutdownSignal) => void;

  const promise = new Promise<ShutdownSignal>((resolve) => {
    resolveSignal = resolve;
  });

  function cleanup(): void {
    source.removeListener('SIGTERM', onSigterm);
    source.removeListener('SIGINT', onSigint);
  }

  function finish(signal: ShutdownSignal): void {
    if (!active) {
      return;
    }

    active = false;
    cleanup();
    resolveSignal(signal);
  }

  function onSigterm(): void {
    finish('SIGTERM');
  }

  function onSigint(): void {
    finish('SIGINT');
  }

  source.once('SIGTERM', onSigterm);
  source.once('SIGINT', onSigint);

  return {
    promise,
    cancel(): void {
      if (!active) {
        return;
      }

      active = false;
      cleanup();
    },
  };
}

export async function serveUntilShutdown(
  server: ManagedServer,
  listenOptions: FastifyListenOptions,
  signalSource: ShutdownSignalSource = process,
): Promise<ShutdownSignal> {
  const shutdown = waitForShutdownSignal(signalSource);

  try {
    await server.listen(listenOptions);
    return await shutdown.promise;
  } finally {
    shutdown.cancel();
    await server.close();
  }
}
