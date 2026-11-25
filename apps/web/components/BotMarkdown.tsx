'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function prepareBotMarkdown(text: string) {
  return text.replace(/^[•●]\s?/gm, '- ');
}

export function BotMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        ul: ({ children }) => (
          <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li>{children}</li>,
        code: ({ children }) => <code className="rounded bg-black/5 px-1">{children}</code>,
        a: ({ href, children }) => (
          <a href={href} className="underline" target="_blank" rel="noreferrer">
            {children}
          </a>
        ),
        hr: () => <hr className="my-2 opacity-20" />,
        br: () => <br />,
        h1: ({ children }) => <p className="mb-2 font-semibold last:mb-0">{children}</p>,
        h2: ({ children }) => <p className="mb-2 font-semibold last:mb-0">{children}</p>,
        h3: ({ children }) => <p className="mb-2 font-semibold last:mb-0">{children}</p>,
        pre: ({ children }) => <div className="mb-2 last:mb-0">{children}</div>,
      }}
    >
      {prepareBotMarkdown(text)}
    </ReactMarkdown>
  );
}
