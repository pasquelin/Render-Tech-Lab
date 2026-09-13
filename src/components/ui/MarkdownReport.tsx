import { Fragment, type ReactNode } from 'react';
import { parseMarkdownBlocks } from '../../lab/markdown.ts';

function artifactUrl(basePath: string | undefined, relative: string) {
  return basePath && relative.startsWith('./') ? `/api/report-artifact?package=${encodeURIComponent(basePath)}&file=${encodeURIComponent(relative.slice(2))}` : relative;
}

function InlineText({ text, basePath }: { text: string; basePath?: string }) {
  const parts = text.split(/(!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]*\)|\*\*[^*]+\*\*|`[^`]+`|\$[^$]+\$)/g);
  return parts.map((part, index) => {
    const image = /^!\[([^\]]*)\]\(([^)]*)\)$/.exec(part);
    if (image) return <img key={index} src={artifactUrl(basePath, image[2])} alt={image[1]} className="max-h-72 max-w-full rounded-box border border-base-content/15 my-2" />;
    const link = /^\[([^\]]+)\]\(([^)]*)\)$/.exec(part);
    if (link) return <a key={index} href={artifactUrl(basePath, link[2])} className="link link-primary" target="_blank" rel="noreferrer">{link[1]}</a>;
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

export function MarkdownReport({ source, basePath }: { source: string; basePath?: string }) {
  const blocks = parseMarkdownBlocks(source.replace(/<!--\s*report-package:[^>]+-->/g, ''));
  const nodes: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flushList = () => {
    if (!list.length) return;
    nodes.push(<ul key={`list-${nodes.length}`} className="my-1">{list}</ul>);
    list = [];
  };
  for (const [index, block] of blocks.entries()) {
    if (block.type === 'li') {
      list.push(<li key={index} className="ml-4 list-disc text-xs text-base-content/80 my-0.5"><InlineText text={block.text} basePath={basePath} /></li>);
      continue;
    }
    flushList();
    if (block.type === 'h1') nodes.push(<h1 key={index} className="text-base font-bold text-base-content border-b border-base-content/15 pb-2 mb-3"><InlineText text={block.text} basePath={basePath} /></h1>);
    else if (block.type === 'h2') nodes.push(<h2 key={index} className="text-sm font-bold tracking-tight text-primary border-b border-base-content/10 pb-1.5 mt-5 mb-2.5"><InlineText text={block.text} basePath={basePath} /></h2>);
    else if (block.type === 'h3') nodes.push(<h3 key={index} className="text-xs font-bold uppercase tracking-wider text-base-content/80 mt-4 mb-1"><InlineText text={block.text} basePath={basePath} /></h3>);
    else if (block.type === 'blockquote') nodes.push(<blockquote key={index} className="border-l-2 border-primary bg-base-200/60 pl-3 py-1.5 my-2 text-xs italic text-base-content/80 rounded-r-box"><InlineText text={block.text} basePath={basePath} /></blockquote>);
    else if (block.type === 'hr') nodes.push(<div key={index} className="divider my-3 opacity-30" />);
    else if (block.type === 'pre') nodes.push(<details key={index} className="bg-base-100 rounded-box border border-base-content/10 my-2 text-base-content/90"><summary className="cursor-pointer p-3 font-mono text-xs text-primary">Données complètes / binaire intégré ({block.text.length.toLocaleString('fr-FR')} caractères)</summary><pre className="p-3 pt-0 font-mono text-xs overflow-x-auto"><code>{block.text}</code></pre></details>);
    else if (block.type === 'p') nodes.push(<p key={index} className="text-xs text-base-content/80 leading-relaxed mb-1.5"><InlineText text={block.text} basePath={basePath} /></p>);
    else if (block.type === 'table') {
      nodes.push(
        <div key={index} className="overflow-x-auto my-3 rounded-box border border-base-content/10 bg-base-200/40">
          <table className="table table-zebra table-sm w-full font-mono text-xs">
            <thead><tr>{block.headers.map(cell => <th key={cell} className="bg-base-300 text-base-content/80"><InlineText text={cell} basePath={basePath} /></th>)}</tr></thead>
            <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}><InlineText text={cell} basePath={basePath} /></td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
    }
  }
  flushList();
  return <>{nodes}</>;
}
