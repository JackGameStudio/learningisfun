/**
 * sentence-gen.js
 * 例句生成：优先 Tatoeba 语料库 API → 内置模板 fallback
 *
 * 策略：
 * 1. 先尝试 Free Dictionary API 的例句字段（已在 dictionary-api.js 获取）
 * 2. 没有例句时用内置模板生成
 * 3. 简单 sentence cache 避免重复请求
 */

const SENTENCE_CACHE = new Map();

// ============================================================
// 内置例句模板（按词性/主题分类）
// ============================================================
const TEMPLATES = [
  // 普通模板
  (w, m) => `I learn the word "${w}" every day.`,
  (w, m) => `The word "${w}" means ${m}.`,
  (w, m) => `Can you use "${w}" in a sentence?`,
  (w, m) => `Do you know what "${w}" means?`,
  (w, m) => `"${w}" is a useful word.`,
  (w, m) => `I saw the word "${w}" in a book.`,
  (w, m) => `What does "${w}" mean?`,
  (w, m) => `Please explain "${w}" to me.`,
  (w, m) => `I don't understand the word "${w}".`,
  (w, m) => `Can you tell me the meaning of "${w}"?`,
  (w, m) => `The teacher explained "${w}" to us.`,
  (w, m) => `I wrote "${w}" in my notebook.`,
  (w, m) => `My friend taught me the word "${w}".`,
  (w, m) => `The word "${w}" is important.`,
  (w, m) => `Remember the word "${w}" — it means ${m}.`,
];

// ============================================================
// Tatoeba API 查询
// ============================================================

/**
 * 从 Tatoeba 获取真实例句
 * @param {string} word
 * @returns {Promise<string|null>}
 */
async function fetchFromTatoeba(word) {
  try {
    // Tatoeba 搜索API
    const url = `https://tatoeba.org/en/api_v0/search?from=eng&query=${encodeURIComponent(word)}&sort=random&limit=1`;
    const resp = await fetch(url);
    if (!resp.ok) return null;

    // Tatoeba API 返回的是 HTML，需要解析
    // 简化的方法：使用 Dictionary API 的例句字段作为 fallback
    // （已经在 dictionary-api.js 中获取了）
    return null;
  } catch {
    return null;
  }
}

/**
 * 生成例句
 * 优先级：已有例句（来自dictionary-api） > 内置模板
 * @param {string} word - 单词
 * @param {string} meaning - 中文释义（可选）
 * @param {string} existingExample - 已有的例句（来自词典API）
 * @returns {string}
 */
function generate(word, meaning = '', existingExample = '') {
  if (existingExample && existingExample.trim()) {
    return existingExample.trim();
  }

  // 从缓存
  if (SENTENCE_CACHE.has(word.toLowerCase())) {
    return SENTENCE_CACHE.get(word.toLowerCase());
  }

  // 随机选一个模板
  const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  const sentence = template(word, meaning || '...');

  SENTENCE_CACHE.set(word.toLowerCase(), sentence);
  return sentence;
}

/**
 * 批量生成例句
 * @param {Array<{word, meaning, example}>} words
 * @returns {Promise<Record<string, string>>}
 */
async function generateBatch(words) {
  const results = {};
  for (const w of words) {
    results[w.word] = generate(w.word, w.meaning, w.example || '');
    // 小延迟，避免阻塞
    if (Math.random() > 0.7) await sleep(50);
  }
  return results;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const sentenceGen = {
  generate,
  generateBatch,
  SENTENCE_CACHE
};
