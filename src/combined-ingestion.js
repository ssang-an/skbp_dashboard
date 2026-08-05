export function unwrapCombinedResponseEnvelope(text) {
  const match = String(text || '').match(/^```(?:text|markdown|md)?[ \t]*\r?\n([\s\S]*)\r?\n```[ \t]*$/i);
  return match ? String(match[1] || '').trim() : '';
}

export const MAX_COMBINED_RESPONSE_CHARS = 2_000_000;
export const MAX_JSON_NESTING_DEPTH = 80;
export const MAX_IGNORED_JSON_AFFIX_CHARS = 4_000;
const JSON_SEPARATOR_PATTERN = /^[ \t]*---[ \t]+JSON[ \t]+DATA[ \t]+---[ \t]*$/gim;
const JSON_SEPARATOR_LINE_PATTERN = /^[ \t]*---[ \t]+JSON[ \t]+DATA[ \t]+---[ \t]*$/im;

function assertNoDuplicateJsonKeys(value) {
  const source = String(value || '');
  const objectKeys = [];
  const containerTypes = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === '{') {
      containerTypes.push('object');
      objectKeys.push(new Set());
      index += 1;
      continue;
    }
    if (char === '[') {
      containerTypes.push('array');
      objectKeys.push(null);
      index += 1;
      continue;
    }
    if (char === '}' || char === ']') {
      containerTypes.pop();
      objectKeys.pop();
      index += 1;
      continue;
    }
    if (char !== '"') {
      index += 1;
      continue;
    }

    const tokenStart = index;
    index += 1;
    let escaped = false;
    while (index < source.length) {
      const tokenChar = source[index];
      if (escaped) escaped = false;
      else if (tokenChar === '\\') escaped = true;
      else if (tokenChar === '"') break;
      index += 1;
    }
    if (index >= source.length) return;
    const tokenEnd = index + 1;
    let lookahead = tokenEnd;
    while (/\s/.test(source[lookahead] || '')) lookahead += 1;
    if (containerTypes.at(-1) === 'object' && source[lookahead] === ':') {
      const key = JSON.parse(source.slice(tokenStart, tokenEnd));
      const keys = objectKeys.at(-1);
      if (keys.has(key)) throw new SyntaxError(`중복 JSON key ${JSON.stringify(key)}가 감지되었습니다.`);
      keys.add(key);
    }
    index = tokenEnd;
  }
}

function repairSafeJsonSyntax(value) {
  const source = String(value || '');
  let escapedControls = '';
  let inString = false;
  let escaped = false;
  let escapedControlCount = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        escapedControls += char;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        escapedControls += char;
        continue;
      }
      if (char === '"') {
        inString = false;
        escapedControls += char;
        continue;
      }
      if (char === '\n' || char === '\r' || char === '\t') {
        escapedControls += char === '\n' ? '\\n' : char === '\r' ? '\\r' : '\\t';
        escapedControlCount += 1;
        continue;
      }
      escapedControls += char;
      continue;
    }
    if (char === '"') inString = true;
    escapedControls += char;
  }

  let withoutTrailingCommas = '';
  inString = false;
  escaped = false;
  let trailingCommaCount = 0;
  for (let index = 0; index < escapedControls.length; index += 1) {
    const char = escapedControls[index];
    if (inString) {
      withoutTrailingCommas += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      withoutTrailingCommas += char;
      continue;
    }
    if (char === ',') {
      let lookahead = index + 1;
      while (/\s/.test(escapedControls[lookahead] || '')) lookahead += 1;
      if (escapedControls[lookahead] === '}' || escapedControls[lookahead] === ']') {
        trailingCommaCount += 1;
        continue;
      }
    }
    withoutTrailingCommas += char;
  }

  const actions = [];
  if (trailingCommaCount) actions.push(`trailing comma ${trailingCommaCount}개 제거`);
  if (escapedControlCount) actions.push(`문자열 제어문자 ${escapedControlCount}개 escape`);
  return { text: withoutTrailingCommas, actions };
}

export function parseTopLevelJsonSuffix(value) {
  const source = String(value || '').replace(/^\uFEFF/, '').trim();
  const rootMatch = /^(?:```json[ \t]*\r?\n)?[ \t]*([\[{])/im.exec(source);
  if (!rootMatch) throw new SyntaxError('JSON suffix에서 줄 시작의 최상위 { 또는 [를 찾지 못했습니다.');

  const rootIndex = rootMatch.index + rootMatch[0].lastIndexOf(rootMatch[1]);
  const leading = source.slice(0, rootIndex).replace(/^```json[ \t]*$/gim, '').trim();
  if (leading.length > MAX_IGNORED_JSON_AFFIX_CHARS) {
    throw new SyntaxError(`JSON 앞의 무시 가능한 설명은 ${MAX_IGNORED_JSON_AFFIX_CHARS.toLocaleString()}자를 초과할 수 없습니다.`);
  }
  const stack = [];
  let inString = false;
  let escaped = false;
  let rootEnd = -1;

  for (let index = rootIndex; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{' || char === '[') stack.push(char);
    if (stack.length > MAX_JSON_NESTING_DEPTH) {
      throw new SyntaxError(`JSON 중첩 깊이는 ${MAX_JSON_NESTING_DEPTH}단계를 초과할 수 없습니다.`);
    }
    if (char === '}' || char === ']') {
      const expected = char === '}' ? '{' : '[';
      if (stack.pop() !== expected) throw new SyntaxError('최상위 JSON의 괄호 짝이 맞지 않습니다.');
      if (!stack.length) {
        rootEnd = index + 1;
        break;
      }
    }
  }

  if (rootEnd < 0 || inString || stack.length) {
    throw new SyntaxError('최상위 JSON이 닫히지 않았거나 문자열 escape가 완성되지 않았습니다.');
  }

  const originalJsonText = source.slice(rootIndex, rootEnd);
  let jsonText = originalJsonText;
  let payload;
  let repairActions = [];
  try {
    assertNoDuplicateJsonKeys(jsonText);
    payload = JSON.parse(jsonText);
  } catch (strictError) {
    const repaired = repairSafeJsonSyntax(jsonText);
    if (!repaired.actions.length) throw strictError;
    try {
      assertNoDuplicateJsonKeys(repaired.text);
      payload = JSON.parse(repaired.text);
      jsonText = repaired.text;
      repairActions = repaired.actions;
    } catch (_repairError) {
      throw strictError;
    }
  }
  const trailing = source.slice(rootEnd)
    .replace(/^```(?:json|text|markdown|md)?[ \t]*$/gim, '')
    .trim();
  if (trailing.length > MAX_IGNORED_JSON_AFFIX_CHARS) {
    throw new SyntaxError(`JSON 뒤의 무시 가능한 설명은 ${MAX_IGNORED_JSON_AFFIX_CHARS.toLocaleString()}자를 초과할 수 없습니다.`);
  }
  const anotherJsonRoot = /(?:\{[ \t\r\n]*(?:["}])|\[[ \t\r\n]*(?:[\[{"\]\d-]|true\b|false\b|null\b))/m;
  if (JSON_SEPARATOR_LINE_PATTERN.test(trailing) || anotherJsonRoot.test(trailing)) {
    throw new SyntaxError('최상위 JSON 값이 두 개 이상 감지되었습니다.');
  }
  return {
    text: jsonText,
    originalText: originalJsonText,
    payload,
    repairActions,
    ignoredLeading: leading,
    ignoredTrailing: trailing
  };
}

export function splitAtRecoverableJsonSeparator(value) {
  const text = String(value || '').replace(/^\uFEFF/, '').trim();
  if (text.length > MAX_COMBINED_RESPONSE_CHARS) {
    throw new SyntaxError(`전체 GPT 응답은 ${MAX_COMBINED_RESPONSE_CHARS.toLocaleString()}자를 초과할 수 없습니다.`);
  }
  const envelope = unwrapCombinedResponseEnvelope(text);
  const candidates = [...new Set([envelope, text].filter(Boolean))];
  let fallback = null;

  for (const source of candidates) {
    const separators = [...source.matchAll(JSON_SEPARATOR_PATTERN)];
    let parsedSuffix = null;
    let selectedSeparator = null;
    let lastError = null;
    const separator = separators.at(-1) || null;
    if (separator) {
      try {
        parsedSuffix = parseTopLevelJsonSuffix(source.slice(separator.index + separator[0].length));
        selectedSeparator = separator;
      } catch (error) {
        lastError = error;
      }
    }
    const result = {
      source,
      separators,
      separator: selectedSeparator,
      parsedSuffix,
      lastError,
      markdown: selectedSeparator
        ? source.slice(0, selectedSeparator.index).trim().replace(/^```(?:text|markdown|md)?[ \t]*\r?\n/i, '')
        : ''
    };
    if (parsedSuffix) return result;
    if (!fallback || separators.length) fallback = result;
  }

  return fallback || {
    source: text,
    separators: [],
    separator: null,
    parsedSuffix: null,
    lastError: null,
    markdown: ''
  };
}
