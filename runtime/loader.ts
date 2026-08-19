/**
 * 10xs Governance Kernel — Spec File Loader
 *
 * Loads canonical governance spec files (YAML/JSON).
 * Runtime adapter uses this to hydrate rules from spec.
 *
 * @module 10xs/kernel-runtime/loader
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const jsYaml = require("js-yaml") as { load: (input: string) => unknown };

const SPEC_DIR = process.env.LAMBDA_TASK_ROOT
  ? resolve(process.env.LAMBDA_TASK_ROOT, "kernel-spec")
  : resolve(__dirname, "../kernel-spec");

/** Load and parse a YAML spec file */
export function loadYamlSpec<T>(relativePath: string): T {
  const fullPath = resolve(SPEC_DIR, relativePath);
  const content = readFileSync(fullPath, "utf-8");
  return jsYaml.load(content) as T;
}

/** Load and parse a JSON spec file */
export function loadJsonSpec<T>(relativePath: string): T {
  const fullPath = resolve(SPEC_DIR, relativePath);
  const content = readFileSync(fullPath, "utf-8");
  return JSON.parse(content) as T;
}
