import Link from 'next/link';
import { Fragment } from 'react';

/**
 * Small, safe renderer for assistant replies: paragraphs, bullet and numbered lists,
 * **bold**, `code`, and links for "run #12" / "approval #5". No HTML is ever injected.
 */
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\brun #\d+|\bapproval #\d+)/gi;

function Inline({ text }: { text: string }) {
  const parts = text.split(INLINE);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-bone">{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} className="rounded bg-white/[0.07] px-1 py-0.5 font-mono text-[12px] text-bone">{part.slice(1, -1)}</code>;
        }
        const run = /^run #(\d+)$/i.exec(part);
        if (run) return <Link key={i} href={`/history/${run[1]}`} className="font-medium text-blush underline decoration-blush/40 underline-offset-2 hover:decoration-blush">{part}</Link>;
        if (/^approval #\d+$/i.test(part)) {
          return <Link key={i} href="/approvals" className="font-medium text-blush underline decoration-blush/40 underline-offset-2 hover:decoration-blush">{part}</Link>;
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

export default function Markdown({ text }: { text: string }) {
  const blocks: { type: 'p' | 'ul' | 'ol'; lines: string[] }[] = [];
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const type = bullet ? 'ul' : numbered ? 'ol' : 'p';
    const content = bullet?.[1] ?? numbered?.[1] ?? line;
    const last = blocks[blocks.length - 1];
    if (!content.trim()) {
      blocks.push({ type: 'p', lines: [] });
    } else if (last && last.type === type && (type !== 'p' || last.lines.length)) {
      last.lines.push(content);
    } else {
      blocks.push({ type, lines: [content] });
    }
  }
  return (
    <div className="space-y-2.5">
      {blocks.filter((b) => b.lines.length).map((b, i) => {
        if (b.type === 'p') return <p key={i}>{b.lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}<Inline text={l} /></Fragment>)}</p>;
        const List = b.type;
        return (
          <List key={i} className={b.type === 'ul' ? 'space-y-1.5' : 'list-decimal space-y-1.5 pl-5'}>
            {b.lines.map((l, j) => (
              <li key={j} className={b.type === 'ul' ? 'flex gap-2.5' : ''}>
                {b.type === 'ul' && <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-crimson-400" aria-hidden />}
                <span><Inline text={l} /></span>
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
