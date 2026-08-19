/**
 * 10xs Governance Kernel — Public API
 *
 * Import from '10xs/kernel-runtime' only. Never from internal modules.
 *
 * @module 10xs/kernel-runtime
 */

// Adapter (primary interface)
export {
  resolveExecutionContract,
  getExecutionUnitConstraints,
  getInstructionTemplate,
  getDecompositionPolicy,
  getBudgetCeiling,
  getKernelVersion,
  getEnforcementMode,
  type ExecutionContract,
  type ResolveOptions,
  type RuleOverrides,
  type InstructionTemplate,
  type BudgetPolicy,
} from "./adapter/kernelAdapter";

// Schemas (structural validation)
export {
  MicrotaskSchema,
  StorySchema,
  EpicSchema,
  Phase1ResultSchema,
  Phase2ResultSchema,
  validateMicrotaskAgainstContract,
  type Microtask,
  type Story,
  type Epic,
  type Phase1Result,
  type Phase2Result,
  type ContractViolation,
} from "./schemas/agile-hierarchy";

// Execution Contract schemas (v3.5)
export {
  ExecutionContractV1Schema,
  ValidationResultSchema,
  ReportingTemplateSchema,
  ContractDefinitionSchema,
  type ExecutionContractV1,
  type ValidationResult,
  type ReportingTemplate,
  type ContractDefinition,
} from "./schemas/execution-contract";

// Contract generation (v3.5)
export {
  generateExecutionContract,
  type GenerateContractOptions,
} from "./generator/contract-generator";

export {
  computeGovernanceHash,
  computeContractHash,
  generateContractId,
} from "./generator/hash-utils";

// Audit trail utilities (v3.5)
export {
  contractFileName,
  reportFileName,
  validationFileName,
  contractPath,
  reportPath,
  validationPath,
} from "./audit/naming-convention";

export { renderContractMarkdown } from "./audit/contract-renderer";
export { renderReportMarkdown } from "./audit/report-renderer";
export { renderValidationMarkdown } from "./audit/validation-renderer";

// Reporting layer (v3.5B)
export {
  generateCompletionReport,
  type CompletionReportResult,
  type ReportWarning,
  type GenerateReportOptions,
} from "./reporting/report-generator";

// Validation engine (v3.5C)
export {
  validateReport,
  type ValidationEngineResult,
  type ValidateReportOptions,
} from "./validation/validation-engine";

// Governance pack (v3.5D)
export {
  generateGovernanceProfile,
  generateKernelVersionJson,
  type GovernanceProfile,
  type KernelVersionSnapshot,
} from "./governance/governance-snapshot";

// Schema export (v3.5D-02)
export {
  exportExecutionContractSchema,
  exportReportingSchema,
  type SchemaExport,
} from "./governance/schema-exporter";

// Governance pack assembly (v3.5D-03)
export {
  generateGovernancePack,
  type GovernancePack,
  type GovernancePackFile,
  type GeneratePackOptions,
} from "./governance/governance-pack";

// Project Model (v4.0)
export {
  ProjectModelSchema,
  PROJECT_TYPES,
  EXECUTION_MODEL_TYPES,
  PROJECT_TYPE_TIERS,
  RefinementConstraintsSchema,
  IAC_TOOLS,
  type ProjectModel,
  type ExecutionModelType,
  type ProjectTypeTier,
  type RefinementConstraints,
  type IacTool,
} from "./schemas/project-model";

export {
  ProjectModelVersionSchema,
  type ProjectModelVersion,
} from "./schemas/project-model-version";

// Execution Profile (v4.1 — Doctrine Compiler)
export {
  ExecutionProfileV1Schema,
  DomainFamilySchema,
  WorkModeSchema,
  ArtifactTypeSchema,
  QualityModeSchema,
  RoleArchetypeSchema,
  WorkflowPatternSchema,
  ExecutionProfileExtensionsSchema,
  type ExecutionProfileV1,
  type DomainFamily,
  type WorkMode,
  type ArtifactType,
  type QualityMode,
  type RoleArchetype,
  type WorkflowPattern,
} from "./schemas/execution-profile";

// Version metadata
export {
  KERNEL_VERSION,
  ARTIFACT_SCHEMA_VERSION,
  GENERATOR_VERSION,
  getVersionMetadata,
  type VersionMetadata,
} from "./version/kernelVersion";
