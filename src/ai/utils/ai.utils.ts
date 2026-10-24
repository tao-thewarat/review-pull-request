export interface Finding {
  path: string;
  // First line of a multi-line comment; absent for a single-line comment.
  startLine?: number;
  line: number;
  body: string;
  // Replacement code for lines startLine..line, rendered as a GitHub suggestion.
  suggestion?: string;
}

export interface AiReview {
  summary: string;
  findings: Finding[];
}

interface RawFinding {
  path?: unknown;
  start_line?: unknown;
  line?: unknown;
  body?: unknown;
  suggestion?: unknown;
}

// Models wrap JSON in <think> blocks or ``` fences; take the outermost object.
export function parseAiReview(text: string): AiReview {
  const body = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const json = JSON.parse(
    body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1),
  );
  const raw: RawFinding[] = Array.isArray(json.findings) ? json.findings : [];
  return {
    summary: typeof json.summary === 'string' ? json.summary : '',
    findings: raw.flatMap((f) =>
      typeof f === 'object' &&
      f !== null &&
      typeof f.path === 'string' &&
      Number.isInteger(f.line) &&
      typeof f.body === 'string'
        ? [
            {
              path: f.path,
              line: f.line as number,
              body: f.body,
              startLine: Number.isInteger(f.start_line)
                ? (f.start_line as number)
                : undefined,
              suggestion:
                typeof f.suggestion === 'string' ? f.suggestion : undefined,
            },
          ]
        : [],
    ),
  };
}
