export interface DiffFile {
  path: string;
  // Annotated patch shown to the AI, null when GitHub omits the patch (binary/too large).
  annotated: string | null;
  // New-file line number -> code, for every line GitHub accepts an inline comment on (side RIGHT).
  lines: Map<number, string>;
}

// Prefix each added/context line with its new-file line number so the AI can cite it.
export function parsePatch(
  patch: string,
): Pick<DiffFile, 'annotated' | 'lines'> {
  const lines = new Map<number, string>();
  const annotated: string[] = [];
  let line = 0;
  for (const raw of patch.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(raw);
    if (hunk) {
      line = Number(hunk[1]);
      annotated.push(raw);
    } else if (raw.startsWith('-')) {
      annotated.push(`     ${raw}`);
    } else if (raw !== '' && !raw.startsWith('\\')) {
      lines.set(line, raw.slice(1));
      annotated.push(`${String(line).padStart(4)} ${raw}`);
      line++;
    }
  }
  return { annotated: annotated.join('\n'), lines };
}
