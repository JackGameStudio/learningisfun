/**
 * vocabulary-store.js
 * 词库数据管理：单词对象、词库集合、LocalStorage 持久化
 */

const STORAGE_KEY = 'lif_vocabulary';

export const DEFAULT_WORD = {
  word: '',           // 单词（必填，小写存储）
  meaning: '',        // 中文释义
  phonetic: '',       // 音标（可选）
  example: '',        // 例句
  prefix: '',         // 前缀（自动分析）
  root: '',           // 词根（自动分析）
  suffix: '',         // 后缀（自动分析）

  // 间隔重复数据
  box: 1,             // 当前盒子（1-5）
  ef: 2.5,            // 难度因子 easiness factor
  n: 0,               // 连续正确次数
  interval: 1,        // 当前间隔（天）
  nextReview: '',     // 下次复习日期 YYYY-MM-DD
  lastReview: '',     // 上次复习日期 YYYY-MM-DD
  timesReviewed: 0,    // 总复习次数
  timesCorrect: 0,    // 正确次数

  // 元数据
  createdAt: '',      // 添加日期
  source: ''          // 来源（PDF名 / 手动）
};

class VocabularyStore {
  constructor() {
    this.words = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.words));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  /**
   * 导入一批单词（自动去重、合并）
   * @param {Array} wordList - [{word, meaning, ...}, ...]
   * @param {string} source - 来源标识
   * @returns {number} 实际新增的词数
   */
  importWords(wordList, source = 'import') {
    const today = new Date().toISOString().split('T')[0];
    const existing = new Set(this.words.map(w => w.word.toLowerCase()));

    const newWords = wordList
      .filter(w => w.word && String(w.word).trim())
      .filter(w => !existing.has(String(w.word).trim().toLowerCase()))
      .map(w => ({
        ...DEFAULT_WORD,
        ...w,
        word: String(w.word).trim().toLowerCase(),
        createdAt: today,
        source,
        nextReview: today // 今天就要复习
      }));

    this.words.push(...newWords);
    this._save();
    return newWords.length;
  }

  /** 获取所有单词 */
  getAll() {
    return [...this.words];
  }

  /** 获取今日+过期待复习的单词 */
  getDueWords() {
    const today = new Date().toISOString().split('T')[0];
    return this.words.filter(w => w.nextReview && w.nextReview <= today);
  }

  /** 获取待学新词（尚未复习过的）*/
  getNewWords(limit = 5) {
    return this.words.filter(w => w.timesReviewed === 0).slice(0, limit);
  }

  /** 根据单词获取对象 */
  getWord(wordKey) {
    return this.words.find(w => w.word === wordKey) || null;
  }

  /** 更新单词（复习反馈后调用）*/
  updateWord(wordKey, updates) {
    const idx = this.words.findIndex(w => w.word === wordKey);
    if (idx === -1) return false;
    this.words[idx] = { ...this.words[idx], ...updates };
    this._save();
    return true;
  }

  /** 删除单词 */
  deleteWord(wordKey) {
    const before = this.words.length;
    this.words = this.words.filter(w => w.word !== wordKey);
    if (this.words.length < before) {
      this._save();
      return true;
    }
    return false;
  }

  /** 批量删除单词 */
  deleteWords(wordKeys) {
    const keySet = new Set(wordKeys);
    this.words = this.words.filter(w => !keySet.has(w.word));
    this._save();
  }

  /** 获取统计数据 */
  getStats() {
    const total = this.words.length;
    if (total === 0) {
      return { total: 0, mastered: 0, learning: 0, dueToday: 0, avgCorrect: 0, newWords: 0 };
    }
    const mastered = this.words.filter(w => w.box === 5).length;
    const learning = this.words.filter(w => w.box < 5).length;
    const dueToday = this.getDueWords().length;
    const newWords = this.words.filter(w => w.timesReviewed === 0).length;

    const wordsWithReviews = this.words.filter(w => w.timesReviewed > 0);
    const avgCorrect = wordsWithReviews.length > 0
      ? Math.round(
          wordsWithReviews.reduce((s, w) => s + (w.timesCorrect / w.timesReviewed), 0)
          / wordsWithReviews.length * 100
        )
      : 0;

    return { total, mastered, learning, dueToday, avgCorrect, newWords };
  }

  /** 获取各盒子的词数分布 */
  getBoxDistribution() {
    const dist = [0, 0, 0, 0, 0];
    this.words.forEach(w => {
      if (w.box >= 1 && w.box <= 5) dist[w.box - 1]++;
    });
    return dist;
  }

  /** 导出JSON备份 */
  exportJSON() {
    return JSON.stringify(
      { words: this.words, exportedAt: new Date().toISOString() },
      null, 2
    );
  }

  /** 导入JSON备份（完全覆盖）*/
  importJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (Array.isArray(data.words)) {
        this.words = data.words;
        this._save();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /** 清空词库 */
  clearAll() {
    this.words = [];
    this._save();
  }
}

export const store = new VocabularyStore();
