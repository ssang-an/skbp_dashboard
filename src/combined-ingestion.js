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

const SIMPLE_JSON_ESCAPE_CHARS = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't']);
const NON_JSON_UNICODE_WHITESPACE = /[\u0085\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u2060\u3000\ufeff]/;
const SIMPLE_ASCII_IDENTIFIER_START = /[A-Za-z_]/;
const SIMPLE_ASCII_IDENTIFIER_PART = /[A-Za-z0-9_]/;
const BARE_URL_STRING_FIELD_NAMES = new Set(['source_url']);

function escapedJsonControlCharacter(char) {
  const serialized = JSON.stringify(char);
  return serialized.slice(1, -1);
}

function previousNonWhitespace(value, start) {
  for (let index = start - 1; index >= 0; index -= 1) {
    if (!/\s/.test(value[index])) return value[index];
  }
  return '';
}

function nextNonWhitespace(value, start) {
  for (let index = start; index < value.length; index += 1) {
    if (!/\s/.test(value[index])) return value[index];
  }
  return '';
}

function jsonStringTokenEnd(value, start) {
  let escaped = false;
  for (let index = start + 1; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) escaped = false;
    else if (char === '\\') escaped = true;
    else if (char === '"') return index + 1;
  }
  return -1;
}

function knownBareUrlValueEnd(value, start) {
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (char === '}' || char === ']') return index;
    if (char !== ',') continue;
    let lookahead = index + 1;
    while (/\s/.test(value[lookahead] || '')) lookahead += 1;
    if (['"', '}', ']'].includes(value[lookahead] || '')) return index;
  }
  return value.length;
}

function quoteKnownBareUrlStringValues(value) {
  const source = String(value || '');
  let output = '';
  let repairedCount = 0;

  for (let index = 0; index < source.length;) {
    if (source[index] !== '"') {
      output += source[index];
      index += 1;
      continue;
    }

    const keyEnd = jsonStringTokenEnd(source, index);
    if (keyEnd < 0) {
      output += source.slice(index);
      break;
    }
    const keyToken = source.slice(index, keyEnd);
    output += keyToken;

    let colonIndex = keyEnd;
    while (/\s/.test(source[colonIndex] || '')) colonIndex += 1;
    if (source[colonIndex] !== ':') {
      index = keyEnd;
      continue;
    }

    let fieldName;
    try {
      fieldName = JSON.parse(keyToken);
    } catch (_error) {
      index = keyEnd;
      continue;
    }
    if (!BARE_URL_STRING_FIELD_NAMES.has(fieldName)) {
      index = keyEnd;
      continue;
    }

    let valueStart = colonIndex + 1;
    while (/\s/.test(source[valueStart] || '')) valueStart += 1;
    if (!/^https?:\/\//i.test(source.slice(valueStart))) {
      index = keyEnd;
      continue;
    }

    const valueEnd = knownBareUrlValueEnd(source, valueStart);
    const rawUrl = source.slice(valueStart, valueEnd).trimEnd();
    if (!/^https?:\/\/\S+$/i.test(rawUrl)) {
      index = keyEnd;
      continue;
    }

    output += source.slice(keyEnd, valueStart);
    output += JSON.stringify(rawUrl);
    output += source.slice(valueStart + rawUrl.length, valueEnd);
    repairedCount += 1;
    index = valueEnd;
  }

  return { text: output, repairedCount };
}

function normalizeConservativeJsonDialect(value) {
  const source = String(value || '');
  let output = '';
  let inString = false;
  let escaped = false;
  let pythonLiteralCount = 0;
  let unquotedKeyCount = 0;

  for (let index = 0; index < source.length;) {
    const char = source[index];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      index += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      index += 1;
      continue;
    }
    if (!SIMPLE_ASCII_IDENTIFIER_START.test(char)) {
      output += char;
      index += 1;
      continue;
    }

    let tokenEnd = index + 1;
    while (tokenEnd < source.length && SIMPLE_ASCII_IDENTIFIER_PART.test(source[tokenEnd])) {
      tokenEnd += 1;
    }
    const token = source.slice(index, tokenEnd);
    const previous = previousNonWhitespace(source, index);
    const next = nextNonWhitespace(source, tokenEnd);
    if (next === ':' && (previous === '{' || previous === ',')) {
      output += JSON.stringify(token);
      unquotedKeyCount += 1;
    } else if (
      Object.prototype.hasOwnProperty.call({ True: true, False: false, None: null }, token)
      && (previous === ':' || previous === '[' || previous === ',')
    ) {
      output += ({ True: 'true', False: 'false', None: 'null' })[token];
      pythonLiteralCount += 1;
    } else {
      output += token;
    }
    index = tokenEnd;
  }

  return { text: output, pythonLiteralCount, unquotedKeyCount };
}

function removeTrailingJsonCommas(value) {
  const source = String(value || '');
  let output = '';
  let inString = false;
  let escaped = false;
  let trailingCommaCount = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === ',') {
      let lookahead = index + 1;
      while (/\s/.test(source[lookahead] || '')) lookahead += 1;
      if (source[lookahead] === '}' || source[lookahead] === ']') {
        trailingCommaCount += 1;
        continue;
      }
    }
    output += char;
  }
  return { text: output, trailingCommaCount };
}

export function safePreprocessJson(value) {
  const bareUrlRepair = quoteKnownBareUrlStringValues(value);
  const source = bareUrlRepair.text;
  let lexical = '';
  let inString = false;
  let commentCount = 0;
  let escapedControlCount = 0;
  let invalidEscapeCount = 0;
  let unicodeWhitespaceCount = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (char === '"') {
        inString = false;
        lexical += char;
        continue;
      }
      if (char === '\\') {
        const next = source[index + 1];
        if (SIMPLE_JSON_ESCAPE_CHARS.has(next)) {
          lexical += `${char}${next}`;
          index += 1;
          continue;
        }
        if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(source.slice(index + 2, index + 6))) {
          lexical += source.slice(index, index + 6);
          index += 5;
          continue;
        }
        if (next === undefined) {
          lexical += char;
          continue;
        }
        lexical += '\\\\';
        invalidEscapeCount += 1;
        continue;
      }
      if (char.charCodeAt(0) <= 0x1f) {
        lexical += escapedJsonControlCharacter(char);
        escapedControlCount += 1;
        continue;
      }
      lexical += char;
      continue;
    }

    if (char === '"') {
      inString = true;
      lexical += char;
      continue;
    }
    if (char === '/' && source[index + 1] === '/') {
      commentCount += 1;
      lexical += '  ';
      index += 2;
      while (index < source.length && source[index] !== '\n' && source[index] !== '\r') {
        lexical += ' ';
        index += 1;
      }
      index -= 1;
      continue;
    }
    if (char === '/' && source[index + 1] === '*') {
      commentCount += 1;
      lexical += '  ';
      index += 2;
      let closed = false;
      while (index < source.length) {
        if (source[index] === '*' && source[index + 1] === '/') {
          lexical += '  ';
          index += 1;
          closed = true;
          break;
        }
        lexical += source[index] === '\n' || source[index] === '\r' ? source[index] : ' ';
        index += 1;
      }
      if (!closed) throw new SyntaxError('종료되지 않은 JSON block comment가 감지되었습니다.');
      continue;
    }
    if (NON_JSON_UNICODE_WHITESPACE.test(char)) {
      lexical += ' ';
      unicodeWhitespaceCount += 1;
      continue;
    }
    lexical += char;
  }

  const dialect = normalizeConservativeJsonDialect(lexical);
  const withoutTrailingCommas = removeTrailingJsonCommas(dialect.text);
  const actions = [];
  if (withoutTrailingCommas.trailingCommaCount) {
    actions.push(`trailing comma ${withoutTrailingCommas.trailingCommaCount}개 제거`);
  }
  if (escapedControlCount) actions.push(`문자열 제어문자 ${escapedControlCount}개 escape`);
  if (commentCount) actions.push(`JSON comment ${commentCount}개 제거`);
  if (invalidEscapeCount) actions.push(`잘못된 문자열 escape ${invalidEscapeCount}개 literal backslash로 보존`);
  if (unicodeWhitespaceCount) actions.push(`JSON 외부 Unicode 공백 ${unicodeWhitespaceCount}개 정규화`);
  if (dialect.pythonLiteralCount) actions.push(`Python literal ${dialect.pythonLiteralCount}개 JSON literal로 정규화`);
  if (dialect.unquotedKeyCount) actions.push(`따옴표 없는 object key ${dialect.unquotedKeyCount}개 보정`);
  if (bareUrlRepair.repairedCount) {
    actions.push(`source_url URL ${bareUrlRepair.repairedCount}개 문자열 따옴표 보정`);
  }
  return { text: withoutTrailingCommas.text, actions };
}

export function parseTopLevelJsonSuffix(value) {
  const rawSource = String(value || '').replace(/^\uFEFF/, '').trim();
  const initialBareUrlRepair = quoteKnownBareUrlStringValues(rawSource);
  const source = initialBareUrlRepair.text;
  const rootMatch = /^(?:```json[^\S\r\n]*\r?\n)?(?:[^\S\r\n]|\u200b|\u2060)*([\[{])/im.exec(source);
  if (!rootMatch) throw new SyntaxError('JSON suffix에서 줄 시작의 최상위 { 또는 [를 찾지 못했습니다.');

  const rootIndex = rootMatch.index + rootMatch[0].lastIndexOf(rootMatch[1]);
  const leading = source.slice(0, rootIndex).replace(/^```json[ \t]*$/gim, '').trim();
  if (leading.length > MAX_IGNORED_JSON_AFFIX_CHARS) {
    throw new SyntaxError(`JSON 앞의 무시 가능한 설명은 ${MAX_IGNORED_JSON_AFFIX_CHARS.toLocaleString()}자를 초과할 수 없습니다.`);
  }
  const stack = [];
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  let rootEnd = -1;

  for (let index = rootIndex; index < source.length; index += 1) {
    const char = source[index];
    if (inLineComment) {
      if (char === '\n' || char === '\r') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (char === '*' && source[index + 1] === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }
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
    if (char === '/' && source[index + 1] === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && source[index + 1] === '*') {
      inBlockComment = true;
      index += 1;
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

  if (inBlockComment) {
    throw new SyntaxError('종료되지 않은 JSON block comment가 감지되었습니다.');
  }
  if (rootEnd < 0 || inString || stack.length) {
    throw new SyntaxError('최상위 JSON이 닫히지 않았거나 문자열 escape가 완성되지 않았습니다.');
  }

  const originalJsonText = source.slice(rootIndex, rootEnd);
  let jsonText = originalJsonText;
  let payload;
  let repairActions = initialBareUrlRepair.repairedCount
    ? [`source_url URL ${initialBareUrlRepair.repairedCount}개 문자열 따옴표 보정`]
    : [];
  try {
    payload = JSON.parse(jsonText);
    assertNoDuplicateJsonKeys(jsonText);
  } catch (strictError) {
    const repaired = safePreprocessJson(jsonText);
    if (!repaired.actions.length) throw strictError;
    try {
      payload = JSON.parse(repaired.text);
      assertNoDuplicateJsonKeys(repaired.text);
      jsonText = repaired.text;
      repairActions = [...repairActions, ...repaired.actions];
    } catch (repairError) {
      throw repairError;
    }
  }
  const trailing = source.slice(rootEnd)
    .replace(/^```(?:json|text|markdown|md)?[ \t]*$/gim, '')
    .trim();
  if (trailing.length > MAX_IGNORED_JSON_AFFIX_CHARS) {
    throw new SyntaxError(`JSON 뒤의 무시 가능한 설명은 ${MAX_IGNORED_JSON_AFFIX_CHARS.toLocaleString()}자를 초과할 수 없습니다.`);
  }
  const anotherJsonRoot = /(?:\{[ \t\r\n]*(?:["}])|\[[ \t\r\n]*(?:[\[{"\]\d-]|true\b|false\b|null\b))/m;
  let trailingForRootCheck = trailing;
  try {
    trailingForRootCheck = safePreprocessJson(trailing).text;
  } catch (_error) {
    // Trailing prose is not part of the stored JSON. Keep the original text for
    // the conservative second-root check if it is not independently repairable.
  }
  if (JSON_SEPARATOR_LINE_PATTERN.test(trailing) || anotherJsonRoot.test(trailingForRootCheck)) {
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
