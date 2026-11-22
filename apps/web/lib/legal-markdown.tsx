import type { ReactNode } from 'react';

export const RULES_RO_VERSION = {
  version: '1.0',
  lastUpdated: '[DATA]',
} as const;

export const REGULAMENT_ARTICLE_ANCHORS: Record<number, string> = {
  1: 'ce-este',
  2: 'runda',
  3: 'o-incercare',
  4: 'punctaj',
  5: 'egalitati',
  6: 'clasamente',
  7: 'ligi',
  8: 'dueluri',
  9: 'serii',
  10: 'trisat',
  11: 'erori',
  12: 'pro',
  13: 'modificari',
  14: 'contact',
};

/**
 * Checks if a raw markdown legal document still contains any bracketed
 * placeholder (e.g. `[DATA]`, `[STRADA, NR.]`, `[DE CONFIRMAT ...]`) that is
 * NOT a markdown link `[label](url)`.
 */
export function hasLegalPlaceholders(markdown: string): boolean {
  const withoutLinks = markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  return /\[[^\]]+\]/.test(withoutLinks);
}

/**
 * Renders inline text supporting:
 * - Markdown links `[text](url)`
 * - Bracketed placeholders `[...]` rendered inside `<mark>`
 * - Bold `**text**`
 * - Italic `*text*`
 */
export function renderLegalInline(text: string, keyPrefix = 'inl'): ReactNode[] {
  const tokenRegex =
    /(\[[^\]]+\]\([^)]+\)|\[[^\]]+\]|\*\*[^*]+\*\*|\*[^*]+\*|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|https?:\/\/[^\s)]+)/g;

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const tok = match[0];
    const key = `${keyPrefix}-${idx++}`;

    // 1. Markdown link: [label](href)
    const linkMatch = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      nodes.push(
        <a
          key={key}
          href={linkMatch[2]}
          className="text-duel-strong font-bold underline underline-offset-2"
        >
          {linkMatch[1]}
        </a>,
      );
      lastIndex = tokenRegex.lastIndex;
      continue;
    }

    // 2. Bracketed placeholder: [...]
    if (tok.startsWith('[') && tok.endsWith(']')) {
      nodes.push(
        <mark
          key={key}
          className="border-border bg-volt/80 rounded px-1 py-0.5 font-bold text-[#16131F]"
        >
          {tok}
        </mark>,
      );
      lastIndex = tokenRegex.lastIndex;
      continue;
    }

    // 3. Bold: **...**
    if (tok.startsWith('**') && tok.endsWith('**')) {
      const inner = tok.slice(2, -2);
      nodes.push(<strong key={key}>{renderLegalInline(inner, `${key}-b`)}</strong>);
      lastIndex = tokenRegex.lastIndex;
      continue;
    }

    // 4. Italic: *...*
    if (tok.startsWith('*') && tok.endsWith('*')) {
      const inner = tok.slice(1, -1);
      nodes.push(<em key={key}>{renderLegalInline(inner, `${key}-i`)}</em>);
      lastIndex = tokenRegex.lastIndex;
      continue;
    }

    // 5. Email address
    if (tok.includes('@') && !tok.startsWith('http')) {
      nodes.push(
        <a
          key={key}
          href={`mailto:${tok}`}
          className="text-duel-strong font-bold underline underline-offset-2"
        >
          {tok}
        </a>,
      );
      lastIndex = tokenRegex.lastIndex;
      continue;
    }

    // 6. Bare URL
    if (tok.startsWith('http://') || tok.startsWith('https://')) {
      nodes.push(
        <a key={key} href={tok} className="text-duel-strong font-bold underline underline-offset-2">
          {tok}
        </a>,
      );
      lastIndex = tokenRegex.lastIndex;
      continue;
    }

    nodes.push(tok);
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
