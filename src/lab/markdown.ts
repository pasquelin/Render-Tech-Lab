/** Convertit le Markdown des rapports R&D en HTML daisyUI. */
export function parseMarkdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Blocs de code ```...```
  html = html.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre class="bg-base-100 p-3 rounded-box border border-base-content/10 font-mono text-xs overflow-x-auto my-2 text-base-content/90"><code>${code.trim()}</code></pre>`;
  });

  // Titres avec styles daisyUI sobres
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-xs font-bold uppercase tracking-wider text-base-content/80 mt-4 mb-1">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-sm font-bold tracking-tight text-primary border-b border-base-content/10 pb-1.5 mt-5 mb-2.5">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-base font-bold text-base-content border-b border-base-content/15 pb-2 mb-3">$1</h1>');

  // Blockquotes daisyUI
  html = html.replace(/^> (.*$)/gim, '<blockquote class="border-l-2 border-primary bg-base-200/60 pl-3 py-1.5 my-2 text-xs italic text-base-content/80 rounded-r-box">$1</blockquote>');

  // Séparateur horizontal
  html = html.replace(/^---$/gim, '<div class="divider my-3 opacity-30"></div>');

  // Gras
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-base-content">$1</strong>');

  // Code inline
  html = html.replace(/`([^`]+)`/g, '<code class="bg-base-200 px-1 py-0.5 rounded font-mono text-xs text-primary border border-base-content/10">$1</code>');

  // Math KaTeX basique $...$
  html = html.replace(/\$([^\$]+)\$/g, '<code class="bg-base-100 px-1 py-0.5 rounded font-mono text-xs text-cyan-400 border border-cyan-500/20">$1</code>');

  // Listes à puces
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc text-xs text-base-content/80 my-0.5">$1</li>');

  // Tables Markdown en daisyUI table table-zebra table-sm
  const lines = html.split('\n');
  const result: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      const nextLine = (lines[i + 1] || '').trim();
      const isSep = /^\|(?:\s*:?-+:?\s*\|)+$/.test(nextLine);

      if (!inTable) {
        inTable = true;
        result.push('<div class="overflow-x-auto my-3 rounded-box border border-base-content/10 bg-base-200/40"><table class="table table-zebra table-sm w-full font-mono text-xs">');
      }

      if (isSep) {
        const cells = line.split('|').slice(1, -1).map((c) => `<th class="bg-base-300 text-base-content/80">${c.trim()}</th>`).join('');
        result.push(`<thead><tr>${cells}</tr></thead><tbody>`);
        i++; // Sauter la ligne séparatrice
        continue;
      }

      const cells = line.split('|').slice(1, -1).map((c) => `<td>${c.trim()}</td>`).join('');
      result.push(`<tr>${cells}</tr>`);
    } else {
      if (inTable) {
        result.push('</tbody></table></div>');
        inTable = false;
      }
      if (line.length > 0) {
        if (
          !line.startsWith('<h') &&
          !line.startsWith('<blockquote') &&
          !line.startsWith('<pre') &&
          !line.startsWith('<div') &&
          !line.startsWith('<li') &&
          !line.startsWith('<table')
        ) {
          result.push(`<p class="text-xs text-base-content/80 leading-relaxed mb-1.5">${line}</p>`);
        } else {
          result.push(line);
        }
      }
    }
  }
  if (inTable) {
    result.push('</tbody></table></div>');
  }

  return result.join('\n');
}

