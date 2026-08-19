// scripts/governance/lib/yaml-lite.mjs
//
// Dependency-free reader for the YAML SUBSET actually used by
// 10xs/kernel/kernel-spec/rules/core.yaml and scripts/governance/house-rules.yaml:
//   - 2-space-indent nested maps
//   - "key: value" scalars (string / number / boolean)
//   - "key:" followed by an indented block (map or list)
//   - "- item" lists, including lists of maps ("- id: foo" + continuation keys)
//   - "#" full-line comments and blank lines
//   - single- and double-quoted strings
//
// Anything outside that subset THROWS, with the line number, rather than
// silently dropping the construct — a parser that drops a rule is worse than
// no parser, because a dropped rule looks like a rule that was never written.
import { readFileSync } from 'node:fs';

export class YamlLiteError extends Error {}

function fail(source, lineNo, message) {
  throw new YamlLiteError(`${source}:${lineNo}: ${message}`);
}

function parseScalar(raw, source, lineNo) {
  const v = raw.trim();
  if (v === '') return '';
  if (/^[&*!{[]/.test(v)) {
    fail(
      source,
      lineNo,
      `unsupported YAML construct "${v}" — anchors (&), aliases (*), tags (!), ` +
        'and flow collections ({ }, [ ]) are outside the yaml-lite subset'
    );
  }
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1);
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

const KEY_LINE = /^([A-Za-z_][\w.-]*):(?:\s+(.*)|)$/;

function resolvePending(frame, indent, content) {
  const isList = content.startsWith('- ') || content === '-';
  frame.node = isList ? [] : {};
  frame.kind = isList ? 'list' : 'map';
  frame.indent = indent;
  frame.parentNode[frame.parentKey] = frame.node;
}

function handleKeyLine(match, node, stack, source, lineNo) {
  const key = match[1];
  const valueRaw = (match[2] ?? '').trim();
  if (Object.prototype.hasOwnProperty.call(node, key)) fail(source, lineNo, `duplicate key "${key}"`);
  if (valueRaw === '') {
    stack.push({ indent: -1, node: null, kind: 'pending', parentNode: node, parentKey: key });
  } else {
    node[key] = parseScalar(valueRaw, source, lineNo);
  }
}

function handleListLine(content, top, stack, source, lineNo, indent) {
  if (top.kind !== 'list') fail(source, lineNo, 'a "- item" line appeared where a map was expected');
  const rest = content === '-' ? '' : content.slice(2);
  if (rest === '') fail(source, lineNo, 'a bare "-" with no value is outside the yaml-lite subset');
  const inline = rest.match(KEY_LINE);
  if (inline) {
    const obj = {};
    top.node.push(obj);
    stack.push({ indent: indent + 2, node: obj, kind: 'map' });
    handleKeyLine(inline, obj, stack, source, lineNo);
  } else {
    top.node.push(parseScalar(rest, source, lineNo));
  }
}

export function parseYamlLite(text, source = '<yaml>') {
  const lines = text.split(/\r\n|\n/);
  const root = {};
  const stack = [{ indent: 0, node: root, kind: 'map' }];

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i];
    if (raw.trim() === '' || /^\s*#/.test(raw)) continue;
    if (raw.includes('\t')) fail(source, lineNo, 'tabs are not supported; use 2-space indentation');

    const indent = raw.match(/^ */)[0].length;
    const content = raw.slice(indent);

    for (;;) {
      let top = stack[stack.length - 1];
      if (top.kind === 'pending') {
        resolvePending(top, indent, content);
        top = stack[stack.length - 1];
      }
      if (stack.length > 1 && indent < top.indent) {
        stack.pop();
        continue;
      }
      break;
    }

    const top = stack[stack.length - 1];
    if (indent !== top.indent) {
      fail(source, lineNo, `inconsistent indentation (expected ${top.indent} spaces, got ${indent})`);
    }

    if (content.startsWith('- ') || content === '-') {
      handleListLine(content, top, stack, source, lineNo, indent);
      continue;
    }

    const m = content.match(KEY_LINE);
    if (!m) fail(source, lineNo, 'unrecognized line — expected "key: value", "key:", or "- item"');
    if (top.kind !== 'map') fail(source, lineNo, 'a "key: value" line appeared where a list was expected');
    handleKeyLine(m, top.node, stack, source, lineNo);
  }

  for (const frame of stack) {
    if (frame.kind === 'pending') frame.parentNode[frame.parentKey] = {};
  }
  return root;
}

export function loadYamlFile(path) {
  const text = readFileSync(path, 'utf8');
  return parseYamlLite(text, path);
}
