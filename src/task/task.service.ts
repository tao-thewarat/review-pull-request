import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Task, htmlToText } from './task.utils.js';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.apiUrl = config.getOrThrow<string>('TASK_API_URL');
    this.apiKey = config.getOrThrow<string>('TASK_API_KEY');
  }

  // Task the PR implements. A missing or unreachable task must not block the review,
  // so failures return null and the review runs on the diff alone.
  // ponytail: task images ignored, send them if the model gains vision
  async getTask(key: string): Promise<Task | null> {
    try {
      const res = await fetch(
        `${this.apiUrl}/v1/tasks/${encodeURIComponent(key)}`,
        {
          headers: { 'api-key': this.apiKey },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) {
        this.logger.warn(`Task ${key}: HTTP ${res.status}`);
        return null;
      }
      const data = await res.json();
      return {
        key,
        title: data.title ?? '',
        description: htmlToText(data.description ?? ''),
      };
    } catch (error) {
      this.logger.warn(`Task ${key}: ${(error as Error).message}`);
      return null;
    }
  }
}
