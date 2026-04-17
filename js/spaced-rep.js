/**
 * spaced-rep.js
 * 间隔重复算法：Leitner 5盒子 + 简化 SM-2
 *
 * 盒子规则：
 *   盒子1（圆石）→ 每次复习
 *   盒子2（泥土）→ 答对后，每2天复习
 *   盒子3（橡木）→ 连续答对后，每4天
 *   盒子4（铁块）→ 稳定掌握，每8天
 *   盒子5（绿宝石）→ 永久词库，每14天
 *
 * SM-2 简化版：
 *   初始：I=1, EF=2.5
 *   记住：I = I × EF（上限30天）；EF = EF+0.1（上限3.0）；box+1
 *   有点忘：EF = EF-0.1（最低1.3）
 *   不会：I=1, EF=EF-0.2（最低1.3），box=1
 */

export const BOX_LABELS = ['', '🔴圆石', '🟡泥土', '🟢橡木', '🔵铁块', '🟣绿宝石'];
export const BOX_COLORS = ['', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];
export const BOX_INTERVALS = [0, 1, 2, 4, 8, 14]; // 盒子N的建议间隔天数

export const RATING = {
  CORRECT: 'correct',
  ALMOST: 'almost',
  WRONG: 'wrong'
};

/**
 * 根据复习反馈，计算单词的新状态
 * @param {object} word - 单词对象（含 interval, ef, box）
 * @param {string} rating - 'correct' | 'almost' | 'wrong'
 * @returns {object} 更新后的字段
 */
export function computeNextReview(word, rating) {
  const today = new Date().toISOString().split('T')[0];
  let interval = word.interval || 1;
  let ef = word.ef || 2.5;
  let box = word.box || 1;

  if (rating === RATING.CORRECT) {
    interval = Math.min(30, Math.round(interval * ef));
    ef = Math.min(3.0, parseFloat((ef + 0.1).toFixed(2)));
    box = Math.min(5, box + 1);
  } else if (rating === RATING.ALMOST) {
    ef = Math.max(1.3, parseFloat((ef - 0.1).toFixed(2)));
    // interval 不变，但今天要再复习一次
  } else {
    // WRONG
    interval = 1;
    ef = Math.max(1.3, parseFloat((ef - 0.2).toFixed(2)));
    box = 1;
  }

  const nextReview = rating === RATING.ALMOST
    ? today  // 今天还要复习
    : new Date(Date.now() + interval * 86400000).toISOString().split('T')[0];

  return {
    interval,
    ef,
    box,
    nextReview,
    lastReview: today,
    timesReviewed: (word.timesReviewed || 0) + 1,
    timesCorrect: rating === RATING.CORRECT
      ? (word.timesCorrect || 0) + 1
      : (word.timesCorrect || 0)
  };
}

/**
 * 获取今日+过期待复习的单词（来自 store）
 */
export function getDueWords(store) {
  const today = new Date().toISOString().split('T')[0];
  return store.getAll().filter(w => w.nextReview && w.nextReview <= today);
}

/**
 * 获取复习优先级排序（盒子1优先，最早过期优先）
 */
export function getPrioritizedReviewQueue(store) {
  const due = getDueWords(store);
  // 按盒子升序（1→5）、按 nextReview 升序（最老的先复习）
  return due.sort((a, b) => {
    if (a.box !== b.box) return a.box - b.box;
    return a.nextReview.localeCompare(b.nextReview);
  });
}
