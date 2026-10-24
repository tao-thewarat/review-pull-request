import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DiffFile } from '../diff/utils/diff.utils.js';
import type { Task } from '../task/utils/task.utils.js';
import { type AiReview, parseAiReview } from './utils/ai.utils.js';

// ponytail: diff truncated to fit the context window, chunk per file if large PRs matter
const MAX_DIFF_CHARS = 100_000;
// Gateway default is 4096 output tokens, and reasoning tokens count against it.
const MAX_OUTPUT_TOKENS = 16_384;
// Most recent earlier comments shown to the model, each cut to 300 characters.
const MAX_PREVIOUS = 50;

export interface PreviousComment {
  path: string;
  line: number;
  body: string;
}

const SYSTEM_PROMPT = `You are a senior engineer reviewing a teammate's pull request.
Each added or unchanged line of the diff starts with its line number in the new file; removed lines have no number.

Comment like a helpful human reviewer:
- Point at the exact lines: use start_line and line for a block (e.g. 30 to 35), or only line for one line.
- In body, explain what is wrong, why it is a problem (concrete consequence), and what to write instead.
- When a code change fixes it, put the replacement in suggestion: the exact code that replaces lines start_line..line,
  without line numbers or +/- markers, keeping the original indentation.
- Focus on bugs, security, data loss, error handling, performance, and clearly better idioms or APIs.
- Report at most 15 findings, most important first. Keep each body short and to the point.
- Skip pure formatting and personal taste. Do not praise. Do not repeat the same point on many lines.
- Only reference numbered lines; a range must not span removed lines or separate hunks.
- When task descriptions are given, check the change against them. Comment on code that contradicts
  or goes beyond the tasks. In summary, state for each task key whether the PR fulfils it and list any
  requirement that is missing, since a missing requirement has no line to comment on.
- Comments listed under "Already commented" were posted on earlier pushes. Do not repeat them
  or rephrase them on the same code; only report new problems.
- Write summary and body in Thai. Keep code, identifiers, and technical terms in English.

Respond with JSON only:
{"summary": "<short overall assessment>", "findings": [{"path": "<file path>", "start_line": <first line, optional>, "line": <last line>, "body": "<problem, why, and fix>", "suggestion": "<replacement code, optional>"}]}
Return an empty findings array when there is nothing worth commenting on.`;

@Injectable()
export class AiService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('AI_BASE_URL');
    this.apiKey = config.getOrThrow<string>('AI_API_KEY');
    this.model = config.getOrThrow<string>('AI_MODEL');
  }

  async review(
    files: DiffFile[],
    tasks: Task[],
    previous: PreviousComment[] = [],
  ): Promise<AiReview> {
    const diff = files
      .filter((file) => file.annotated)
      .map((file) => `### ${file.path}\n${file.annotated}`)
      .join('\n\n')
      .slice(0, MAX_DIFF_CHARS);
    const prompt = [
      ...tasks.map((t) => `## Task ${t.key}: ${t.title}\n${t.description}`),
      ...(previous.length
        ? [
            `## Already commented\n${previous
              .slice(-MAX_PREVIOUS)
              .map((c) => `- ${c.path}:${c.line}: ${c.body.slice(0, 300)}`)
              .join('\n')}`,
          ]
        : []),
      `## Diff\n${diff}`,
    ].join('\n\n');

    const { content, finishReason } = await this.complete(
      SYSTEM_PROMPT,
      prompt,
      { json: true },
    );
    try {
      return parseAiReview(content);
    } catch {
      // Thrown so BullMQ retries; the snippet shows what the model actually returned.
      throw new Error(
        `AI returned no valid JSON (finish_reason=${finishReason}): ${content.slice(0, 500) || '<empty>'}`,
      );
    }
  }

  // One chat completion. Throws on gateway errors so BullMQ jobs retry.
  async complete(
    system: string,
    user: string,
    { json = false }: { json?: boolean } = {},
  ): Promise<{ content: string; finishReason: string | undefined }> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        max_tokens: MAX_OUTPUT_TOKENS,
        ...(json && { response_format: { type: 'json_object' } }),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(300_000),
    });
    if (!res.ok) {
      throw new Error(`AI gateway ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    const choice = data.choices?.[0];
    return {
      content: choice?.message?.content ?? '',
      finishReason: choice?.finish_reason,
    };
  }
}
