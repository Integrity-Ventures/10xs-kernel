// This deliberately duplicates G1's validator while lanes run in parallel; consolidate later.

const allowed = new Set([
  'type', 'const', 'enum', 'pattern', 'minLength', 'required', 'properties',
  'additionalProperties',
]);

const annotations = new Set([
  '$schema', '$id', 'title', 'description', '$comment', 'examples', 'default',
]);

const pointer = (parts) => parts.length
  ? `/${parts.map((part) => String(part).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`
  : '';

function checkSchema(schema, at = []) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error(`schema at ${pointer(at) || '/'} must be an object`);
  }
  for (const keyword of Object.keys(schema)) {
    // Ignore annotations only. This guard ensures we never silently accept a
    // validation constraint that this validator cannot enforce.
    if (!allowed.has(keyword) && !annotations.has(keyword)) throw new Error(`unsupported schema keyword ${pointer([...at, keyword])}`);
  }
  if (schema.properties) {
    for (const [key, child] of Object.entries(schema.properties)) checkSchema(child, [...at, 'properties', key]);
  }
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    checkSchema(schema.additionalProperties, [...at, 'additionalProperties']);
  }
}

function matchesType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function validate(value, schema, path, errors) {
  const types = schema.type === undefined ? [] : (Array.isArray(schema.type) ? schema.type : [schema.type]);
  if (types.length && !types.some((type) => matchesType(value, type))) {
    errors.push({ pointer: pointer(path), message: `expected type ${types.join('|')}, got ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}` });
    return;
  }
  if ('const' in schema && !Object.is(value, schema.const)) errors.push({ pointer: pointer(path), message: `expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}` });
  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) errors.push({ pointer: pointer(path), message: `expected one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}` });
  if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) errors.push({ pointer: pointer(path), message: `does not match pattern ${JSON.stringify(schema.pattern)}` });
  if (schema.minLength !== undefined && typeof value === 'string' && value.length < schema.minLength) errors.push({ pointer: pointer(path), message: `length ${value.length} is less than ${schema.minLength}` });
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required || []) if (!(key in value)) errors.push({ pointer: pointer([...path, key]), message: 'required property is missing' });
    for (const [key, child] of Object.entries(schema.properties || {})) if (key in value) validate(value[key], child, [...path, key], errors);
    for (const key of Object.keys(value)) if (!(key in (schema.properties || {}))) {
      if (schema.additionalProperties === false) errors.push({ pointer: pointer([...path, key]), message: 'additional property is not allowed' });
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') validate(value[key], schema.additionalProperties, [...path, key], errors);
    }
  }
}

export function validateAgainstSchema(obj, schema) {
  checkSchema(schema);
  const errors = [];
  validate(obj, schema, [], errors);
  return { ok: errors.length === 0, errors };
}
