// commit-msg hook helper: rewrites Odoo-style "[ADD] subject" headers into
// Conventional Commits ("feat: subject") before commitlint checks them.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const MAX_HEADER = 72;

const TAG_TO_TYPE: Record<string, string> = {
  ADD: 'feat',
  IMP: 'feat',
  FIX: 'fix',
  REF: 'refactor',
  REM: 'refactor',
  MOV: 'refactor',
  PERF: 'perf',
  REV: 'revert',
  DOC: 'docs',
  TEST: 'test',
  CI: 'ci',
  BUILD: 'build',
  I18N: 'chore',
  CLA: 'chore',
  MERGE: 'chore',
};

// Messages git writes itself; leave them alone.
const GENERATED = /^(Merge |Revert "|fixup! |squash! |amend! )/;

export function fixCommitMessage(message: string): string {
  const lines = message.split('\n');
  const index = lines.findIndex((line) => line.trim() && !line.startsWith('#'));
  if (index === -1 || GENERATED.test(lines[index])) {
    return message;
  }

  let header = lines[index].trim();
  const tag = /^\[([A-Za-z0-9]+)\]\s*(.*)$/.exec(header);
  if (tag && TAG_TO_TYPE[tag[1].toUpperCase()]) {
    header = `${TAG_TO_TYPE[tag[1].toUpperCase()]}: ${tag[2]}`;
  }
  header = header.replace(/\.+$/, '');
  // Mixed-case subjects ("add AI review") pass subject-case only as sentence case.
  header = header.replace(
    /^(\w+(?:\([^)]*\))?!?: )(.)(.*)$/,
    (all, prefix: string, first: string, rest: string) =>
      (first + rest).toLowerCase() === first + rest
        ? all
        : prefix + first.toUpperCase() + rest,
  );

  // Too long: cut the header at a word boundary and keep the full text in the body.
  let moved: string[] = [];
  if (header.length > MAX_HEADER) {
    const cut = header.lastIndexOf(' ', MAX_HEADER);
    moved = [header, ''];
    header = header.slice(0, cut > header.indexOf(': ') + 2 ? cut : MAX_HEADER);
  }

  const rest = lines.slice(index + 1);
  const body = moved.length && rest[0]?.trim() === '' ? rest.slice(1) : rest;
  return [
    ...lines.slice(0, index),
    header,
    ...(moved.length ? ['', ...moved] : []),
    ...body,
  ].join('\n');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const file = process.argv[2];
  writeFileSync(file, fixCommitMessage(readFileSync(file, 'utf8')));
}
