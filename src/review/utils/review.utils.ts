import { createHash } from 'node:crypto';
import type { Finding } from '../../ai/utils/ai.utils.js';
import type { DiffFile } from '../../diff/utils/diff.utils.js';

export interface CheckedFinding extends Finding {
  // Hash of the path and the commented code; equal across pushes while that code is unchanged.
  fingerprint: string;
}

// Drop findings pointing outside the diff, duplicates, and findings on code that an
// earlier push already commented on (known fingerprints). A range that leaves the diff
// or crosses hunks falls back to a single-line comment without its suggestion, since
// the suggestion would replace the wrong lines.
// ponytail: exact code match only; a new comment on a sub-range of old code still posts
export function validateFindings(
  findings: Finding[],
  files: DiffFile[],
  known: ReadonlySet<string> = new Set(),
): CheckedFinding[] {
  const byPath = new Map(files.map((file) => [file.path, file.lines]));
  const seen = new Set<string>();
  return findings.flatMap((finding) => {
    const lines = byPath.get(finding.path);
    if (!lines?.has(finding.line)) {
      return [];
    }
    let { startLine, suggestion } = finding;
    if (startLine === finding.line) {
      startLine = undefined;
    } else if (startLine !== undefined) {
      const inDiff =
        startLine < finding.line &&
        Array.from(
          { length: finding.line - startLine + 1 },
          (_, i) => startLine! + i,
        ).every((n) => lines.has(n));
      if (!inDiff) {
        startLine = undefined;
        suggestion = undefined;
      }
    }
    const key = `${finding.path}:${startLine}:${finding.line}:${finding.body.trim()}`;
    const fingerprint = codeFingerprint(
      finding.path,
      lines,
      startLine ?? finding.line,
      finding.line,
    );
    if (seen.has(key) || known.has(fingerprint)) {
      return [];
    }
    seen.add(key);
    return [{ ...finding, startLine, suggestion, fingerprint }];
  });
}

// Comment text with the suggestion as a GitHub ```suggestion block (one-click apply).
export function commentBody(finding: Finding): string {
  if (finding.suggestion === undefined) {
    return finding.body;
  }
  const longest = Math.max(
    2,
    ...(finding.suggestion.match(/`+/g) ?? []).map((m) => m.length),
  );
  const fence = '`'.repeat(longest + 1);
  return `${finding.body}\n\n${fence}suggestion\n${finding.suggestion.replace(/\n$/, '')}\n${fence}`;
}

// Trailing whitespace is ignored so an editor trimming lines does not count as a change.
export function codeFingerprint(
  path: string,
  lines: ReadonlyMap<number, string>,
  start: number,
  end: number,
): string {
  const code = Array.from({ length: end - start + 1 }, (_, i) =>
    (lines.get(start + i) ?? '').trimEnd(),
  );
  return createHash('sha256')
    .update([path, ...code].join('\n'))
    .digest('hex');
}
