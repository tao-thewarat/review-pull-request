export interface Task {
  key: string;
  title: string;
  description: string;
}

// Every task key like IC20-9 in the given texts (branch, title, body, commit messages),
// once each, in order of appearance. Handles lists such as "[IC20-9,IC20-10]".
export function findTaskKeys(
  ...sources: (string | null | undefined)[]
): string[] {
  const keys = sources.flatMap(
    (source) => source?.match(/\b[A-Z][A-Z0-9]*-\d+\b/g) ?? [],
  );
  return [...new Set(keys)];
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
