/**
 * island.js
 * 岛屿建造可视化（简化版）
 * 建材数量 = 词汇量，里程碑触发岛屿升级
 */

// 里程碑定义
export const MILESTONES = [
  { threshold: 10,  label: '草地', emoji: '🌿', color: '#22c55e', description: '开垦了一块草地！' },
  { threshold: 25,  label: '树木', emoji: '🌳', color: '#16a34a', description: '种下了第一批树木！' },
  { threshold: 50,  label: '房屋', emoji: '🏠', color: '#eab308', description: '建起了第一座房屋！' },
  { threshold: 100, label: '城堡', emoji: '🏰', color: '#a855f7', description: '拥有了壮观的词汇城堡！' },
];

/**
 * 获取当前岛屿等级（1-4）
 */
export function getIslandLevel(wordCount) {
  if (wordCount >= 100) return 4;
  if (wordCount >= 50)  return 3;
  if (wordCount >= 25)  return 2;
  if (wordCount >= 10)  return 1;
  return 0;
}

/**
 * 获取下一个里程碑
 */
export function getNextMilestone(wordCount) {
  for (const m of MILESTONES) {
    if (wordCount < m.threshold) return m;
  }
  return null;
}

/**
 * 获取已解锁的里程碑
 */
export function getUnlockedMilestones(wordCount) {
  return MILESTONES.filter(m => wordCount >= m.threshold);
}

/**
 * 获取岛屿 CSS emoji 组成
 */
export function getIslandEmojis(wordCount) {
  const level = getIslandLevel(wordCount);
  const base = ['🌊', '🌿🌊', '🌿🌳🌊', '🌿🏠🌳🌊', '🏰🌿🏠🌳🌊'];
  return base[level] || '🌊';
}

/**
 * 获取岛屿名称
 */
export function getIslandName(wordCount) {
  if (wordCount >= 100) return '词汇王国';
  if (wordCount >= 50)  return '词源城堡';
  if (wordCount >= 25)  return '词汇庄园';
  if (wordCount >= 10)  return '词汇小岛';
  return '新建小岛';
}

/**
 * 渲染岛屿 HTML（CSS像素风）
 */
export function renderIslandHTML(wordCount) {
  const level = getIslandLevel(wordCount);
  const emojis = getIslandEmojis(wordCount);
  const name = getIslandName(wordCount);
  const unlocked = getUnlockedMilestones(wordCount);
  const next = getNextMilestone(wordCount);

  const progress = next
    ? Math.round((wordCount / next.threshold) * 100)
    : 100;

  return `
    <div class="island-container" style="text-align:center; padding: var(--space-lg);">
      <div class="island-visual" style="font-size:4rem; margin: var(--space-md) 0; line-height:1.2;">
        ${emojis}
      </div>
      <div style="font-size:1.5rem; font-weight:700; color:#4ade80;">Lv.${level} ${name}</div>
      <div class="text-muted mt-sm">${wordCount} 个词汇建材</div>

      ${next ? `
      <div class="mt-md">
        <div class="flex justify-between mb-sm" style="font-size:0.8rem;">
          <span>${next.emoji} ${next.label}</span>
          <span>${wordCount}/${next.threshold}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width:${progress}%; background:${next.color};"></div>
        </div>
      </div>
      ` : '<div class="mt-md" style="color:#a855f7;">🎉 已解锁全部里程碑！</div>'}

      ${unlocked.length > 0 ? `
      <div class="mt-md" style="font-size:0.8rem; color:var(--color-text-muted);">
        已解锁：${unlocked.map(m => `${m.emoji}${m.label}`).join(' ')}
      </div>
      ` : ''}
    </div>
  `;
}
