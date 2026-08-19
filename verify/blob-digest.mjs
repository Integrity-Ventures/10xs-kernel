import { readFileAtRef, sha256Hex } from './report-facts.mjs';

export function blobDigestAtRef(repo, ref, path) {
  const content = readFileAtRef(repo, ref, path);
  return content === null ? null : sha256Hex(content);
}
