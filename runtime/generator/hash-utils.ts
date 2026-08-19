/**
 * Hash utilities for ExecutionContract integrity and governance audit trail.
 *
 * Uses Node.js crypto (Lambda-compatible). Never use window.crypto.
 *
 * @module 10xs/kernel-runtime/generator/hash-utils
 */

import { createHash } from "crypto";

/** Compute SHA-256 hash of governance rules (stamps contract with rules version). */
export function computeGovernanceHash(
  rules: Record<string, unknown>,
): string {
  const canonical = JSON.stringify(rules, Object.keys(rules).sort());
  return createHash("sha256").update(canonical).digest("hex").substring(0, 16);
}

/** Compute SHA-256 hash of contract content (integrity verification). */
export function computeContractHash(
  contract: Record<string, unknown>,
): string {
  const { contractHash: _, ...rest } = contract;
  const canonical = JSON.stringify(rest, Object.keys(rest).sort());
  return createHash("sha256").update(canonical).digest("hex").substring(0, 16);
}

/** Generate deterministic contract ID from microtask ID + revision. */
export function generateContractId(
  microtaskId: string,
  revision: number,
): string {
  return `EC-${microtaskId}-R${String(revision).padStart(3, "0")}`;
}
