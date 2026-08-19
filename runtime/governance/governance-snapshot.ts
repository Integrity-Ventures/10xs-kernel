/**
 * Static Governance Snapshot Generator (v3.5D)
 *
 * Produces GOVERNANCE_PROFILE and KERNEL_VERSION snapshots
 * from the kernel spec. Pure functions — no I/O, no side effects.
 *
 * @module 10xs/kernel-runtime/governance/governance-snapshot
 */

import {
  resolveExecutionContract,
  type ResolveOptions,
  type CoreRulesDefinition,
} from "../adapter/kernelAdapter";
import { getVersionMetadata } from "../version/kernelVersion";
import { computeGovernanceHash } from "../generator/hash-utils";

/** Static kernel governance profile snapshot */
export interface GovernanceProfile {
  /** Static marker — kernel governance snapshot, not a compiled profile */
  profileType: "kernel-static";
  /** Version metadata from kernel-spec/version.yaml */
  versions: {
    kernelVersion: string;
    artifactVersion: string;
    generatorVersion: string;
  };
  /** SHA-256 hash of the resolved rule set (16 hex chars) */
  governanceHash: string;
  /** ISO 8601 timestamp of generation */
  generatedAt: string;
  /** Full resolved governance rules from core.yaml */
  rules: {
    microtask: Record<string, unknown>;
    story: Record<string, unknown>;
    epic: Record<string, unknown>;
    decomposition: Record<string, unknown>;
  };
}

/** Kernel version snapshot with governance integrity hash */
export interface KernelVersionSnapshot {
  kernelVersion: string;
  artifactVersion: string;
  generatorVersion: string;
  /** SHA-256 hash of current governance rules */
  governanceHash: string;
  /** ISO 8601 timestamp of generation */
  generatedAt: string;
}

interface SnapshotOptions {
  resolveOptions?: ResolveOptions;
  now?: Date;
}

/** Resolve rules and compute hash (shared by both generators) */
function resolveWithHash(
  opts?: SnapshotOptions,
): { rules: CoreRulesDefinition; hash: string; timestamp: string } {
  const rules = resolveExecutionContract(opts?.resolveOptions);
  const hash = computeGovernanceHash(rules as unknown as Record<string, unknown>);
  const timestamp = (opts?.now ?? new Date()).toISOString();
  return { rules, hash, timestamp };
}

/** Generate a GOVERNANCE_PROFILE.yaml-compatible snapshot */
export function generateGovernanceProfile(
  options?: SnapshotOptions,
): GovernanceProfile {
  const { rules, hash, timestamp } = resolveWithHash(options);
  const versions = getVersionMetadata();

  return {
    profileType: "kernel-static",
    versions,
    governanceHash: hash,
    generatedAt: timestamp,
    rules: {
      microtask: { ...rules.microtask },
      story: { ...rules.story },
      epic: { ...rules.epic },
      decomposition: { ...rules.decomposition },
    },
  };
}

/** Generate a KERNEL_VERSION.json-compatible snapshot */
export function generateKernelVersionJson(
  options?: SnapshotOptions,
): KernelVersionSnapshot {
  const { hash, timestamp } = resolveWithHash(options);
  const versions = getVersionMetadata();

  return {
    ...versions,
    governanceHash: hash,
    generatedAt: timestamp,
  };
}
