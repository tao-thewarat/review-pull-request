import type { Finding } from '../ai/ai.utils.js';
import type { DiffFile } from '../diff/diff.utils.js';

// Drop findings pointing outside the diff and duplicates. A range that leaves the diff or
// crosses hunks falls back to a single-line comment without its suggestion, since the
// suggestion would replace the wrong lines.
export function validateFindings(
  findings: Finding[],
  files: DiffFile[],
): Finding[] {
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
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [{ ...finding, startLine, suggestion }];
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
