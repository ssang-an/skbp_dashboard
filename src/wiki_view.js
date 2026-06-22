const params = new URLSearchParams(window.location.search);
const notePath = params.get('path') || '';

const elements = {
  title: document.querySelector('#wikiTitle'),
  status: document.querySelector('#wikiStatus'),
  noteTitle: document.querySelector('#wikiNoteTitle'),
  notePath: document.querySelector('#wikiNotePath'),
  content: document.querySelector('#wikiNoteContent'),
  rawLink: document.querySelector('#rawWikiLink')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---')) return { frontmatter: '', body: markdown };
  const end = markdown.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: '', body: markdown };
  return {
    frontmatter: markdown.slice(3, end).trim(),
    body: markdown.slice(end + 4).trim()
  };
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '<span class="wikilink">$2</span>')
    .replace(/\[\[([^\]]+)\]\]/g, '<span class="wikilink">$1</span>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderFrontmatter(frontmatter) {
  if (!frontmatter) return '';
  const rows = frontmatter.split('\n').filter(Boolean).map((line) => {
    const [key, ...rest] = line.split(':');
    return `<div><span>${escapeHtml(key.trim())}</span><strong>${escapeHtml(rest.join(':').trim())}</strong></div>`;
  }).join('');
  return `<section class="wiki-frontmatter">${rows}</section>`;
}

function renderMarkdownTable(lines, startIndex) {
  const tableLines = [];
  let index = startIndex;
  while (index < lines.length && lines[index].trim().startsWith('|')) {
    tableLines.push(lines[index].trim());
    index += 1;
  }
  const rows = tableLines
    .filter((line) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line))
    .map((line) => line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
  if (!rows.length) return { html: '', nextIndex: index };
  const [head, ...body] = rows;
  const header = `<thead><tr>${head.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join('')}</tr></thead>`;
  const bodyHtml = `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return { html: `<div class="wiki-table-wrap"><table>${header}${bodyHtml}</table></div>`, nextIndex: index };
}

function renderMarkdown(markdown) {
  const { frontmatter, body } = parseFrontmatter(markdown);
  const lines = body.split('\n');
  const blocks = [renderFrontmatter(frontmatter)];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || 'code';
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push(`<pre><span>${escapeHtml(language)}</span><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (line.startsWith('|')) {
      const table = renderMarkdownTable(lines, index);
      blocks.push(table.html);
      index = table.nextIndex - 1;
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push(`<h1>${renderInlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(`<h2>${renderInlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push(`<h3>${renderInlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('>')) {
      blocks.push(`<blockquote>${renderInlineMarkdown(line.replace(/^>\s*/, ''))}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(`<li>${renderInlineMarkdown(lines[index].trim().replace(/^[-*]\s+/, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      index -= 1;
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(`<li>${renderInlineMarkdown(lines[index].trim().replace(/^\d+\.\s+/, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ol>${items.join('')}</ol>`);
      index -= 1;
      continue;
    }

    blocks.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }
  return blocks.join('');
}

async function loadWikiNote() {
  if (!notePath) throw new Error('Missing wiki note path.');
  const response = await fetch(`/api/wiki-note?path=${encodeURIComponent(notePath)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Failed to load wiki note.');

  elements.title.textContent = 'Wiki : ' + data.title;
  elements.noteTitle.textContent = data.title;
  elements.notePath.textContent = data.path;
  elements.rawLink.href = `/wiki/${data.path}`;
  elements.content.innerHTML = renderMarkdown(data.markdown);
  elements.status.textContent = 'Loaded';
}

loadWikiNote().catch((error) => {
  elements.status.textContent = 'Failed';
  elements.noteTitle.textContent = 'Wiki note load failed';
  elements.notePath.textContent = notePath || '-';
  elements.content.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
