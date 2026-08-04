import { setupThemeToggle } from './theme.js';

import { initAuthUI } from './auth.js?v=20260802-required-login-1';

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
  const tokens = [];
  const stash = (html) => `\uE000${tokens.push(html) - 1}\uE001`;
  const tokenized = String(text || '')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (_, target, label) => stash(renderWikiLink(target, label)))
    .replace(/\[\[([^\]]+)\]\]/g, (_, target) => stash(renderWikiLink(target, target)))
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, href) => {
      try {
        const url = new URL(href);
        if (!['http:', 'https:'].includes(url.protocol)) return escapeHtml(label);
        return stash(`<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
      } catch {
        return escapeHtml(label);
      }
    });
  return escapeHtml(tokenized)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\uE000(\d+)\uE001/g, (_, index) => tokens[Number(index)] || '');
}

function renderWikiLink(rawTarget, rawLabel) {
  const target = String(rawTarget || '').split('#', 1)[0].trim();
  const label = String(rawLabel || target).trim();
  if (!target) return `<span class="wikilink">${escapeHtml(label)}</span>`;
  const path = /\.md$/i.test(target) ? target : `${target}.md`;
  return `<a class="wikilink" href="/wiki-view?path=${encodeURIComponent(path)}">${escapeHtml(label)}</a>`;
}

function splitMarkdownTableRow(line) {
  const source = String(line || '').trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let cell = '';
  let wikiDepth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const pair = source.slice(index, index + 2);
    if (pair === '[[') {
      wikiDepth += 1;
      cell += pair;
      index += 1;
      continue;
    }
    if (pair === ']]' && wikiDepth > 0) {
      wikiDepth -= 1;
      cell += pair;
      index += 1;
      continue;
    }
    if (source[index] === '\\' && source[index + 1] === '|') {
      cell += '|';
      index += 1;
      continue;
    }
    if (source[index] === '|' && wikiDepth === 0) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += source[index];
  }
  cells.push(cell.trim());
  return cells;
}

function renderFrontmatter(frontmatter) {
  if (!frontmatter) return '';
  const parsedRows = [];
  let currentRow = null;

  frontmatter.split('\n').forEach((sourceLine) => {
    const line = sourceLine.trim();
    if (!line) return;

    const keyMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (keyMatch) {
      currentRow = {
        key: keyMatch[1],
        value: keyMatch[2],
        items: []
      };
      parsedRows.push(currentRow);
      return;
    }

    const listMatch = line.match(/^-\s*(.*)$/);
    if (listMatch && currentRow) {
      currentRow.items.push(listMatch[1]);
      return;
    }

    if (currentRow) {
      currentRow.value = `${currentRow.value} ${line}`.trim();
    }
  });

  const wideKeys = new Set([
    'source_report',
    'source_json',
    'target',
    'moa',
    'modality',
    'scorecard'
  ]);
  const mediumKeys = new Set([
    'aliases',
    'tags',
    'company',
    'indications',
    'theme',
    'cluster'
  ]);
  const cleanValue = (value) => String(value || '').replace(/^"(.*)"$/, '$1');
  const renderValue = (row) => {
    if (row.items.length) {
      return `<ul class="wiki-meta-list">${row.items
        .map((item) => `<li>${renderInlineMarkdown(cleanValue(item))}</li>`)
        .join('')}</ul>`;
    }
    return `<strong>${renderInlineMarkdown(cleanValue(row.value) || '—')}</strong>`;
  };

  const rows = parsedRows.map((row) => {
    const normalizedKey = row.key.toLowerCase();
    const contentLength = `${row.value} ${row.items.join(' ')}`.length;
    const sizeClass = wideKeys.has(normalizedKey) || contentLength > 110
      ? 'wide'
      : mediumKeys.has(normalizedKey) || contentLength > 42
        ? 'medium'
        : 'compact';
    return `<div class="wiki-meta-item ${sizeClass}">
      <span>${escapeHtml(row.key.replaceAll('_', ' '))}</span>
      ${renderValue(row)}
    </div>`;
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
    .map(splitMarkdownTableRow);
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
  elements.rawLink.href = `/wiki/${data.path.split('/').map(encodeURIComponent).join('/')}`;
  elements.rawLink.hidden = false;
  elements.content.innerHTML = renderMarkdown(data.markdown);
  elements.status.textContent = 'Loaded';
  document.title = `${data.title} · SKBP Wiki`;
}

setupThemeToggle();
initAuthUI();

loadWikiNote().catch((error) => {
  elements.status.textContent = 'Failed';
  elements.rawLink.hidden = true;
  elements.noteTitle.textContent = 'Wiki note load failed';
  elements.notePath.textContent = notePath || '-';
  elements.content.innerHTML = `<div class="empty-state wiki-error-state"><strong>노트를 불러오지 못했습니다.</strong><span>${escapeHtml(error.message)}</span><a class="secondary-link" href="/">Dashboard로 돌아가기</a></div>`;
});
