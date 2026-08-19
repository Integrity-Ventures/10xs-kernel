/**
 * Governance Pack Assembly + Integrity Hash (v3.5D-03)
 *
 * Assembles all governance pack artifacts into a single exportable
 * bundle with a SHA-256 integrity hash. Top-level entry point per
 * CTO Decision 3.
 *
 * Pure function — no I/O, no side effects.
 *
 * @module 10xs/kernel-runtime/governance/governance-pack
 */

import { createHash } from "crypto";
import {
  generateGovernanceProfile,
  generateKernelVersionJson,
} from "./governance-snapshot";
import {
  exportExecutionContractSchema,
  exportReportingSchema,
} from "./schema-exporter";
import type { ResolveOptions } from "../adapter/kernelAdapter";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const jsYaml = require("js-yaml") as { dump: (obj: unknown) => string };

/** Single file within the governance pack */
export interface GovernancePackFile {
  /** Relative path within 10xs/governance/ */
  path: string;
  /** File content as string (YAML or JSON) */
  content: string;
}

/** Complete governance pack bundle with integrity hash */
export interface GovernancePack {
  /** Pack format version */
  packVersion: "1.0.0";
  /** ISO 8601 timestamp of generation */
  generatedAt: string;
  /** SHA-256 integrity hash over all file contents (16 hex chars) */
  integrityHash: string;
  /** Governance hash from kernel rules */
  governanceHash: string;
  /** Version metadata */
  versions: {
    kernelVersion: string;
    artifactVersion: string;
    generatorVersion: string;
  };
  /** All files in the governance pack */
  files: GovernancePackFile[];
}

export interface GeneratePackOptions {
  resolveOptions?: ResolveOptions;
  now?: Date;
}

/**
 * Return a shallow copy of a snapshot without its provenance `generatedAt` field.
 *
 * finding D-1: `generatedAt` is a per-call wall-clock timestamp. It is provenance
 * METADATA (surfaced out-of-band as `pack.generatedAt`), NOT part of what the pack
 * *is*. Baking it into the serialized GOVERNANCE_PROFILE.yaml / KERNEL_VERSION.json
 * bodies made `integrityHash` drift on every export (the tree-hash-vs-commit-hash
 * mistake). Stripping it from the bodies makes the hash a content-only provenance
 * stamp; the timestamp still survives on the pack object below.
 */
function stripGeneratedAt<T extends { generatedAt: string }>(
  snapshot: T,
): Omit<T, "generatedAt"> {
  const copy = { ...snapshot };
  delete (copy as { generatedAt?: string }).generatedAt;
  return copy;
}

/** Compute SHA-256 integrity hash over all pack file contents */
function computePackIntegrityHash(files: GovernancePackFile[]): string {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const content = sorted.map((f) => `${f.path}:${f.content}`).join("\n");
  return createHash("sha256").update(content).digest("hex").substring(0, 16);
}

/** Assemble all governance pack artifacts into a single bundle */
export function generateGovernancePack(
  options?: GeneratePackOptions,
): GovernancePack {
  const passthrough = {
    resolveOptions: options?.resolveOptions,
    now: options?.now,
  };

  const profile = generateGovernanceProfile(passthrough);
  const kernelVersion = generateKernelVersionJson(passthrough);
  const contractSchema = exportExecutionContractSchema({ now: options?.now });
  const reportingSchema = exportReportingSchema({ now: options?.now });

  // finding D-1: serialize the snapshot bodies WITHOUT `generatedAt` so the
  // integrityHash is time-invariant. The timestamp survives as pack.generatedAt below.
  const files: GovernancePackFile[] = [
    { path: "GOVERNANCE_PROFILE.yaml", content: jsYaml.dump(stripGeneratedAt(profile)) },
    { path: "KERNEL_VERSION.json", content: JSON.stringify(stripGeneratedAt(kernelVersion), null, 2) },
    { path: "SCHEMAS/execution_contract_schema.json", content: JSON.stringify(contractSchema.schema, null, 2) },
    { path: "SCHEMAS/reporting_schema.json", content: JSON.stringify(reportingSchema.schema, null, 2) },
  ];

  return {
    packVersion: "1.0.0",
    generatedAt: profile.generatedAt,
    integrityHash: computePackIntegrityHash(files),
    governanceHash: profile.governanceHash,
    versions: { ...profile.versions },
    files,
  };
}
