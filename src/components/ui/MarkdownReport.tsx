import { Fragment, type ReactNode } from 'react';
import { parseMarkdownBlocks } from '../../lab/markdown.ts';

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\$[^$]+\$)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={index} className="font-bold text-base-content">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return <code key={index} className="bg-base-200 px-1 py-0.5 rounded font-mono text-xs text-primary border border-base-content/10">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
      return <code key={index} className="bg-base-100 px-1 py-0.5 rounded font-mono text-xs text-cyan-400 border border-cyan-500/20">{part.slice(1, -1)}</code>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function MarkdownReport({ source }: { source: string }) {
  const blocks = parseMarkdownBlocks(source);
  const nodes: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flushList = () => {
    if (!list.length) return;
    nodes.push(<ul key={`list-${nodes.length}`} className="my-1">{list}</ul>);
    list = [];
  };
  for (const [index, block] of blocks.entries()) {
    if (block.type === 'li') {
      list.push(<li key={index} className="ml-4 list-disc text-xs text-base-content/80 my-0.5"><InlineText text={block.text} /></li>);
      continue;
    }
    flushList();
    if (block.type === 'h1') nodes.push(<h1 key={index} className="text-base font-bold text-base-content border-b border-base-content/15 pb-2 mb-3"><InlineText text={block.text} /></h1>);
    else if (block.type === 'h2') nodes.push(<h2 key={index} className="text-sm font-bold tracking-tight text-primary border-b border-base-content/10 pb-1.5 mt-5 mb-2.5"><InlineText text={block.text} /></h2>);
    else if (block.type === 'h3') nodes.push(<h3 key={index} className="text-xs font-bold uppercase tracking-wider text-base-content/80 mt-4 mb-1"><InlineText text={block.text} /></h3>);
    else if (block.type === 'blockquote') nodes.push(<blockquote key={index} className="border-l-2 border-primary bg-base-200/60 pl-3 py-1.5 my-2 text-xs italic text-base-content/80 rounded-r-box"><InlineText text={block.text} /></blockquote>);
    else if (block.type === 'hr') nodes.push(<div key={index} className="divider my-3 opacity-30" />);
    else if (block.type === 'pre') nodes.push(<pre key={index} className="bg-base-100 p-3 rounded-box border border-base-content/10 font-mono text-xs overflow-x-auto my-2 text-base-content/90"><code>{block.text}</code></pre>);
    else if (block.type === 'p') nodes.push(<p key={index} className="text-xs text-base-content/80 leading-relaxed mb-1.5"><InlineText text={block.text} /></p>);
    else if (block.type === 'table') {
      nodes.push(
        <div key={index} className="overflow-x-auto my-3 rounded-box border border-base-content/10 bg-base-200/40">
          <table className="table table-zebra table-sm w-full font-mono text-xs">
            <thead><tr>{block.headers.map(cell => <th key={cell} className="bg-base-300 text-base-content/80"><InlineText text={cell} /></th>)}</tr></thead>
            <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}><InlineText text={cell} /></td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
    }
  }
  flushList();
  return <>{nodes}</>;
}
