// Dependency-free JSON Schema validator for the subset event.v1.schema.json uses.
// Anything outside that subset throws — a validator that silently accepts an
// unsupported keyword is worse than no validator at all.

const SUPPORTED_KEYWORDS = new Set([
  "$schema",
  "$id",
  "title",
  "type",
  "const",
  "enum",
  "pattern",
  "minLength",
  "required",
  "properties",
  "additionalProperties",
]);

// Annotation-only keywords cannot affect whether an instance validates, so ignoring them is safe.
// Everything else still throws to prevent unsupported validation constraints from being ignored.
const IGNORED_ANNOTATION_KEYWORDS = new Set([
  "description",
  "$comment",
  "examples",
  "default",
  "deprecated",
  "readOnly",
  "writeOnly",
]);

function assertSupported(schema, pointer) {
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED_KEYWORDS.has(key) && !IGNORED_ANNOTATION_KEYWORDS.has(key)) {
      throw new Error(
        `Unsupported schema keyword "${key}" at ${pointer || "/"} — validator ` +
          "does not implement this subset of JSON Schema.",
      );
    }
  }
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value; // "object" | "string" | "number" | "boolean" | "undefined"
}

function checkType(value, typeSpec, pointer, errors) {
  const types = Array.isArray(typeSpec) ? typeSpec : [typeSpec];
  for (const t of types) {
    if (!["object", "string", "number", "boolean", "null", "array"].includes(t)) {
      throw new Error(`Unsupported type "${t}" at ${pointer || "/"}`);
    }
  }
  const actual = typeOf(value);
  if (!types.includes(actual)) {
    errors.push(`${pointer || "/"}: expected type ${types.join("|")}, got ${actual}`);
    return false;
  }
  return true;
}

function checkObjectKeywords(value, schema, pointer, errors) {
  if ("required" in schema) {
    for (const req of schema.required) {
      if (!(req in value)) {
        errors.push(`${pointer}/${req}: required property missing`);
      }
    }
  }
  const knownKeys = schema.properties ? Object.keys(schema.properties) : [];
  if ("properties" in schema) {
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (key in value) {
        validateNode(value[key], subSchema, `${pointer}/${key}`, errors);
      }
    }
  }
  if ("additionalProperties" in schema) {
    const extra = schema.additionalProperties;
    for (const key of Object.keys(value)) {
      if (knownKeys.includes(key)) continue;
      if (extra === false) {
        errors.push(`${pointer}/${key}: additional property not allowed`);
      } else if (extra === true) {
        // anything goes
      } else if (extra && typeof extra === "object") {
        validateNode(value[key], extra, `${pointer}/${key}`, errors);
      } else {
        throw new Error(`Unsupported additionalProperties value at ${pointer || "/"}`);
      }
    }
  }
}

function validateNode(value, schema, pointer, errors) {
  assertSupported(schema, pointer);

  if ("const" in schema) {
    if (value !== schema.const) {
      errors.push(`${pointer || "/"}: must equal '${schema.const}'`);
      return;
    }
  }

  if ("enum" in schema) {
    if (!schema.enum.includes(value)) {
      errors.push(`${pointer || "/"}: '${value}' not in enum`);
      return;
    }
  }

  if ("type" in schema) {
    if (!checkType(value, schema.type, pointer, errors)) return;
  }

  if ("pattern" in schema && typeof value === "string") {
    if (!new RegExp(schema.pattern).test(value)) {
      errors.push(`${pointer || "/"}: does not match pattern ${schema.pattern}`);
    }
  }

  if ("minLength" in schema && typeof value === "string") {
    if (value.length < schema.minLength) {
      errors.push(
        `${pointer || "/"}: length ${value.length} < minLength ${schema.minLength}`,
      );
    }
  }

  if (typeOf(value) === "object") {
    checkObjectKeywords(value, schema, pointer, errors);
  }
}

export function validateEvent(obj, schema) {
  const errors = [];
  validateNode(obj, schema, "", errors);
  return { ok: errors.length === 0, errors };
}
