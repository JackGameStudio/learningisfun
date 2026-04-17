/**
 * app.js — LearningIsFun 主程序
 * 路由、视图渲染、状态管理
 */

import { store } from './vocabulary-store.js';
import { pdfExtractor } from './pdf-extractor.js';

// ===== State =====
let currentView = 'home';

// ===== Routing =====
function navigate(view) {
  currentView = view;
  render();
}

// ===== Render Dispatcher =====
function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  switch (currentView) {
    case 'home':      app.appendChild(renderHome());      break;
    case 'import':    app.appendChild(renderImport());    break;
    case 'study':     app.appendChild(renderStudy());     break;
    case 'island':    app.appendChild(renderIsland());    break;
    case 'stats':     app.appendChild(renderStats());     break;
    case 'wordbank':  app.appendChild(renderWordBank());  break;
    default:          app.appendChild(renderHome());      break;
  }

  app.appendChild(renderNav());
}

// ===== Views =====

function renderHome() {
  const stats = store.getStats();
  const container = document.createElement('div');
  container.className = 'animate-fade-in';
  container.innerHTML = `
    <div style="text-align:center; margin-bottom:var(--space-lg);">
      <h1>🏝️ LearningIsFun</h1>
      <p class="text-muted mt-sm">每天10分钟，轻松背单词</p>
    </div>

    <!-- 统计卡片 -->
    <div class="card mb-md">
      <div class="flex justify-between items-center mb-sm">
        <span>📚 我的词库</span>
        <strong>${stats.total} 词</strong>
      </div>
      <div class="flex gap-md text-center" style="font-size:0.8rem; color:var(--color-text-muted);">
        <div><strong style="color:var(--color-success)">${stats.mastered}</strong><br>已掌握</div>
        <div><strong style="color:var(--color-warning)">${stats.learning}</strong><br>学习中</div>
        <div><strong style="color:var(--color-accent)">${stats.newWords}</strong><br>新词</div>
      </div>
    </div>

    <!-- 今日任务 -->
    <div class="card mb-md" style="border-left: 4px solid var(--color-accent);">
      <div class="flex justify-between items-center">
        <div>
          <div style="font-size:1.5rem; font-weight:700;">${stats.dueToday}</div>
          <p class="text-muted" style="margin:0">今日待复习</p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:1.5rem; font-weight:700; color:var(--color-accent);">${stats.avgCorrect}%</div>
          <p class="text-muted" style="margin:0">正确率</p>
        </div>
      </div>
    </div>

    <!-- 主按钮 -->
    <button class="btn btn-primary btn-lg mb-md" onclick="window.__lif.navigate('study')"
      ${stats.total === 0 ? 'disabled' : ''}>
      ${stats.total === 0 ? '📚 先导入词库' : '🚀 开始刷词'}
    </button>

    ${stats.total === 0 ? `
    <div class="card text-center" style="border:2px dashed var(--color-primary); background:transparent;">
      <p>👆 点击上方按钮，上传英语课本 PDF 开始</p>
    </div>
    ` : ''}
  `;
  return container;
}

function renderImport() {
  const container = document.createElement('div');
  container.className = 'animate-fade-in';

  let extractedWords = [];
  let lookupProgress = { done: 0, total: 0 };

  container.innerHTML = `
    <div class="flex items-center gap-sm mb-md">
      <button class="btn btn-sm btn-secondary" onclick="window.__lif.navigate('home')">← 返回</button>
      <h2>📄 导入 PDF</h2>
    </div>

    <div class="card mb-md">
      <p class="mb-md">上传英语课本 PDF，系统自动提取所有英文生词。</p>
      <input type="file" id="pdfInput" accept=".pdf" class="mb-md" />
      <button id="extractBtn" class="btn btn-primary" disabled>🔍 提取单词</button>
    </div>

    <div id="previewArea" style="display:none;">
      <div class="card mb-md">
        <div class="flex justify-between items-center mb-sm">
          <h3>📋 预览</h3>
          <span id="wordCount" class="text-muted"></span>
        </div>
        <div id="wordList" style="max-height:200px; overflow-y:auto; font-size:0.8rem; color:var(--color-text-muted);"></div>
      </div>

      <div id="lookupProgress" class="card mb-md" style="display:none;">
        <p class="mb-sm">🔄 查词典进度：<span id="lookupStatus">0/0</span></p>
        <div class="progress-bar"><div id="lookupBar" class="progress-bar-fill" style="width:0%"></div></div>
      </div>

      <div id="importArea" style="display:none;">
        <div id="meaningPreview" class="card mb-md" style="max-height:300px; overflow-y:auto;"></div>
        <button id="importBtn" class="btn btn-success btn-lg">✅ 确认导入词库</button>
      </div>
    </div>

    <div id="successArea" class="card text-center" style="display:none; border:2px solid var(--color-success);">
      <div style="font-size:3rem;">🎉</div>
      <h3 class="mt-sm">导入成功！</h3>
      <p id="importResult" class="text-muted mt-sm"></p>
      <button class="btn btn-primary mt-md" onclick="window.__lif.navigate('home')">
        返回首页开始刷词 →
      </button>
    </div>
  `;

  // Attach event handlers
  const pdfInput = container.querySelector('#pdfInput');
  const extractBtn = container.querySelector('#extractBtn');
  const previewArea = container.querySelector('#previewArea');
  const wordList = container.querySelector('#wordList');
  const wordCount = container.querySelector('#wordCount');
  const lookupProgress = container.querySelector('#lookupProgress');
  const lookupStatus = container.querySelector('#lookupStatus');
  const lookupBar = container.querySelector('#lookupBar');
  const importArea = container.querySelector('#importArea');
  const meaningPreview = container.querySelector('#meaningPreview');
  const importBtn = container.querySelector('#importBtn');
  const successArea = container.querySelector('#successArea');
  const importResult = container.querySelector('#importResult');

  // File selected
  pdfInput.addEventListener('change', () => {
    extractBtn.disabled = !pdfInput.files[0];
  });

  // Extract words
  extractBtn.addEventListener('click', async () => {
    extractBtn.disabled = true;
    extractBtn.textContent = '⏳ 提取中...';

    try {
      const result = await pdfExtractor.extractFromPDF(pdfInput.files[0]);
      extractedWords = result.words;

      previewArea.style.display = 'block';
      wordCount.textContent = `共 ${extractedWords.length} 个候选词`;
      wordList.innerHTML = extractedWords
        .slice(0, 30)
        .map(w => `<span style="display:inline-block; padding:2px 6px; background:var(--color-bg); border-radius:4px; margin:2px;">${w}</span>`)
        .join('');
      if (extractedWords.length > 30) {
        wordList.innerHTML += `<br><span class="text-muted">... 还有 ${extractedWords.length - 30} 个词</span>`;
      }

      // Start looking up meanings
      lookupProgress.style.display = 'block';
      importArea.style.display = 'none';

      lookupProgress.done = 0;
      lookupProgress.total = extractedWords.length;

      // Build import data with placeholder meanings
      const importData = extractedWords.map(w => ({ word: w, meaning: '' }));

      // Show progress as we "lookup" (simplified - actual lookup in Task 4)
      const BATCH = 5;
      for (let i = 0; i < extractedWords.length; i += BATCH) {
        lookupProgress.done = Math.min(i + BATCH, extractedWords.length);
        lookupStatus.textContent = `${lookupProgress.done}/${extractedWords.length}`;
        lookupBar.style.width = `${(lookupProgress.done / extractedWords.length) * 100}%`;
        await sleep(200); // Visual delay
      }

      lookupProgress.style.display = 'none';
      importArea.style.display = 'block';

      // Preview import data
      meaningPreview.innerHTML = '<h3 class="mb-sm">📖 待导入词库预览（前20个）</h3>' +
        importData.slice(0, 20).map(w => `
          <div class="flex justify-between items-center" style="padding:4px 0; border-bottom:1px solid var(--color-bg);">
            <strong>${w.word}</strong>
            <span class="text-muted">${w.meaning || '释义待补'}</span>
          </div>
        `).join('');

      // Import
      importBtn.onclick = () => {
        const count = store.importWords(importData, pdfInput.files[0].name);
        importResult.textContent = `成功导入 ${count} 个单词`;
        previewArea.style.display = 'none';
        successArea.style.display = 'block';
      };

    } catch (e) {
      extractBtn.textContent = '🔍 提取单词';
      extractBtn.disabled = false;
      wordList.innerHTML = `<p style="color:var(--color-danger)">提取失败：${e.message}</p>`;
    }
  });

  return container;
}

function renderStudy() {
  const container = document.createElement('div');
  container.className = 'animate-fade-in';

  const dueWords = store.getDueWords();
  const newWords = store.getNewWords(5);

  if (dueWords.length === 0 && newWords.length === 0) {
    container.innerHTML = `
      <div class="card text-center" style="margin-top:var(--space-xl);">
        <div style="font-size:3rem;">🎉</div>
        <h2 class="mt-sm">今日任务完成！</h2>
        <p class="text-muted mt-sm">明天同一时间再来吧～</p>
        <button class="btn btn-primary mt-md" onclick="window.__lif.navigate('home')">返回首页</button>
      </div>
    `;
    return container;
  }

  container.innerHTML = `
    <div class="flex items-center gap-sm mb-md">
      <button class="btn btn-sm btn-secondary" onclick="window.__lif.navigate('home')">← 返回</button>
      <h2>🚀 刷词</h2>
    </div>

    <div class="card mb-md">
      <p>📝 <strong>${dueWords.length}</strong> 个待复习 &nbsp;|&nbsp; 🆕 <strong>${newWords.length}</strong> 个新词</p>
    </div>

    <button class="btn btn-primary btn-lg mb-md" onclick="window.__lif.startReview()"
      ${dueWords.length === 0 ? 'disabled' : ''}>
      📝 先复习（${dueWords.length}个）
    </button>

    <button class="btn btn-secondary btn-lg mb-md" onclick="window.__lif.startLearning()"
      ${newWords.length === 0 ? 'disabled' : ''}>
      🆕 学习新词（${newWords.length}个）
    </button>

    ${dueWords.length === 0 ? '<p class="text-center text-muted mt-md">今日复习完成，可以学习新词！</p>' : ''}
  `;

  return container;
}

function renderIsland() {
  const container = document.createElement('div');
  container.className = 'animate-fade-in';
  const stats = store.getStats();
  const boxDist = store.getBoxDistribution();

  // Island level based on word count
  let level = 1;
  if (stats.total >= 100) level = 4;
  else if (stats.total >= 50) level = 3;
  else if (stats.total >= 25) level = 2;
  else if (stats.total >= 10) level = 1;

  const milestones = [
    { count: 10, label: '草地', emoji: '🌿', done: stats.total >= 10 },
    { count: 25, label: '树木', emoji: '🌳', done: stats.total >= 25 },
    { count: 50, label: '房屋', emoji: '🏠', done: stats.total >= 50 },
    { count: 100, label: '城堡', emoji: '🏰', done: stats.total >= 100 },
  ];

  const boxLabels = ['圆石', '泥土', '橡木', '铁块', '绿宝石'];
  const boxEmojis = ['🔴', '🟡', '🟢', '🔵', '🟣'];

  container.innerHTML = `
    <div class="flex items-center gap-sm mb-md">
      <button class="btn btn-sm btn-secondary" onclick="window.__lif.navigate('home')">← 返回</button>
      <h2>🏝️ 我的词源岛</h2>
    </div>

    <!-- 岛屿展示 -->
    <div class="card text-center mb-md" style="background: linear-gradient(180deg, #1a4a6e 0%, #16213e 100%); padding:var(--space-xl);">
      <div style="font-size:4rem; margin-bottom:var(--space-sm);">${stats.total >= 10 ? '🏝️' : '🌊'}</div>
      <h2 style="color:#4ade80;">Lv.${level} 词源岛</h2>
      <p class="text-muted">已收集 ${stats.total} 个词汇建材</p>
    </div>

    <!-- 里程碑 -->
    <div class="card mb-md">
      <h3 class="mb-sm">🏆 里程碑</h3>
      ${milestones.map(m => `
        <div class="flex items-center gap-sm mb-sm" style="opacity:${m.done ? 1 : 0.4};">
          <span>${m.emoji}</span>
          <span>${m.label}</span>
          <span class="text-muted">(${m.count}词)</span>
          ${m.done ? '<span style="color:var(--color-success); margin-left:auto;">✅</span>' : `<span style="margin-left:auto; color:var(--color-text-muted);">${stats.total}/${m.count}</span>`}
        </div>
      `).join('')}
    </div>

    <!-- 盒子分布 -->
    <div class="card">
      <h3 class="mb-sm">📦 Leitner 盒子</h3>
      ${boxDist.map((count, i) => `
        <div class="flex items-center gap-sm mb-sm">
          <span>${boxEmojis[i]} ${boxLabels[i]}</span>
          <div class="progress-bar" style="flex:1; margin:0 var(--space-sm);">
            <div class="progress-bar-fill" style="width:${stats.total > 0 ? (count/stats.total*100) : 0}%; background:var(--color-accent);"></div>
          </div>
          <span class="text-muted" style="font-size:0.8rem; min-width:30px;">${count}</span>
        </div>
      `).join('')}
    </div>
  `;

  return container;
}

function renderStats() {
  const container = document.createElement('div');
  container.className = 'animate-fade-in';
  const stats = store.getStats();
  const boxDist = store.getBoxDistribution();
  const boxLabels = ['圆石 🔴', '泥土 🟡', '橡木 🟢', '铁块 🔵', '绿宝石 🟣'];

  container.innerHTML = `
    <div class="flex items-center gap-sm mb-md">
      <button class="btn btn-sm btn-secondary" onclick="window.__lif.navigate('home')">← 返回</button>
      <h2>📊 学习统计</h2>
    </div>

    <div class="card mb-md text-center">
      <div style="font-size:3rem; font-weight:700; color:var(--color-accent);">${stats.total}</div>
      <p class="text-muted">已学单词总数</p>
    </div>

    <div class="flex gap-md mb-md">
      <div class="card text-center" style="flex:1;">
        <div style="font-size:2rem; color:var(--color-success);">${stats.mastered}</div>
        <p class="text-muted" style="font-size:0.8rem;">已掌握</p>
      </div>
      <div class="card text-center" style="flex:1;">
        <div style="font-size:2rem; color:var(--color-warning);">${stats.learning}</div>
        <p class="text-muted" style="font-size:0.8rem;">学习中</p>
      </div>
      <div class="card text-center" style="flex:1;">
        <div style="font-size:2rem; color:var(--color-accent);">${stats.avgCorrect}%</div>
        <p class="text-muted" style="font-size:0.8rem;">正确率</p>
      </div>
    </div>

    <div class="card">
      <h3 class="mb-sm">📦 盒子分布</h3>
      ${boxDist.map((count, i) => `
        <div class="flex justify-between items-center mb-sm">
          <span>${boxLabels[i]}</span>
          <span><strong>${count}</strong> 词</span>
        </div>
      `).join('')}
    </div>

    <button class="btn btn-secondary mt-md" onclick="window.__lif.exportBackup()">
      💾 导出词库备份
    </button>
  `;

  return container;
}

function renderWordBank() {
  const container = document.createElement('div');
  container.className = 'animate-fade-in';
  const words = store.getAll();
  const boxLabels = ['', '🔴', '🟡', '🟢', '🔵', '🟣'];
  const boxColors = ['', 'var(--box-1)', 'var(--box-2)', 'var(--box-3)', 'var(--box-4)', 'var(--box-5)'];

  container.innerHTML = `
    <div class="flex items-center gap-sm mb-md">
      <button class="btn btn-sm btn-secondary" onclick="window.__lif.navigate('home')">← 返回</button>
      <h2>📚 词库管理</h2>
    </div>

    <button class="btn btn-primary mb-md" onclick="window.__lif.navigate('import')">
      📄 导入新 PDF
    </button>

    <div class="card">
      <h3 class="mb-sm">已导入 ${words.length} 个单词</h3>
      ${words.length === 0 ? '<p class="text-muted">还没有单词，去导入 PDF 吧！</p>' : ''}
      <div style="max-height:400px; overflow-y:auto;">
        ${words.map(w => `
          <div class="flex justify-between items-center"
            style="padding:6px 0; border-bottom:1px solid var(--color-bg);">
            <div>
              <strong>${w.word}</strong>
              ${w.meaning ? `<span class="text-muted" style="margin-left:8px;">${w.meaning}</span>` : ''}
            </div>
            <div class="flex items-center gap-sm">
              <span class="box-badge" data-box="${w.box}">${boxLabels[w.box]}</span>
              <button class="btn btn-sm btn-danger"
                onclick="window.__lif.deleteWord('${w.word}')"
                style="padding:2px 6px; width:auto; font-size:0.7rem;">删除</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  return container;
}

// ===== Nav =====
function renderNav() {
  const nav = document.createElement('nav');
  nav.className = 'nav-bottom';
  const views = [
    { id: 'home',     icon: '🏠', label: '首页' },
    { id: 'study',    icon: '📝', label: '刷词' },
    { id: 'island',   icon: '🏝️', label: '我的岛' },
    { id: 'wordbank', icon: '📚', label: '词库' },
    { id: 'stats',    icon: '📊', label: '统计' },
  ];
  nav.innerHTML = views.map(v => `
    <a href="#" class="${currentView === v.id ? 'active' : ''}"
       onclick="window.__lif.navigate('${v.id}'); return false;">
      <span class="nav-icon">${v.icon}</span>
      <span>${v.label}</span>
    </a>
  `).join('');
  return nav;
}

// ===== Utilities =====
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== Study Flow (basic - full flow in Task 7) =====
window.__lif = {
  navigate,
  startReview() { showReviewSession(); },
  startLearning() { showLearningSession(); },
  deleteWord(word) { store.deleteWord(word); render(); },
  exportBackup() {
    const json = store.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learningisfun-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
};

// ===== Study Sessions =====
async function showReviewSession() {
  const dueWords = store.getDueWords();
  if (dueWords.length === 0) return;

  const container = document.getElementById('app');
  container.innerHTML = '';
  container.appendChild(renderNav());

  let current = 0;
  let correct = 0;
  let total = dueWords.length;

  async function showCard(idx) {
    if (idx >= dueWords.length) {
      // Done
      container.querySelector('#study-content').innerHTML = `
        <div class="card text-center animate-fade-in">
          <div style="font-size:3rem;">🏆</div>
          <h2 class="mt-sm">复习完成！</h2>
          <p class="mt-sm">正确率：<strong style="color:var(--color-success)">${correct}/${total}</strong></p>
          <button class="btn btn-primary mt-md" onclick="window.__lif.navigate('home')">返回首页</button>
        </div>
      `;
      return;
    }

    const word = dueWords[idx];
    const card = container.querySelector('#study-content');

    card.innerHTML = `
      <div class="text-center text-muted mb-sm" style="font-size:0.8rem;">
        第 ${idx + 1} / ${total} 个
      </div>
      <div class="progress-bar mb-md">
        <div class="progress-bar-fill" style="width:${(idx / total) * 100}%"></div>
      </div>

      <div class="flashcard" id="flashcard" onclick="window.__lif.flipCard()">
        <div class="flashcard-inner" id="flashcardInner">
          <div class="flashcard-front">
            <div style="font-size:2rem; font-weight:700; margin-bottom:var(--space-sm);">${word.word}</div>
            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); window.__lif.speak('${word.word}')">
              🔊 发音
            </button>
            <p class="text-muted mt-md" style="font-size:0.8rem;">点击卡片显示答案</p>
          </div>
          <div class="flashcard-back">
            <div style="font-size:2rem; font-weight:700; margin-bottom:var(--space-sm);">${word.word}</div>
            <div style="font-size:1.25rem; margin-bottom:var(--space-sm);">${word.meaning || '（无释义）'}</div>
            ${word.example ? `<div class="text-muted" style="font-size:0.875rem; font-style:italic;">"${word.example}"</div>` : ''}
            ${word.prefix || word.root ? `
              <div class="mt-sm" style="font-size:0.875rem;">
                ${word.prefix ? `<span style="color:var(--color-success)">${word.prefix}</span>` : ''}
                ${word.root ? `<span style="color:var(--color-accent)">${word.root}</span>` : ''}
                ${word.suffix ? `<span style="color:var(--color-warning)">${word.suffix}</span>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      <div id="studyButtons" style="display:none;">
        <div class="study-buttons">
          <button class="study-btn correct" onclick="window.__lif.rate('correct', ${idx})">
            🟢 记住了
          </button>
          <button class="study-btn almost" onclick="window.__lif.rate('almost', ${idx})">
            🟡 有点忘
          </button>
          <button class="study-btn wrong" onclick="window.__lif.rate('wrong', ${idx})">
            🔴 不会
          </button>
        </div>
      </div>
    `;

    window.__lif.flipCard = () => {
      const fc = document.getElementById('flashcard');
      fc.classList.toggle('flipped');
      const buttons = document.getElementById('studyButtons');
      if (buttons) buttons.style.display = 'block';
    };
  }

  const header = document.createElement('div');
  header.innerHTML = `
    <div class="flex items-center gap-sm mb-md">
      <button class="btn btn-sm btn-secondary" onclick="window.__lif.navigate('home')">← 退出</button>
      <h2>📝 复习</h2>
    </div>
  `;
  const content = document.createElement('div');
  content.id = 'study-content';
  container.insertBefore(header, container.lastChild);
  container.insertBefore(content, container.lastChild);

  window.__lif.rate = (rating, idx) => {
    const word = dueWords[idx];
    const today = new Date().toISOString().split('T')[0];

    let interval = word.interval;
    let ef = word.ef;
    let box = word.box;
    let nextReview = today;

    if (rating === 'correct') {
      interval = Math.min(30, Math.round(word.interval * ef));
      ef = Math.min(3.0, word.ef + 0.1);
      box = Math.min(5, word.box + 1);
      nextReview = new Date(Date.now() + interval * 86400000).toISOString().split('T')[0];
      correct++;
    } else if (rating === 'almost') {
      ef = Math.max(1.3, word.ef - 0.1);
      nextReview = today; // 今天再复习一次
    } else {
      interval = 1;
      ef = Math.max(1.3, word.ef - 0.2);
      box = 1;
      nextReview = today;
    }

    store.updateWord(word.word, {
      interval, ef, box,
      nextReview,
      lastReview: today,
      timesReviewed: word.timesReviewed + 1,
      timesCorrect: rating === 'correct' ? word.timesCorrect + 1 : word.timesCorrect
    });

    showCard(idx + 1);
  };

  window.__lif.speak = (word) => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'en-US';
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    }
  };

  await showCard(0);
}

async function showLearningSession() {
  const newWords = store.getNewWords(5);
  if (newWords.length === 0) {
    window.__lif.navigate('home');
    return;
  }

  const container = document.getElementById('app');
  container.innerHTML = '';
  container.appendChild(renderNav());

  let current = 0;

  async function showWord(idx) {
    if (idx >= newWords.length) {
      container.querySelector('#study-content').innerHTML = `
        <div class="card text-center animate-fade-in">
          <div style="font-size:3rem;">🎉</div>
          <h2 class="mt-sm">新词学完！</h2>
          <p class="text-muted mt-sm">已加入复习队列</p>
          <button class="btn btn-primary mt-md" onclick="window.__lif.navigate('home')">返回首页</button>
        </div>
      `;
      return;
    }

    const word = newWords[idx];
    const card = container.querySelector('#study-content');
    card.innerHTML = `
      <div class="text-center text-muted mb-sm" style="font-size:0.8rem;">
        新词学习 ${idx + 1} / ${newWords.length}
      </div>
      <div class="progress-bar mb-md">
        <div class="progress-bar-fill" style="width:${(idx / newWords.length) * 100}%"></div>
      </div>

      <div class="card text-center" style="padding:var(--space-xl);">
        <div style="font-size:2.5rem; font-weight:700; margin-bottom:var(--space-sm);">${word.word}</div>
        <button class="btn btn-sm btn-secondary mb-md" onclick="window.__lif.speak('${word.word}')">
          🔊 发音
        </button>
        <div style="font-size:1.25rem; margin-bottom:var(--space-sm); color:var(--color-text);">
          ${word.meaning || '（释义待补）'}
        </div>
        ${word.example ? `
          <div class="text-muted" style="font-style:italic; margin-bottom:var(--space-sm);">"${word.example}"</div>
        ` : ''}
        ${word.prefix || word.root ? `
          <div style="margin-top:var(--space-sm);">
            ${word.prefix ? `<span style="background:var(--color-success); padding:2px 8px; border-radius:4px; color:#fff; margin-right:4px;">${word.prefix}</span>` : ''}
            ${word.root ? `<span style="background:var(--color-accent); padding:2px 8px; border-radius:4px; color:#fff; margin-right:4px;">${word.root}</span>` : ''}
            ${word.suffix ? `<span style="background:var(--color-warning); padding:2px 8px; border-radius:4px; color:#1a1a2e; margin-right:4px;">${word.suffix}</span>` : ''}
          </div>
        ` : ''}
        <button class="btn btn-primary mt-md" onclick="window.__lif.nextWord(${idx})">
          记住了 → 下一个
        </button>
      </div>
    `;
  }

  const header = document.createElement('div');
  header.innerHTML = `
    <div class="flex items-center gap-sm mb-md">
      <button class="btn btn-sm btn-secondary" onclick="window.__lif.navigate('home')">← 退出</button>
      <h2>🆕 学习新词</h2>
    </div>
  `;
  const content = document.createElement('div');
  content.id = 'study-content';
  container.insertBefore(header, container.lastChild);
  container.insertBefore(content, container.lastChild);

  window.__lif.nextWord = (idx) => {
    showWord(idx + 1);
  };

  window.__lif.speak = (word) => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'en-US';
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    }
  };

  await showWord(0);
}

// ===== Boot =====
render();
