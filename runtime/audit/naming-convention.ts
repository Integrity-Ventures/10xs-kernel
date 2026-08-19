/**
 * Audit trail naming convention — Blueprint v3.5 §8.
 *
 * File naming format: {microtaskId}__{contractId}.extension
 * Example: MT-017-123__EC-MT-017-123-R001.md
 *
 * @module 10xs/kernel-runtime/audit/naming-convention
 */

import type { ExecutionContractV1 } from "../schemas/execution-contract";

const SEPARATOR = "__";

/** Default repo-relative path prefix for audit trail artifacts. */
const DEFAULT_AUDIT_PREFIX = "10xs/execution";

/** Build canonical contract file name (without directory prefix). */
export function contractFileName(contract: ExecutionContractV1): string {
  return `${contract.microtaskId}${SEPARATOR}${contract.executionContractId}.md`;
}

/** Build canonical completion report file name. */
export function reportFileName(contract: ExecutionContractV1): string {
  return `${contract.microtaskId}${SEPARATOR}${contract.executionContractId}${SEPARATOR}REPORT.md`;
}

/** Build canonical validation result file name. */
export function validationFileName(contract: ExecutionContractV1): string {
  return `${contract.microtaskId}${SEPARATOR}${contract.executionContractId}${SEPARATOR}VALIDATION.json`;
}

/** Build full repo-relative path for a contract artifact. */
export function contractPath(contract: ExecutionContractV1): string {
  return `${DEFAULT_AUDIT_PREFIX}/contracts/${contractFileName(contract)}`;
}

/** Build full repo-relative path for a completion report. */
export function reportPath(contract: ExecutionContractV1): string {
  return `${DEFAULT_AUDIT_PREFIX}/reports/${reportFileName(contract)}`;
}

/** Build full repo-relative path for a validation result. */
export function validationPath(contract: ExecutionContractV1): string {
  return `${DEFAULT_AUDIT_PREFIX}/validations/${validationFileName(contract)}`;
}
