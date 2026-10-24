import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service.js';

// ponytail: diff truncated to fit the context window, summarise per file if huge commits matter
const MAX_DIFF_CHARS = 100_000;

const SYSTEM_PROMPT = `You write Git commit messages for Odoo projects.
Read the staged diff and return JSON: {"message": "<addon>: <summary>"}
Rules:
- One line, 72 characters or fewer.
- <addon> is the Odoo addon folder name that the change is about
  (e.g. addons/sale_discount/models/sale.py -> sale_discount).
  If no addon changed, use the main folder or file name instead.
- <summary> is lowercase, imperative mood, no trailing period.
- No task number and no type tag such as [FIX].`;

@Injectable()
export class CommitMessageService {
  constructor(private readonly ai: AiService) {}

  async generate(diff: string): Promise<string> {
    const { content, finishReason } = await this.ai.complete(
      SYSTEM_PROMPT,
      diff.slice(0, MAX_DIFF_CHARS),
      { json: true },
    );
    const message = parseMessage(content);
    if (!message) {
      throw new Error(
        `AI returned no commit message (finish_reason=${finishReason}): ${content.slice(0, 200) || '<empty>'}`,
      );
    }
    return message;
  }
}

// {"message": "..."} from the model, reduced to one line without a trailing period.
// Returns '' when the answer is not usable.
export function parseMessage(text: string): string {
  const body = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  try {
    const { message } = JSON.parse(
      body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1),
    );
    return typeof message === 'string'
      ? message.trim().split('\n')[0].trim().replace(/\.+$/, '')
      : '';
  } catch {
    return '';
  }
}
