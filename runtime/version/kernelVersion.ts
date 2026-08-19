/**
 * 10xs Governance Kernel — Version Constants
 * All generated artifacts must embed these for compatibility tracking.
 *
 * Version values loaded from kernel-spec/version.yaml (not hardcoded).
 *
 * @module 10xs/kernel-runtime/version
 */

import { loadYamlSpec } from "../loader";

/** Version spec structure from YAML */
interface VersionSpec {
  kernel: string;
  artifact: string;
  generator: string;
}

/** Cache for loaded version spec (load once, reuse) */
let _cachedVersion: VersionSpec | null = null;

/** Load version spec from YAML (cached) */
function getVersionSpec(): VersionSpec {
  if (!_cachedVersion) {
    _cachedVersion = loadYamlSpec<VersionSpec>("version.yaml");
  }
  return _cachedVersion;
}

/** Kernel governance version — bumped on rule/constraint changes */
export const KERNEL_VERSION = getVersionSpec().kernel;

/** Agile hierarchy schema version — bumped on schema structure changes */
export const ARTIFACT_SCHEMA_VERSION = getVersionSpec().artifact;

/** Generator compatibility version — bumped on decomposition logic changes */
export const GENERATOR_VERSION = getVersionSpec().generator;

/** Version metadata bundle for embedding in generated artifacts */
export interface VersionMetadata {
  kernelVersion: string;
  artifactVersion: string;
  generatorVersion: string;
}

/** Get current version metadata for artifact embedding */
export function getVersionMetadata(): VersionMetadata {
  return {
    kernelVersion: KERNEL_VERSION,
    artifactVersion: ARTIFACT_SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION,
  };
}
