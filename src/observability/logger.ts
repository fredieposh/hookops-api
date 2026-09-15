import { PINO_REDACTION_CENSOR, createPinoRedactionPaths } from '@fredieposh/hookops-shared';
import pino from 'pino';
import type { AppConfig } from '../config/index.js';

export type LoggerConfig = Pick<AppConfig, 'serviceName' | 'serviceVersion' | 'contractMajor'>;

export function createLogger(
  config: LoggerConfig,
  destination?: pino.DestinationStream,
): pino.Logger {
  const options: pino.LoggerOptions = {
    base: {
      service: config.serviceName,
      version: config.serviceVersion,
    },
    redact: {
      paths: createPinoRedactionPaths(),
      censor: PINO_REDACTION_CENSOR,
    },
  };

  return destination ? pino(options, destination) : pino(options);
}
