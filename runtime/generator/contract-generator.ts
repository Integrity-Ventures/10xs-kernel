/**
 * Contract Generation Engine — produces ExecutionContractV1 from a microtask.
 *
 * Derives scope, acceptance checklist, enforcement summary, and computes
 * deterministic hashes for contract integrity and governance audit trail.
 *
 * @module 10xs/kernel-runtime/generator/contract-generator
 */

import type { Microtask } from "../schemas/agile-hierarchy";
import type { ExecutionContractV1 } from "../schemas/execution-contract";
import { ExecutionContractV1Schema } from "../schemas/execution-contract";
import {
  resolveExecutionContract,
  getKernelVersion,
  type ResolveOptions,
} from "../adapter/kernelAdapter";
import {
  computeGovernanceHash,
  computeContractHash,
  generateContractId,
} from "./hash-utils";

export interface GenerateContractOptions {
  resolveOptions?: ResolveOptions;
  revision?: number;
  supersedesContractId?: string | null;
}

/** Generate an ExecutionContractV1 from a microtask and active governance rules. */
export function generateExecutionContract(
  microtask: Microtask,
  options?: GenerateContractOptions,
): ExecutionContractV1 {
  const revision = options?.revision ?? 1;
  const contract = resolveExecutionContract(options?.resolveOptions);
  const version = getKernelVersion();
  const rules = contract.microtask;

  const governanceHash = computeGovernanceHash(
    contract as unknown as Record<string, unknown>,
  );

  const definition = buildDefinition(microtask, rules);

  const contractData = {
    executionContractId: generateContractId(microtask.id, revision),
    microtaskId: microtask.id,
    blueprintVersion: "3.5" as const,
    governanceHash,
    kernelVersion: version.kernelVersion,
    contractHash: "",
    revision,
    supersedesExecutionContractId: options?.supersedesContractId ?? null,
    definition,
    reportingTemplate: {},
    validation: {},
    createdAt: new Date().toISOString(),
  };

  contractData.contractHash = computeContractHash(
    contractData as unknown as Record<string, unknown>,
  );

  return ExecutionContractV1Schema.parse(contractData);
}

/** Build contract definition from microtask + kernel rules. */
function buildDefinition(
  microtask: Microtask,
  rules: { maxHours: number; maxFiles: number; maxDependencies: number; requiresTestingStrategy: boolean },
) {
  return {
    scopeSummary: `${microtask.title}: ${microtask.description}`,
    allowedBoundaries: microtask.targetFiles,
    requiredTests: [`Testing strategy: ${microtask.testingStrategy}`],
    namingConstraints: [],
    acceptanceChecklist: microtask.acceptanceCriteria,
    enforcementSummary: [
      `Max hours: ${rules.maxHours}`,
      `Max files: ${rules.maxFiles}`,
      `Max dependencies: ${rules.maxDependencies}`,
      `Testing required: ${rules.requiresTestingStrategy}`,
    ].join(" | "),
  };
}
