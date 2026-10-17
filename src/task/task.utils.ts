export interface Task {
  key: string;
  title: string;
  description: string;
}

// First task key like IC20-9 found in the branch, title, then body of the PR.
export function findTaskKey(
  ...sources: (string | null | undefined)[]
): string | null {
  for (const source of sources) {
    const match = source?.match(/\b[A-Z][A-Z0-9]*-\d+\b/);
    if (match) {
      return match[0];
    }
  }
  return null;
}

// Plain text from the task's rich-text description.
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>|<\/(div|p|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
