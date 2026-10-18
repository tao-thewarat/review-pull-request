// commit-msg hook helper: rewrites Odoo-style headers such as
// "[IC20-9,IC20-10][FIX] addons: subject" into Conventional Commits
// ("fix(addons): subject" + "Refs: IC20-9, IC20-10" footer) before commitlint checks them.
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

const TASK_KEY = /\b[A-Z][A-Z0-9]*-\d+\b/g;
const CONVENTIONAL = /^\w+(?:\([^)]*\))?!?: /;

// Messages git writes itself; leave them alone.
const GENERATED = /^(Merge |Revert "|fixup! |squash! |amend! )/;

export function fixCommitMessage(message: string): string {
  const lines = message.split('\n');
  const index = lines.findIndex((line) => line.trim() && !line.startsWith('#'));
  if (index === -1 || GENERATED.test(lines[index])) {
    return message;
  }

  let header = lines[index].trim();
  const { type, refs, rest } = readPrefixes(header);
  if (type) {
    // "addons: subject" after the tag becomes the scope.
    const scoped = /^([\w./-]+): (.+)$/.exec(rest);
    header = scoped
      ? `${type}(${scoped[1]}): ${scoped[2]}`
      : `${type}: ${rest}`;
  } else if (refs.length && CONVENTIONAL.test(rest)) {
    header = rest;
  } else {
    refs.length = 0;
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

  const after = lines.slice(index + 1);
  const body = moved.length && after[0]?.trim() === '' ? after.slice(1) : after;
  const result = [
    ...lines.slice(0, index),
    header,
    ...(moved.length ? ['', ...moved] : []),
    ...body,
  ];
  if (refs.length) {
    // Footer goes after the last real line, ahead of git's trailing comments.
    const last = result.findLastIndex(
      (line) => line.trim() && !line.startsWith('#'),
    );
    result.splice(last + 1, 0, '', `Refs: ${refs.join(', ')}`);
  }
  return result.join('\n');
}

// Leading "[...]" groups: task key lists become refs, a known tag becomes the type.
function readPrefixes(header: string) {
  const refs: string[] = [];
  let type: string | undefined;
  let rest = header;
  for (
    let group = /^\[([^\]]+)\]\s*/.exec(rest);
    group;
    group = /^\[([^\]]+)\]\s*/.exec(rest)
  ) {
    const content = group[1].replace(/\s/g, '');
    const keys = content.match(TASK_KEY) ?? [];
    const mapped = TAG_TO_TYPE[content.toUpperCase()];
    if (mapped && !type) {
      type = mapped;
    } else if (keys.length && keys.join(',') === content) {
      refs.push(...keys);
    } else {
      break;
    }
    rest = rest.slice(group[0].length);
  }
  return { type, refs: [...new Set(refs)], rest };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const file = process.argv[2];
  writeFileSync(file, fixCommitMessage(readFileSync(file, 'utf8')));
}
