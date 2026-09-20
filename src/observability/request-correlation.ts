import { resolveCorrelationId } from '@fredieposh/hookops-shared';
import type { AppFastifyInstance } from '../types/fastify.js';
import type { IncomingMessage } from 'node:http';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export function resolveRequestCorrelationId(request: IncomingMessage): string {
  return resolveCorrelationId(request.headers[CORRELATION_ID_HEADER]);
}

export function registerCorrelationHook(app: AppFastifyInstance): void {
  app.addHook('onRequest', (request, reply, done) => {
    reply.header(CORRELATION_ID_HEADER, request.id);
    done();
  });
}
