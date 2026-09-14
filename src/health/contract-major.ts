import { SUPPORTED_SCHEMA_MAJOR } from '@fredieposh/hookops-shared';

export interface ContractMajorStatus {
  readonly compatible: boolean;
  readonly configuredMajor: number;
  readonly compiledMajor: number;
}

export interface ContractMajorLogger {
  error(fields: Record<string, unknown>, message: string): void;
}

export function assessContractMajor(
  configuredMajor: number,
  logger: ContractMajorLogger,
): ContractMajorStatus {
  const status: ContractMajorStatus = {
    compatible: SUPPORTED_SCHEMA_MAJOR === configuredMajor,
    configuredMajor,
    compiledMajor: SUPPORTED_SCHEMA_MAJOR,
  };

  if (!status.compatible) {
    logger.error(
      {
        event: 'contract_major_mismatch',
        configuredContractMajor: status.configuredMajor,
        compiledContractMajor: status.compiledMajor,
      },
      'Configured contract major does not match compiled contract major',
    );
  }

  return status;
}
