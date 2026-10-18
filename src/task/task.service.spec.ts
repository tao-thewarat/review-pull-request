import type { ConfigService } from '@nestjs/config';
import { TaskService } from './task.service.js';

describe('TaskService', () => {
  const env: Record<string, string> = {
    TASK_API_URL: 'http://tasks.local',
    TASK_API_KEY: 'key',
  };
  const service = new TaskService({
    getOrThrow: (name: string) => env[name],
  } as unknown as ConfigService);
  const fetchMock = vi.fn();

  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => vi.unstubAllGlobals());

  it('fetches the task and converts its description', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          title: 'Migrate',
          description: '<div>Do&nbsp;it</div>',
        }),
      ),
    );

    await expect(service.getTask('IC20-9')).resolves.toEqual({
      key: 'IC20-9',
      title: 'Migrate',
      description: 'Do it',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://tasks.local/v1/tasks/IC20-9',
      expect.objectContaining({ headers: { 'api-key': 'key' } }),
    );
  });

  it('defaults missing title and description to empty', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}'));
    await expect(service.getTask('IC20-9')).resolves.toEqual({
      key: 'IC20-9',
      title: '',
      description: '',
    });
  });

  it('returns null when the task API answers with an error', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not found', { status: 404 }));
    await expect(service.getTask('IC20-404')).resolves.toBeNull();
  });

  it('returns null when the task API is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(service.getTask('IC20-9')).resolves.toBeNull();
  });

  it('fetches several tasks and drops the missing ones', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('IC20-404')
        ? new Response('', { status: 404 })
        : new Response(JSON.stringify({ title: url.split('/').pop() })),
    );
    await expect(
      service.getTasks(['IC20-9', 'IC20-404', 'IC20-10']),
    ).resolves.toEqual([
      { key: 'IC20-9', title: 'IC20-9', description: '' },
      { key: 'IC20-10', title: 'IC20-10', description: '' },
    ]);
  });
});
