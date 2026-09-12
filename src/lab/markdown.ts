/** Blocs Markdown des rapports R&D, rendus en HTML (workbenches natifs) ou en React. */

export type MarkdownBlock =
  | { type: 'h1' | 'h2' | 'h3' | 'p' | 'blockquote' | 'li' | 'hr' | 'pre'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] };

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const inlineHtml = (value: string) => escapeHtml(value)
  .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-base-content">$1</strong>')
  .replace(/`([^`]+)`/g, '<code class="bg-base-200 px-1 py-0.5 rounded font-mono text-xs text-primary border border-base-content/10">$1</code>')
  .replace(/\$([^$]+)\$/g, '<code class="bg-base-100 px-1 py-0.5 rounded font-mono text-xs text-cyan-400 border border-cyan-500/20">$1</code>');

export function parseMarkdownBlocks(md: string): MarkdownBlock[] {
  const withoutFences: Array<{ kind: 'pre'; text: string } | { kind: 'text'; text: string }> = [];
  const fence = /```[a-z0-9_-]*\n([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(md))) {
    if (match.index > cursor) withoutFences.push({ kind: 'text', text: md.slice(cursor, match.index) });
    withoutFences.push({ kind: 'pre', text: match[1].trim() });
    cursor = match.index + match[0].length;
  }
  if (cursor < md.length) withoutFences.push({ kind: 'text', text: md.slice(cursor) });

  const blocks: MarkdownBlock[] = [];
  for (const piece of withoutFences) {
    if (piece.kind === 'pre') {
      blocks.push({ type: 'pre', text: piece.text });
      continue;
    }
    const lines = piece.text.split('\n');
    let inTable = false;
    let headers: string[] = [];
    let rows: string[][] = [];
    const flushTable = () => {
      if (!inTable) return;
      blocks.push({ type: 'table', headers, rows });
      inTable = false;
      headers = [];
      rows = [];
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const next = (lines[i + 1] || '').trim();
        const isSep = /^\|(?:\s*:?-+:?\s*\|)+$/.test(next);
        const cells = trimmed.split('|').slice(1, -1).map((cell: string) => cell.trim());
        if (!inTable) {
          inTable = true;
          headers = [];
          rows = [];
        }
        if (isSep) {
          headers = cells;
          i++;
          continue;
        }
        if (headers.length) rows.push(cells);
        else headers = cells;
        continue;
      }
      flushTable();
      if (!trimmed) continue;
      if (trimmed === '---') { blocks.push({ type: 'hr', text: '' }); continue; }
      if (trimmed.startsWith('### ')) { blocks.push({ type: 'h3', text: trimmed.slice(4) }); continue; }
      if (trimmed.startsWith('## ')) { blocks.push({ type: 'h2', text: trimmed.slice(3) }); continue; }
      if (trimmed.startsWith('# ')) { blocks.push({ type: 'h1', text: trimmed.slice(2) }); continue; }
      if (trimmed.startsWith('> ')) { blocks.push({ type: 'blockquote', text: trimmed.slice(2) }); continue; }
      if (/^\s*-\s+/.test(line)) { blocks.push({ type: 'li', text: trimmed.replace(/^\s*-\s+/, '') }); continue; }
      blocks.push({ type: 'p', text: trimmed });
    }
    flushTable();
  }
  return blocks;
}

export function parseMarkdownToHtml(md: string): string {
  const html: string[] = [];
  for (const block of parseMarkdownBlocks(md)) {
    if (block.type === 'h1') html.push(`<h1 class="text-base font-bold text-base-content border-b border-base-content/15 pb-2 mb-3">${inlineHtml(block.text)}</h1>`);
    else if (block.type === 'h2') html.push(`<h2 class="text-sm font-bold tracking-tight text-primary border-b border-base-content/10 pb-1.5 mt-5 mb-2.5">${inlineHtml(block.text)}</h2>`);
    else if (block.type === 'h3') html.push(`<h3 class="text-xs font-bold uppercase tracking-wider text-base-content/80 mt-4 mb-1">${inlineHtml(block.text)}</h3>`);
    else if (block.type === 'blockquote') html.push(`<blockquote class="border-l-2 border-primary bg-base-200/60 pl-3 py-1.5 my-2 text-xs italic text-base-content/80 rounded-r-box">${inlineHtml(block.text)}</blockquote>`);
    else if (block.type === 'hr') html.push('<div class="divider my-3 opacity-30"></div>');
    else if (block.type === 'pre') html.push(`<pre class="bg-base-100 p-3 rounded-box border border-base-content/10 font-mono text-xs overflow-x-auto my-2 text-base-content/90"><code>${escapeHtml(block.text)}</code></pre>`);
    else if (block.type === 'li') html.push(`<li class="ml-4 list-disc text-xs text-base-content/80 my-0.5">${inlineHtml(block.text)}</li>`);
    else if (block.type === 'p') html.push(`<p class="text-xs text-base-content/80 leading-relaxed mb-1.5">${inlineHtml(block.text)}</p>`);
    else if (block.type === 'table') {
      const head = block.headers.map((cell: string) => `<th class="bg-base-300 text-base-content/80">${inlineHtml(cell)}</th>`).join('');
      const body = block.rows.map((row: string[]) => `<tr>${row.map((cell: string) => `<td>${inlineHtml(cell)}</td>`).join('')}</tr>`).join('');
      html.push(`<div class="overflow-x-auto my-3 rounded-box border border-base-content/10 bg-base-200/40"><table class="table table-zebra table-sm w-full font-mono text-xs"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
    }
  }
  return html.join('\n');
}
