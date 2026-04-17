/**
 * pdf-extractor.js
 * 从 PDF 文件中提取英文单词
 * 使用 pdf.js (CDN) 在浏览器端解析，无需后端
 */

// 常见词过滤列表（英语最常见的 ~80 个词，PDF 中大量出现但无学习价值）
const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'is', 'was', 'are', 'been', 'being', 'has', 'had', 'its', 'may', 'can',
  'could', 'should', 'would', 'will', 'shall', 'just', 'than', 'too', 'very',
  'so', 'such', 'into', 'then', 'them', 'these', 'those', 'other', 'some',
  'any', 'no', 'only', 'own', 'same', 'over', 'after', 'before', 'between',
  'under', 'again', 'where', 'when', 'why', 'how', 'all', 'each', 'both',
  'most', 'few', 'more', 'most', 'your', 'our', 'his', 'her', 'its', 'their',
  'him', 'her', 'us', 'me', 'himself', 'herself', 'themselves', 'ourselves'
]);

// 只保留符合以下条件的英文单词：
// - 长度 3-20 个字母
// - 全小写字母（去除含数字、连字符、缩写等）
const WORD_REGEX = /^[a-z]{3,20}$/;

/**
 * 提取 PDF 文件中的英文单词列表（去重、过滤）
 * @param {File} file - PDF File 对象
 * @returns {Promise<{words: string[], totalPages: number, totalChars: number}>}
 */
async function extractFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const numPages = pdf.numPages;
  let allText = '';

  // 逐页提取文字
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // 按阅读顺序拼接文字（保留空格分隔）
    const pageText = content.items
      .map(item => item.str)
      .join(' ');
    allText += pageText + ' ';
  }

  // 解析单词
  const words = parseWords(allText);

  return {
    words,
    totalPages: numPages,
    totalChars: allText.length
  };
}

/**
 * 从纯文本提取英文单词
 * @param {string} text
 * @returns {string[]}
 */
function extractFromText(text) {
  return parseWords(text);
}

/**
 * 解析文本中的英文单词（去重 + 过滤）
 */
function parseWords(text) {
  // 提取所有连续英文字母序列（全小写）
  const rawWords = text.match(/[a-z]+/gi) || [];

  // 去重
  const unique = [...new Set(rawWords.map(w => w.toLowerCase()))];

  // 过滤：停用词、长度不符
  const filtered = unique
    .filter(w => WORD_REGEX.test(w))
    .filter(w => !STOP_WORDS.has(w))
    .sort();

  return filtered;
}

export const pdfExtractor = {
  extractFromPDF,
  extractFromText
};
