/**
 * app.js - LearningIsFun 主程序（单文件，解决GitHub Pages CORS）
 * 使用 Free Dictionary API 在线查询
 */

// ================================================================
// MODULE 1: vocabulary-store.js
// ================================================================
let STORE_KEY = 'lif_v1'; // 会被 setCurrentUser 动态覆盖

function loadData() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { version: 1, words: [], meta: {} };
    return JSON.parse(raw);
  } catch { return { version: 1, words: [], meta: {} }; }
}

function saveData(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {}
}

// ================================================================
// User Management (多用户 + 4位密码保护)
// ================================================================
const USERS_KEY = 'lif_users';

function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; } catch { return {}; }
}

function saveUsers(users) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch {}
}

let currentUser = null; // { name }

function setCurrentUser(name) {
  currentUser = { name };
  STORE_KEY = 'lif_data_' + name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '_');
}

function getCurrentUser() {
  if (currentUser) return currentUser.name;
  try { return localStorage.getItem('lif_current_user') || null; } catch { return null; }
}

function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const wrap = el('div', {className:'view-login animate-fade-in',style:'max-width:380px;margin:60px auto;padding:0 var(--space-md)'}, []);

  wrap.appendChild(el('div', {style:'text-align:center;margin-bottom:var(--space-xl)'}, [
    el('div', {style:'font-size:3rem'}, [document.createTextNode('🏝️')]),
    el('h1', {style:'margin:var(--space-sm) 0'}, [document.createTextNode('LearningIsFun')]),
    el('p', {className:'text-muted'}, [document.createTextNode('每天10分钟，轻松背单词')])
  ]));

  const nameInput = el('input', {
    className:'form-input mb-md',
    type:'text',
    placeholder:'输入你的名字',
    maxLength:20,
    autocomplete:'off'
  }, []);

  const pinRow = el('div', {className:'mb-md'}, [
    el('label', {className:'text-muted',style:'font-size:0.85rem'}, [document.createTextNode('4位密码（保护你的进度）')]),
    el('input', {
      className:'form-input mt-xs',
      type:'password',
      placeholder:'设4位数字密码',
      maxLength:4,
      inputmode:'numeric',
      pattern:'[0-9]*',
      autocomplete:'off'
    }, [])
  ]);

  const hint = el('div', {className:'text-muted text-center',style:'font-size:0.85rem;min-height:20px;margin-bottom:var(--space-sm)'}, []);

  const submitBtn = el('button', {
    className:'btn btn-primary btn-lg',
    style:'width:100%',
    onClick:() => {
      const name = nameInput.value.trim();
      const pin = pinRow.querySelector('input').value.trim();
      if (!name) { hint.textContent = '请输入名字'; hint.style.color = 'var(--color-danger)'; return; }
      if (!/^\d{4}$/.test(pin)) { hint.textContent = '密码必须是4位数字'; hint.style.color = 'var(--color-danger)'; return; }
      const users = getUsers();
      if (users[name]) {
        // 已有用户，验证密码
        if (users[name] !== pin) { hint.textContent = '密码错误'; hint.style.color = 'var(--color-danger)'; return; }
      } else {
        // 新用户，注册
        users[name] = pin;
        saveUsers(users);
      }
      setCurrentUser(name);
      localStorage.setItem('lif_current_user', name);
      initTestData();
      render();
    }
  }, [document.createTextNode('进入 ➜')]);

  wrap.appendChild(nameInput);
  wrap.appendChild(pinRow);
  wrap.appendChild(hint);
  wrap.appendChild(submitBtn);

  // 换用户提示
  const existing = getUsers();
  const names = Object.keys(existing);
  if (names.length > 0) {
    wrap.appendChild(el('div', {className:'text-muted text-center mt-md',style:'font-size:0.8rem'}, [
      document.createTextNode(`已有 ${names.length} 位同学在学习`)
    ]));
  }

  app.appendChild(wrap);

  // 自动聚焦
  setTimeout(() => nameInput.focus(), 100);
}

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

const store = {
  getAll() { return loadData().words; },
  getWord(id) { return loadData().words.find(w => w.id === id) || null; },
  getSettings() {
    const d = loadData();
    return d.settings || { dailyNewWords: 20, dailyMax: 60 };
  },
  saveSettings(settings) {
    const d = loadData();
    d.settings = { ...d.settings, ...settings };
    saveData(d);
  },
  getStats() {
    const words = loadData().words;
    const today = new Date().toISOString().split('T')[0];
    const total = words.length;
    const mastered = words.filter(w => w.box >= 4).length;
    const learning = words.filter(w => w.box >= 2 && w.box < 4).length;
    const newWords = words.filter(w => !w.lastReview).length;
    const dueToday = words.filter(w => w.nextReview && w.nextReview <= today).length;
    const reviewed = words.filter(w => w.lastReview === today);
    const avgCorrect = reviewed.length > 0
      ? Math.round(reviewed.reduce((s, w) => s + (w.timesCorrect || 0) / Math.max(1, w.timesReviewed || 1) * 100, 0) / reviewed.length)
      : 0;
    return { total, mastered, learning, newWords, dueToday, avgCorrect };
  },
  addWord(data) {
    const d = loadData();
    const today = new Date().toISOString().split('T')[0];
    const word = {
      id: uid(),
      word: (data.word || '').toLowerCase().trim(),
      meaning: data.meaning || '',
      phonetic: data.phonetic || '',
      example: String(data.example || ''),
      prefix: data.prefix || '',
      root: data.root || '',
      suffix: data.suffix || '',
      explanation: data.explanation || '',
      box: 1, interval: 1, ef: 2.5,
      nextReview: today, lastReview: null,
      timesReviewed: 0, timesCorrect: 0,
      createdAt: today,
      tags: data.tags || [],
      source: data.source || 'manual'
    };
    d.words.push(word);
    saveData(d);
    return word;
  },
  updateWord(id, fields) {
    const d = loadData();
    const idx = d.words.findIndex(w => w.id === id);
    if (idx < 0) return null;
    d.words[idx] = { ...d.words[idx], ...fields };
    saveData(d);
    return d.words[idx];
  },
  deleteWord(id) {
    const d = loadData();
    d.words = d.words.filter(w => w.id !== id);
    saveData(d);
  },
  importWords(words, source = 'pdf') {
    const today = new Date().toISOString().split('T')[0];
    let count = 0;
    const d = loadData();
    const existing = new Set(d.words.map(w => w.word));
    for (const w of words) {
      if (!w.word || existing.has(w.word.toLowerCase())) continue;
      d.words.push({
        id: uid(),
        word: w.word.toLowerCase().trim(),
        meaning: w.meaning || '',
        phonetic: w.phonetic || '',
        example: String(w.example || ''),
        prefix: w.prefix || '',
        root: w.root || '',
        suffix: w.suffix || '',
        box: 1, interval: 1, ef: 2.5,
        nextReview: today, lastReview: null,
        timesReviewed: 0, timesCorrect: 0,
        createdAt: today, tags: [], source
      });
      existing.add(w.word.toLowerCase());
      count++;
    }
    saveData(d);
    return count;
  },
  clearAll() { saveData({ version: 1, words: [], meta: {} }); }
};

// 初始化：首次打开自动填充60个测试词
function initTestData() {
  if (store.getAll().length > 0) return; // 已有数据不覆盖
  const testWords = [
    { word: 'abandon', meaning: '放弃' },
    { word: 'ability', meaning: '能力' },
    { word: 'able', meaning: '能够的' },
    { word: 'about', meaning: '关于' },
    { word: 'above', meaning: '在...上面' },
    { word: 'abroad', meaning: '在国外' },
    { word: 'accept', meaning: '接受' },
    { word: 'accident', meaning: '事故' },
    { word: 'according', meaning: '根据' },
    { word: 'account', meaning: '账户' },
    { word: 'achieve', meaning: '实现' },
    { word: 'across', meaning: '穿过' },
    { word: 'act', meaning: '行动' },
    { word: 'action', meaning: '行动' },
    { word: 'active', meaning: '积极的' },
    { word: 'activity', meaning: '活动' },
    { word: 'actual', meaning: '实际的' },
    { word: 'actually', meaning: '实际上' },
    { word: 'add', meaning: '增加' },
    { word: 'address', meaning: '地址' },
    { word: 'advantage', meaning: '优势' },
    { word: 'adventure', meaning: '冒险' },
    { word: 'advertise', meaning: '做广告' },
    { word: 'advice', meaning: '建议' },
    { word: 'afford', meaning: '负担得起' },
    { word: 'afraid', meaning: '害怕的' },
    { word: 'after', meaning: '在...之后' },
    { word: 'afternoon', meaning: '下午' },
    { word: 'again', meaning: '再一次' },
    { word: 'against', meaning: '反对' },
    { word: 'age', meaning: '年龄' },
    { word: 'agent', meaning: '代理人' },
    { word: 'ago', meaning: '以前' },
    { word: 'agree', meaning: '同意' },
    { word: 'ahead', meaning: '在前面' },
    { word: 'air', meaning: '空气' },
    { word: 'airline', meaning: '航空公司' },
    { word: 'airport', meaning: '机场' },
    { word: 'alarm', meaning: '警报' },
    { word: 'album', meaning: '专辑' },
    { word: 'alien', meaning: '外星人' },
    { word: 'allow', meaning: '允许' },
    { word: 'almost', meaning: '几乎' },
    { word: 'alone', meaning: '独自' },
    { word: 'along', meaning: '沿着' },
    { word: 'already', meaning: '已经' },
    { word: 'also', meaning: '也' },
    { word: 'although', meaning: '虽然' },
    { word: 'always', meaning: '总是' },
    { word: 'amazing', meaning: '令人惊奇的' },
    { word: 'among', meaning: '在...之中' },
    { word: 'amount', meaning: '数量' },
    { word: 'ancient', meaning: '古代的' },
    { word: 'and', meaning: '和' },
    { word: 'angel', meaning: '天使' },
    { word: 'anger', meaning: '愤怒' },
    { word: 'angle', meaning: '角度' },
    { word: 'angry', meaning: '生气的' },
    { word: 'animal', meaning: '动物' },
    { word: 'announce', meaning: '宣布' },
    { word: 'Funny tricks', meaning: '滑稽的技法' },
    { word: 'Creatures', meaning: '生物' },
    { word: 'Unusual', meaning: '不尋常' },
    { word: 'Volunteer', meaning: '志願者' },
    { word: 'Breathe', meaning: '呼吸' },
    { word: 'Furry', meaning: '毛茸茸的' },
    { word: 'Assistant', meaning: '助手' },
    { word: 'Singer', meaning: '歌手' },
    { word: 'Charity', meaning: '慈善' },
    { word: 'Least favourite choice', meaning: '最不喜歡的選擇' },
    { word: 'Distance', meaning: '距離' },
    { word: 'Organization', meaning: '組織' },
    { word: 'Attract', meaning: '吸引' },
    { word: 'Trained(v)', meaning: '訓練' },
    { word: 'Prefer', meaning: '更喜歡' },
    { word: 'Mates', meaning: '夥伴' },
    { word: 'Aim', meaning: '目的' },
    { word: 'Vacancy (vacancies)', meaning: '空缺' },
    { word: 'Potential', meaning: '潛質' },
    { word: 'Physical', meaning: '身體的' },
    { word: 'Complete', meaning: '完成' },
    { word: 'Temperature', meaning: '溫度' },
    { word: 'Emotion', meaning: '情緒' },
    { word: 'Divided', meaning: '分為' },
    { word: 'Surround', meaning: '環繞' },
    { word: 'Social', meaning: '社會的' },
    { word: 'Barely', meaning: '僅僅' },
    { word: 'Raise', meaning: '提高' },
    { word: 'Organize', meaning: '組織' },
    { word: 'Straw', meaning: '稻草' },
    { word: 'Offspring', meaning: '後代' },
    { word: 'A range of', meaning: '一系列' },
    { word: 'Arranged', meaning: '安排' },
    { word: 'Enemy (enemies)', meaning: '敵人' },
    { word: 'Educational', meaning: '教育性' },
    { word: 'Stuck', meaning: '卡住' },
    { word: 'Escape', meaning: '逃跑' },
    { word: 'Programme', meaning: '方案' },
    { word: 'Musical instrument', meaning: '樂器' },
    { word: 'Fight against', meaning: '反對' },
    { word: 'Cheer up', meaning: '振作起來' },
    { word: 'Genius', meaning: '天才' },
    { word: 'Dangerous', meaning: '危險' },
    { word: 'Veterinarians', meaning: '獸醫' },
    { word: 'Impressed', meaning: '印象深刻' },
    { word: 'Situation', meaning: '情況' },
    { word: 'Preferred', meaning: '首選' },
    { word: 'Kindergarten', meaning: '幼稚園' },
    { word: 'Intelligent', meaning: '聰明的' },
    { word: 'Obedient', meaning: '聽話' },
    { word: 'Change', meaning: '改變' },
    { word: 'Due to', meaning: '因為' },
    { word: 'Farewell', meaning: '告別' },
    { word: 'Hide', meaning: '躲藏' },
    { word: 'Lack of', meaning: '欠缺' },
    { word: 'Traditional', meaning: '傳統的' },
    { word: 'Hunt', meaning: '打獵' },
    { word: 'Treat', meaning: '對待' },
    { word: 'Refuse', meaning: '拒絕' },
    { word: 'Release', meaning: '發布' },
    { word: 'Recruits', meaning: '招募' },
    { word: 'Shy', meaning: '害羞' },
    { word: 'Prey', meaning: '獵物' },
    { word: 'Educate', meaning: '教育' },
    { word: 'Embarrassed', meaning: '尷尬' },
    { word: 'Unable', meaning: '不能夠' },
    { word: 'Respect', meaning: '尊重' },
    { word: 'Language', meaning: '語言' },
    { word: 'Survive', meaning: '生存' },
    { word: 'Attend sessions', meaning: '參加會議' },
    { word: 'Flute', meaning: '長笛' },
    { word: 'Sunless', meaning: '沒有陽光的' },
    { word: 'Describe', meaning: '描述' },
    { word: 'Search', meaning: '尋找' },
    { word: 'Talkative', meaning: '健談' },
    { word: 'Shallow', meaning: '淺' },
    { word: 'Promote', meaning: '推動' },
    { word: 'Serious', meaning: '嚴肅' },
    { word: 'Stings', meaning: '蜇傷' },
    { word: 'Relationship', meaning: '關係' },
    { word: 'Organized', meaning: '組織' },
    { word: 'Consider', meaning: '考慮' },
    { word: 'Support', meaning: '支持' },
    { word: 'Creative', meaning: '有創意' },
    { word: 'Threats', meaning: '威脅' },
    { word: 'Denote', meaning: '表示' },
    { word: 'Link', meaning: '關聯' },
    { word: 'Continue', meaning: '繼續' },
    { word: 'Attach', meaning: '附上' },
    { word: 'Needy', meaning: '有需要的' },
    { word: 'Pretend', meaning: '假裝' },
    { word: 'Animal rights', meaning: '動物權利' },
    { word: 'Deep', meaning: '深' },
    { word: 'Suitable', meaning: '適合' },
    { word: 'Rough', meaning: '粗糙' },
    { word: 'recruit', meaning: '招募' },
    { word: 'Target', meaning: '目標' },
    { word: 'Clear', meaning: '清除' },
    { word: 'Harm', meaning: '傷害' },
    { word: 'Adapt', meaning: '適應' },
    { word: 'Cling', meaning: '緊貼' },
    { word: 'Savour', meaning: '品嚐' },
    { word: 'Cold sweats', meaning: '冷汗' },
    { word: 'Carnival', meaning: '嘉年華會' },
    { word: 'Tourism', meaning: '旅遊業' },
    { word: 'Harbour front', meaning: '海港前線' },
    { word: 'Annual', meaning: '年度的' },
    { word: 'Gain', meaning: '獲得' },
    { word: 'Chance', meaning: '機會' },
    { word: 'Event', meaning: '事件' },
    { word: 'Confidence', meaning: '自信' },
    { word: 'Expected', meaning: '預期的' },
    { word: 'Attracted', meaning: '吸引' },
    { word: 'Impressive', meaning: '感人的' },
    { word: 'Attractions', meaning: '景點' },
    { word: 'Lock', meaning: '鎖' },
    { word: 'Presentation', meaning: '推介會' },
    { word: 'Suggest', meaning: '提議' },
    { word: 'Million', meaning: '百萬' },
    { word: 'Essential', meaning: '基本的' },
    { word: 'Grabbed', meaning: '抓' },
    { word: 'Oversea', meaning: '海外' },
    { word: 'According to', meaning: '根據' },
    { word: 'Rides (n)', meaning: '遊樂設施' },
    { word: 'Expert', meaning: '專家' },
    { word: 'Open-air', meaning: '露天' },
    { word: 'Provide', meaning: '提供' },
    { word: 'Verbal', meaning: '口頭的' },
    { word: 'Queues', meaning: '排隊' },
    { word: 'Extraordinary', meaning: '非凡的' },
    { word: 'Non-verbal', meaning: '不是口頭的' },
    { word: 'Bored', meaning: '悶' },
    { word: 'Ordinary', meaning: '普通的' },
    { word: 'Signals', meaning: '訊號' },
    { word: 'Fortunately', meaning: '幸運地' },
    { word: 'Flavours', meaning: '口味' },
    { word: 'Facial', meaning: '面部的' },
    { word: 'Nearby', meaning: '附近' },
    { word: 'Senior', meaning: '高級的' },
    { word: 'Expression', meaning: '表達' },
    { word: 'Scream', meaning: '尖叫' },
    { word: 'Pills', meaning: '藥物' },
    { word: 'Body language', meaning: '身體語言' },
    { word: 'Loud', meaning: '響亮的' },
    { word: 'Believe', meaning: '相信' },
    { word: 'Voice', meaning: '嗓音' },
    { word: 'Regular', meaning: '常規的' },
    { word: 'Post', meaning: '地位，公告' },
    { word: 'Prevent', meaning: '避免' },
    { word: 'Tone', meaning: '語氣' },
    { word: 'Selfies', meaning: '自拍' },
    { word: 'Bitter', meaning: '苦的' },
    { word: 'Style', meaning: '風格' },
    { word: 'Scared', meaning: '害怕的' },
    { word: 'Experience', meaning: '經驗' },
    { word: 'Control', meaning: '控制' },
    { word: 'Particularly', meaning: '特別' },
    { word: 'Taste buds', meaning: '味蕾' },
    { word: 'Speed', meaning: '速度' },
    { word: 'Silly', meaning: '愚蠢' },
    { word: 'Energised', meaning: '充滿活力' },
    { word: 'Rapidly relax', meaning: '迅速放鬆' },
    { word: 'Unforgettable', meaning: '難忘' },
    { word: 'Energy', meaning: '活力' },
    { word: 'Deliver', meaning: '遞送' },
    { word: 'Orient', meaning: '東' },
    { word: 'Speech', meaning: '言語' },
    { word: 'High-quality', meaning: '高質素' },
    { word: 'Rush', meaning: '匆忙' },
    { word: 'Low price', meaning: '低價' },
    { word: 'Audience follow', meaning: '觀眾關注' },
    { word: 'Slow down', meaning: '減速' },
    { word: 'Emperor', meaning: '皇帝' },
    { word: 'Clearly', meaning: '清楚地' },
    { word: 'Strange', meaning: '奇怪的' },
    { word: 'Pay attention', meaning: '留心' },
    { word: 'Warm', meaning: '溫暖' },
    { word: 'Extra', meaning: '額外的' },
    { word: 'Successful', meaning: '成功' },
    { word: 'Pauses', meaning: '停頓' },
    { word: 'Replace', meaning: '取代' },
    { word: 'Whenever', meaning: '每當' },
    { word: 'Health', meaning: '健康' },
    { word: 'Otherwise', meaning: '否則' },
    { word: 'History', meaning: '歷史' },
    { word: 'Embarrassing', meaning: '尷尬' },
    { word: 'To conclude', meaning: '總結' },
    { word: 'Contribute', meaning: '貢獻' },
    { word: 'Argue', meaning: '爭論' },
    { word: 'Entertain', meaning: '招呼' },
    { word: 'Game booths', meaning: '遊戲攤位' },
    { word: 'Treat(n)', meaning: '享樂' },
    { word: 'Prepare', meaning: '準備' },
    { word: 'Variety', meaning: '種類' },
    { word: 'Nervous', meaning: '緊張' },
    { word: 'Stalls', meaning: '攤位' },
    { word: 'Ingredients', meaning: '配料' },
    { word: 'Practice', meaning: '實踐' },
    { word: 'Spend', meaning: '花費' },
    { word: 'Design', meaning: '設計' },
    { word: 'Mixture', meaning: '混合物' },
    { word: 'Stick (v)', meaning: '戮' },
    { word: 'Assistance', meaning: '幫助' },
    { word: 'University', meaning: '大學' },
    { word: 'Improve', meaning: '改善' },
    { word: 'Prize', meaning: '獎' },
    { word: 'Important', meaning: '重要' },
    { word: 'Choir', meaning: '合唱團' },
    { word: 'Donated', meaning: '捐贈的' },
    { word: 'Sense', meaning: '感覺' },
    { word: 'Guess', meaning: '猜測' },
    { word: 'Passion', meaning: '熱情' },
    { word: 'Chubby', meaning: '胖乎乎的' },
    { word: 'Including', meaning: '包括' },
    { word: 'Communication', meaning: '溝通' },
    { word: 'Curly', meaning: '捲曲' },
    { word: 'Rubber', meaning: '橡膠' },
    { word: 'Issue', meaning: '問題' },
    { word: 'Necklace', meaning: '項鍊' },
    { word: 'Treasure hunt', meaning: '尋寶' },
    { word: 'Familiar', meaning: '熟悉的' },
    { word: 'Travel', meaning: '遊' },
    { word: 'Puzzles', meaning: '謎題，砌圖' },
    { word: 'Different', meaning: '不同的' },
    { word: 'Museum', meaning: '博物館' },
    { word: 'Principal', meaning: '校長' },
    { word: 'Allergies', meaning: '過敏' },
    { word: 'Souvenirs', meaning: '紀念品' },
    { word: 'Weight', meaning: '重量' },
    { word: 'Blog', meaning: '網誌' },
    { word: 'Pass (v)', meaning: '經過' },
    { word: 'Diet', meaning: '飲食' },
    { word: 'Statue of liberty', meaning: '自由女神像' },
    { word: 'Three-legged race', meaning: '二人三足' },
    { word: 'Calories', meaning: '卡路里' },
    { word: 'Routine', meaning: '常規賽' },
    { word: 'Cousin', meaning: '表兄弟姐妹' },
    { word: 'Cost', meaning: '價值' },
    { word: 'Sightseeing', meaning: '觀光' },
    { word: 'Limit', meaning: '限制' },
    { word: 'Trip', meaning: '旅行' },
    { word: 'Bouncy castle', meaning: '充氣城堡' },
    { word: 'Update', meaning: '更新' },
    { word: 'Adult', meaning: '成人' },
    { word: 'Ensure', meaning: '確保' },
    { word: 'Safety', meaning: '安全' },
    { word: 'Canteen', meaning: '食堂' },
    { word: 'No charge', meaning: '免費' },
    { word: 'Present (V)', meaning: '展示' },
    { word: 'Admission', meaning: '錄取' },
    { word: 'Directions', meaning: '方向' },
    { word: 'Public', meaning: '公眾' },
    { word: 'Available', meaning: '可用的' },
    { word: 'Shuttle bus', meaning: '穿梭巴士' },
    { word: 'Bus terminus', meaning: '巴士總站' },
    { word: 'Entrance', meaning: '入口' },
    { word: 'Detail', meaning: '細節' },
    { word: 'Refer', meaning: '參考' },
    { word: 'Special offer', meaning: '優惠' },
    { word: 'Joy', meaning: '高興；樂事' },
    { word: 'Appeared', meaning: '出現' },
    { word: 'Online', meaning: '線上' },
    { word: 'Danger', meaning: '危險；危險之人' },
    { word: 'Stared', meaning: '注視' },
    { word: 'Discount', meaning: '折扣' },
    { word: 'Surfing', meaning: '衝浪運動' },
    { word: 'Free', meaning: '免費' },
    { word: 'Skimming', meaning: '撇取，撇去；' },
    { word: 'Greeted', meaning: '迎接' },
    { word: 'Second', meaning: '第二浮渣' },
    { word: 'Obey', meaning: '服從;遵守' },
    { word: 'Skill', meaning: '能力；專長' },
    { word: 'Bathe', meaning: '浸洗' },
    { word: 'Screen', meaning: '銀幕' },
    { word: 'Strength', meaning: '體力；力度;' },
    { word: 'Splashed', meaning: '濺潑聲;飛濺' },
    { word: 'Spot', meaning: '斑點' },
    { word: 'Kicking', meaning: '踢打' },
    { word: 'Fur', meaning: '軟毛；毛皮' },
    { word: 'Download', meaning: '下載' },
    { word: 'Powerful', meaning: '強烈的;有影響' },
    { word: 'Awful', meaning: '壞的；可怕的' },
    { word: 'Offline', meaning: '離線的力的' },
    { word: 'Mess', meaning: '把某事物搞糟' },
    { word: 'Champion', meaning: '冠軍' },
    { word: 'Stomach', meaning: '胃' },
    { word: 'Torn', meaning: '撕;撕破' },
    { word: 'Latest', meaning: '最新的' },
    { word: 'Muscles', meaning: '肌肉' },
    { word: 'Toilet', meaning: '抽水馬桶' },
    { word: 'Model', meaning: '模型；型號' },
    { word: 'Tricks', meaning: '詭計；欺騙' },
    { word: 'Routes', meaning: '路線' },
    { word: 'Movement', meaning: '動作;移動;' },
    { word: 'However', meaning: '然而' },
    { word: 'Racing', meaning: '競賽' },
    { word: 'Glad', meaning: '高興的' },
    { word: 'Break record', meaning: '打破記錄' },
    { word: 'Lying', meaning: '說謊' },
    { word: 'Wireless', meaning: '無線的；無線電' },
    { word: 'Position', meaning: '位置；恰當位置' },
    { word: 'memory', meaning: '記憶力；回憶的' },
    { word: 'Board', meaning: '木板；公告牌' },
    { word: 'Wheel', meaning: '車輪' },
    { word: 'Dry', meaning: '弄乾' },
    { word: 'Perfect', meaning: '完美的；精確的' },
    { word: 'Challenging', meaning: '挑戰性的' },
    { word: 'Feed', meaning: '餵' },
    { word: 'Impossible', meaning: '不可能的' },
    { word: 'Earn', meaning: '掙得；生;獲' },
    { word: 'Waves', meaning: '波浪;揮手示意' },
    { word: 'Software', meaning: '軟件' },
    { word: 'Hooked', meaning: '鉤狀的；帶鉤的' },
    { word: 'Single', meaning: '單一的' },
    { word: 'Through', meaning: '穿過' },
    { word: 'Freedom', meaning: '自由' },
    { word: 'Participants', meaning: '參與者' },
    { word: 'Journey', meaning: '旅行' },
    { word: 'Grasslands', meaning: '草場' },
    { word: 'Especially', meaning: '尤其；十分' },
    { word: 'Jungles', meaning: '熱帶叢林' },
    { word: 'Prepared', meaning: '準備;布置' },
    { word: 'Desert', meaning: '沙漠' },
    { word: 'Risk/risky', meaning: '有風險的' },
    { word: 'Trapped', meaning: '陷入困境的；陷' },
    { word: 'Wild', meaning: '野生的' },
    { word: 'Qualified', meaning: '有資格的；勝任' },
    { word: 'hunters', meaning: '獵人' },
    { word: 'Avoid', meaning: '避免；避開' },
    { word: 'dare', meaning: '敢；竟敢' },
    { word: 'behaviour', meaning: '行為；反應' },
    { word: 'Outdoor', meaning: '戶外' },
    { word: 'Popular', meaning: '流行的；受歡迎' },
    { word: 'Apologise', meaning: '道歉' },
    { word: 'Tent', meaning: '帳篷；帳棚的' },
    { word: 'Library', meaning: '圖書館' },
    { word: 'Countryside', meaning: '鄉村；郊外' },
    { word: 'Kilograms', meaning: '千克；公斤' },
    { word: 'Upset', meaning: '沮喪；難過' },
    { word: 'Independent', meaning: '獨立的；自主的' },
    { word: 'Transformation', meaning: '改革；轉' },
    { word: 'Score', meaning: '得分' },
    { word: 'Burst into tears （', meaning: '突然）感' },
    { word: 'Shapes', meaning: '形狀傷而落淚' },
    { word: 'Overnight', meaning: '晚上的；夜間的' },
    { word: 'Century （', meaning: '一）世紀' },
    { word: 'Comfort', meaning: '安慰；慰藉' },
    { word: 'Various', meaning: '各種各樣的' },
    { word: 'Thought', meaning: '看法；思想' },
    { word: 'Voluntary', meaning: '自願的；義務的材料' },
    { word: 'Suggested', meaning: '提議的' },
    { word: 'Activities', meaning: '活動' },
    { word: 'Surprisingly', meaning: '出乎意料地' },
    { word: 'Teasing', meaning: '嘲弄' },
    { word: 'Flag selling', meaning: '賣旗' },
    { word: 'Therefore', meaning: '因此；所以' },
    { word: 'Nasty', meaning: '惹人生厭的' },
    { word: 'Elderly homes', meaning: '護老院' },
    { word: 'Baker', meaning: '麵包師傅' },
    { word: 'Regretted', meaning: '遺憾的' },
    { word: 'Uniform', meaning: '校服' },
    { word: 'Size', meaning: '尺寸' },
    { word: 'Encourage', meaning: '促進；鼓勵' },
    { word: 'Coach', meaning: '教練' },
    { word: 'Vegetarians', meaning: '素食主義者' },
    { word: 'Basic', meaning: '基本的' },
    { word: 'Team', meaning: '隊伍' },
    { word: 'Represent', meaning: '代表' },
    { word: 'Competition', meaning: '競爭；比賽' },
    { word: 'Pass', meaning: '通過；合格' },
    { word: 'Fitness test', meaning: '體能測試' },
    { word: 'Romance', meaning: '浪漫氛圍；愛情' },
    { word: 'Comedy', meaning: '喜劇' },
    { word: 'Movies', meaning: '電影' },
    { word: 'Snacks', meaning: '小食' },
    { word: 'Materials included', meaning: '包含物' },
    { word: 'Miss', meaning: '小姐；錯過' },
    { word: 'Invited', meaning: '受邀的' },
    { word: 'Pottery', meaning: '陶器；陶藝' },
    { word: 'Website', meaning: '網站' },
    { word: 'Application form', meaning: '申請表格' },
    { word: 'Completed', meaning: '已完成的' },
    { word: 'Enquiries', meaning: '調查；詢問' },
    { word: 'Hong Kong style', meaning: '港式' },
    { word: 'Receive', meaning: '收到' },
    { word: 'Daily', meaning: '日常的' },
    { word: 'Barking', meaning: '瘋狂透頂的' },
    { word: 'Condensed milk', meaning: '煉奶' },
    { word: 'Tennis', meaning: '網球' },
    { word: 'Chase', meaning: '追逐' },
    { word: 'Evaporated milk', meaning: '淡奶' },
    { word: 'Direction', meaning: '方向' },
    { word: 'Double-decker', meaning: '雙層巴士' },
    { word: 'Numbers', meaning: '數字；數目的' },
    { word: 'Vehicle', meaning: '交通工具' },
    { word: 'Plants', meaning: '植物' },
    { word: 'Electric', meaning: '用電的' },
    { word: 'Soil', meaning: '土壤' },
    { word: 'Several', meaning: '幾個；數個；一' },
    { word: 'Cable', meaning: '電纜' },
    { word: 'Light', meaning: '光；燈些' },
    { word: 'Sign', meaning: '簽署' },
    { word: 'Night', meaning: '夜晚' },
    { word: 'Boil', meaning: '沸騰' },
    { word: 'Tracks', meaning: '小道；小徑' },
    { word: 'Parrot', meaning: '鸚鵡' },
    { word: 'Remove', meaning: '移開；去掉' },
    { word: 'Radio', meaning: '廣播' },
    { word: 'Immediately', meaning: '馬上；立刻' },
    { word: 'Repeated', meaning: '重複的' },
    { word: 'Shower', meaning: '沐浴' },
    { word: 'Silk', meaning: '絲綢' },
    { word: 'Sticks', meaning: '枝條' },
    { word: 'Stocking', meaning: '絲襪' },
    { word: 'Afterwards', meaning: '以後；後來' },
    { word: 'Firmly', meaning: '堅定地' },
    { word: 'Filter', meaning: '過濾器' },
    { word: 'Rushed', meaning: '倉促的；草率的' },
    { word: 'Waterproof', meaning: '防水的' },
    { word: 'Smoother', meaning: '更平滑；更順' },
    { word: 'Broom', meaning: '掃把' },
    { word: 'Umbrella', meaning: '雨傘滑' },
    { word: 'Bucket', meaning: '桶（有提梁的）' },
    { word: 'Protect', meaning: '保護' },
    { word: 'Smooth', meaning: '平滑的；順滑的' },
    { word: 'Job', meaning: '工作；職業' },
    { word: 'Bubble', meaning: '泡；氣泡' },
    { word: 'Slippers', meaning: '拖鞋' },
    { word: 'Folded', meaning: '有皺摺的' },
    { word: 'Tasty', meaning: '美味的；可口的' },
    { word: 'Worn', meaning: '用壞的；用舊的' },
    { word: 'Hiking', meaning: '遠足的' },
    { word: 'Revision', meaning: '溫習' },
    { word: 'Picnic', meaning: '野餐' },
    { word: 'Leaflet', meaning: '傳單；小冊子' },
    { word: 'Silent', meaning: '寧靜的' },
    { word: 'Magazine', meaning: '雜誌' },
    { word: 'Postcard', meaning: '明信片' },
    { word: 'Sports', meaning: '體育運動' },
    { word: 'Diary', meaning: '日記' },
    { word: 'Sizes', meaning: '尺寸' },
    { word: 'Menu', meaning: '選單；餐單' },
    { word: 'Offer', meaning: '提供；出價' },
    { word: 'Enough', meaning: '足夠的' },
    { word: 'Open day', meaning: '開放日' },
    { word: 'Problem', meaning: '問題' },
    { word: '*Graduation', meaning: '畢業' },
    { word: '*Preparation', meaning: '準備工作' },
    { word: '*Ceremony', meaning: '典禮' },
    { word: 'Success', meaning: '成功' },
    { word: 'Teenagers', meaning: '年青人' },
    { word: '*Representative', meaning: '有代表' },
    { word: 'In fact', meaning: '事實上性的' },
    { word: 'Opportunity', meaning: '機會' },
    { word: '*According', meaning: '根據' },
    { word: '*Graduates', meaning: '畢業生' },
    { word: 'Staff', meaning: '員工' },
    { word: 'Report', meaning: '報告' },
    { word: '*Honored', meaning: '榮譽' },
    { word: '*Effort', meaning: '努力' },
    { word: 'Thoughts', meaning: '想法' },
    { word: '*Facility/facilities', meaning: '設施' },
    { word: 'Tend to', meaning: '趨向' },
    { word: '*Attend', meaning: '出席' },
    { word: 'Language lab', meaning: '語言學習' },
    { word: '*Similar', meaning: '相似的' },
    { word: 'Guests', meaning: '嘉賓室' },
    { word: 'Useful', meaning: '有用的' },
    { word: 'Pop singer', meaning: '流行歌手' },
    { word: 'Paintings', meaning: '繪畫' },
    { word: 'Tips', meaning: '提點；小費' },
    { word: 'Polite', meaning: '禮貌的' },
    { word: 'Following', meaning: '緊接的' },
    { word: 'Give up', meaning: '放棄' },
    { word: 'Helpful', meaning: '有用的；有幫助' },
    { word: 'Difficulties', meaning: '困難；措置的' },
    { word: '*Wind down', meaning: '平靜下來' },
    { word: 'Future', meaning: '將來' },
    { word: 'Worried', meaning: '擔憂的；發愁的' },
    { word: 'Quiet relaxing', meaning: '平靜而放' },
    { word: '*Blessings', meaning: '祝福' },
    { word: 'Forget', meaning: '忘記鬆的' },
    { word: 'Surprise', meaning: '驚喜' },
    { word: 'Busy', meaning: '忙碌' },
    { word: 'Difficult', meaning: '困難' },
    { word: 'Certificate', meaning: '證書' },
    { word: 'Projects', meaning: '項目；工程' },
    { word: 'Surf', meaning: '衝浪' },
    { word: 'Presenting', meaning: '呈現' },
    { word: 'Internet', meaning: '互聯網路' },
    { word: '*Backstage', meaning: '後台' },
    { word: 'Chat', meaning: '聊天' },
    { word: 'Shaking', meaning: '搖動；顫動' },
    { word: 'Drama', meaning: '戲劇' },
    { word: 'Challenge', meaning: '挑戰' },
    { word: 'Tears', meaning: '眼淚' },
    { word: 'Thumb up', meaning: '豎起拇指' },
    { word: 'Habits', meaning: '習慣；嗜好' },
    { word: '*Laughter', meaning: '笑聲' },
    { word: 'Hugged', meaning: '擁抱' },
    { word: 'Healthy', meaning: '健康的' },
    { word: '*Precious', meaning: '珍貴的' },
    { word: 'Excited', meaning: '興奮的；激動的' },
    { word: '*Recommend', meaning: '推薦的' },
    { word: '*Familiar', meaning: '熟悉的' },
    { word: 'Interesting', meaning: '有趣的' },
    { word: 'Prizes', meaning: '獎項' },
    { word: '*Choir', meaning: '合唱團' },
    { word: '*Pattern', meaning: '圖案' },
    { word: 'Performance', meaning: '表演' },
    { word: 'Without', meaning: '沒有' },
    { word: '*Lonely', meaning: '寂寞的' },
    { word: '*Terrific', meaning: '絕妙的；了不起' },
    { word: 'Calming down', meaning: '冷靜下來' },
    { word: 'Proud', meaning: '自豪的的' },
    { word: 'Daily routine', meaning: '日復一日' },
    { word: '*Bright', meaning: '明亮的' },
    { word: 'Delightful', meaning: '令人愉快的' },
    { word: 'Buddies', meaning: '同伴' },
    { word: '*Attractive', meaning: '有吸引力的' },
    { word: 'Well-behaved', meaning: '彬彬有禮' },
    { word: 'Disappointed', meaning: '失望的' },
    { word: 'Contest', meaning: '爭辯' },
    { word: 'Noticed', meaning: '告示' },
    { word: 'Eye-catching', meaning: '惹' },
    { word: 'Hit', meaning: '打擊' },
    { word: 'Painted', meaning: '著色' },
    { word: 'Crowds', meaning: '群眾' },
    { word: 'Tickets', meaning: '入場券；票的' },
    { word: 'Black suits', meaning: '黑色' },
    { word: 'Flocked', meaning: '成群結隊' },
    { word: 'Venue', meaning: '場地' },
    { word: 'Affect', meaning: '影響西裝的' },
    { word: 'First come first serve', meaning: '先到' },
    { word: 'Mood', meaning: '心情' },
    { word: 'Appear', meaning: '出現' },
    { word: 'Drove off', meaning: '驅散先得' },
    { word: 'Behavior', meaning: '行為' },
    { word: 'Headed straight', meaning: '勇' },
    { word: 'Watch videos', meaning: '看短片' },
    { word: 'Calming', meaning: '平靜' },
    { word: 'Waiters', meaning: '侍應往直前' },
    { word: 'Fee', meaning: '費用；酬金的' },
    { word: 'Enjoy', meaning: '享受' },
    { word: 'Edge of a cliff', meaning: '懸崖' },
    { word: 'Starting date', meaning: '起始日' },
    { word: 'Causes', meaning: '原因' },
    { word: 'Owners', meaning: '持有者盡頭' },
    { word: 'Sick', meaning: '生病的' },
    { word: 'Restaurant', meaning: '餐廳' },
    { word: 'Beach beneath', meaning: '海' },
    { word: 'Injured', meaning: '受傷的的' },
    { word: 'Bright', meaning: '明亮的灘之下？' },
    { word: 'First aid', meaning: '急救' },
    { word: 'Feelings', meaning: '感受' },
    { word: 'Soft', meaning: '柔軟的' },
    { word: 'Lucky', meaning: '幸運的' },
    { word: 'Instructors', meaning: '講師；導師' },
    { word: 'Peaceful', meaning: '和平' },
    { word: 'Comfortable', meaning: '舒' },
    { word: 'Nobody', meaning: '沒有人' },
    { word: 'Officers （', meaning: '政府部門）官員的適的' },
    { word: 'Red cross', meaning: '紅十字會' },
    { word: 'Relaxed', meaning: '放鬆' },
    { word: 'Focus', meaning: '焦點地' },
    { word: 'Horn', meaning: '號角（樂器）' },
    { word: 'Particular', meaning: '特指' },
    { word: 'Sleepy', meaning: '昏昏欲' },
    { word: 'Towards', meaning: '對於；向' },
    { word: 'First aid kit', meaning: '急救藥箱的睡的' },
    { word: 'Warn', meaning: '警告' },
    { word: 'Medical check-up', meaning: '體檢' },
    { word: 'Junior', meaning: '資歷較淺者；初級集中精神' },
    { word: 'Customers', meaning: '顧客體檢的' },
    { word: 'Explain', meaning: '解釋' },
    { word: 'Fashion', meaning: '時尚' },
    { word: 'Incident', meaning: '事件' },
    { word: 'Weightlifters', meaning: '舉重運動員' },
    { word: 'Planning', meaning: '計劃的舉重選手' },
    { word: 'Meaning', meaning: '意思' },
    { word: 'Brake hard', meaning: '急剎車' },
    { word: 'Green environment', meaning: '環境' },
    { word: 'Effect', meaning: '影響；作' },
    { word: 'Mixing', meaning: '混合的' },
    { word: 'Asleep', meaning: '熟睡的綠化用' },
    { word: 'Company', meaning: '公司' },
    { word: 'Slammed', meaning: '猛烈抨擊' },
    { word: 'Gym', meaning: '健身' },
    { word: 'Manager', meaning: '經理的' },
    { word: 'Attending', meaning: '注意' },
    { word: 'Brakes', meaning: '剎車踏板' },
    { word: 'Nature', meaning: '自然；天然的' },
    { word: 'Hospital', meaning: '醫院的' },
    { word: 'Promise', meaning: '承諾' },
    { word: 'Performers', meaning: '表' },
    { word: 'Careful', meaning: '謹慎的' },
    { word: 'Stage', meaning: '台階' },
    { word: 'Reporter', meaning: '記者' },
    { word: 'Trails', meaning: '蹤跡；鄉間小徑' },
    { word: 'Perform', meaning: '表演' },
    { word: 'Crowded', meaning: '擁擠的' },
    { word: 'Half of the fee', meaning: '半價' },
    { word: 'Theatres', meaning: '劇院' },
    { word: 'Beach', meaning: '海灘' },
    { word: 'Calm down', meaning: '冷' },
    { word: 'Thankful', meaning: '感激的' },
    { word: 'Promoting', meaning: '推廣' },
    { word: 'Opposite', meaning: '相反' },
    { word: 'Frightened', meaning: '受驚' },
    { word: 'Application', meaning: '申請；請求' },
    { word: 'Warmest', meaning: '最溫的；害怕的暖的' },
    { word: 'Noise', meaning: '噪音' },
    { word: 'Fever', meaning: '發熱' },
    { word: 'Perhaps', meaning: '也許' },
    { word: 'Quiz', meaning: '課堂測考' },
    { word: 'Swallowing', meaning: '吞嚥' },
    { word: 'Mindful', meaning: '銘記在心的' },
    { word: 'Introduced', meaning: '介紹' },
    { word: 'Station', meaning: '車站' },
    { word: 'Spots', meaning: '運動' },
    { word: 'Countries', meaning: '國家' },
    { word: 'Victory', meaning: '勝利' },
    { word: 'Crazy', meaning: '瘋狂的' },
    { word: 'Invented', meaning: '發明' },
    { word: 'Competitors', meaning: '對手' },
    { word: 'Frozen', meaning: '凍結的' },
    { word: 'Butterflies in our stomach', meaning: '忐忑' },
    { word: 'Accepts', meaning: '應允' },
    { word: 'Strips', meaning: '條狀物；剝去(v.)不安' },
    { word: 'Fully', meaning: '充分地' },
    { word: 'National', meaning: '國家的；民族的' },
    { word: 'Teammates', meaning: '隊友' },
    { word: 'Grown', meaning: '成年的' },
    { word: 'Favourite', meaning: '最喜愛的' },
    { word: 'Murmured', meaning: '喃喃細語' },
    { word: 'Refuses', meaning: '拒絕' },
    { word: 'Explanations', meaning: '說明；解釋' },
    { word: 'Fault', meaning: '責任；過錯' },
    { word: 'Clever', meaning: '聰穎的' },
    { word: 'Soldiers', meaning: '士兵' },
    { word: 'Travelled', meaning: '旅行' },
    { word: 'Shame', meaning: '羞愧' },
    { word: 'Comforting', meaning: '令人安慰的' },
    { word: 'Savoring', meaning: '盡情享受；仔細' },
    { word: 'Patted', meaning: '輕拍一下' },
    { word: 'Changes', meaning: '轉變品味' },
    { word: 'Gratefully', meaning: '感激地' },
    { word: 'Product', meaning: '產品' },
    { word: 'Enemy', meaning: '敵人；敵軍' },
    { word: 'Culture', meaning: '文化' },
    { word: 'Expensive', meaning: '昂貴的' },
    { word: 'Stomach-aches', meaning: '腹痛；肚子痛' },
    { word: 'Shares', meaning: '分享' },
    { word: 'Recipes', meaning: '食譜；秘方' },
    { word: 'Encouraged', meaning: '鼓勵；受鼓舞' },
    { word: 'Century', meaning: '世紀；百年' },
    { word: 'Present', meaning: '出席' },
    { word: 'Bicycle', meaning: '單車（自行車）' },
    { word: 'Wood', meaning: '木' },
    { word: 'Magical', meaning: '奇妙的' },
    { word: 'Real', meaning: '真實的' },
    { word: 'Dragon', meaning: '龍' },
    { word: 'Dinosaur', meaning: '恐龍' },
    { word: 'Monster', meaning: '怪獸' },
    { word: 'Crocodile', meaning: '鱷魚' },
    { word: 'Ton', meaning: '噸' },
    { word: 'Weighting', meaning: '額外津貼' },
    { word: 'Greediest', meaning: '貪婪的' },
    { word: 'Jungle', meaning: '叢林' },
    { word: 'Secret', meaning: '秘密' },
    { word: 'Cheating', meaning: '作弊' },
    { word: 'Reduce', meaning: '縮減' },
    { word: 'Peace', meaning: '和平' },
    { word: 'Faithful', meaning: '忠誠的' },
    { word: 'Adventures', meaning: '冒險' }
  ];
  const today = new Date().toISOString().split('T')[0];
  testWords.forEach(w => {
    const morph = morphologyAnalyze(w.word);
    store.addWord({ word: w.word, meaning: w.meaning, prefix: morph.prefix, root: morph.root, source: 'test', createdAt: today });
  });
  console.log(`[Init] 自动填充 ${testWords.length} 个测试词`);
}

// ================================================================
// MODULE 2: pdf-extractor.js
// ================================================================
// ================================================================
// CSV 导入（比 PDF 稳定可靠）
// 格式: number,english,chinese（有表头）
async function extractFromCSV(file) {
  const text = await file.text();
  const lines = text.trim().split(/\r?\n/);
  const words = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || i === 0) continue; // 跳过空行和表头

    // 解析 CSV：支持逗号分隔
    const cols = line.split(',');
    if (cols.length < 2) continue;

    const english = cols[cols.length - 2].trim(); // 倒数第二列是英文
    const chinese = cols[cols.length - 1].trim(); // 最后一列是中文

    if (!english || !chinese) continue;
    if (english.length > 40) continue;
    if (seen.has(english.toLowerCase())) continue;
    // 过滤纯中文（误匹配）
    if (/^[\u4e00-\u9fff]/.test(english)) continue;

    seen.add(english.toLowerCase());
    words.push({ word: english.toLowerCase(), meaning: chinese });
  }

  return { words, rawText: `${words.length} words from CSV` };
}

// ================================================================
// PDF 导入（3 列排版，每页号码从 1 开始）
// 格式: "1. Creatures 生物 41. Unusual 不尋常 76. Volunteer 志願者"
// 参考: vocab-extract-guide.md

async function extractFromPDF(file) {
  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const results = [];
  const seen = new Set();

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const lines = buildLines(content.items);

    for (const line of lines) {
      // 跳过表头行
      if (/^SET?\s*\d+$/i.test(line)) continue;
      if (/^(Leaflet|Information|chat|blog|Narrative|Open day|ECA notice|leaflets)/i.test(line) && !/\d+\./.test(line)) continue;

      // 找所有 "数字. " 的位置
      const splits = [...line.matchAll(/\b(\d+)\.\s/g)];
      if (splits.length === 0) {
        // 无编号 → 跨行续文（中文接上一条）
        if (results.length > 0 && /^[\u4e00-\u9fff]/.test(line)) {
          results[results.length - 1].meaning += line.replace(/\s+/g, '');
        }
        continue;
      }

      // 处理行首前缀（上一行最后一条被截断的中文续文）
      const firstStart = splits[0].index;
      if (firstStart > 0) {
        const prefix = line.slice(0, firstStart).trim();
        if (results.length > 0 && prefix && /[\u4e00-\u9fff]/.test(prefix)) {
          results[results.length - 1].meaning += prefix.replace(/\s+/g, '');
        }
      }

      // 解析每个词条
      for (let i = 0; i < splits.length; i++) {
        const start = splits[i].index + splits[i][0].length;
        const end = (i + 1 < splits.length) ? splits[i + 1].index : line.length;
        const entryText = line.slice(start, end).trim();

        // 找第一个中文字符，分离英文和中文
        const cm = entryText.match(/[\u4e00-\u9fff]/);
        if (cm) {
          const english = entryText.slice(0, cm.index).trim();
          const chinese = entryText.slice(cm.index).replace(/\s+/g, '');

          if (english && english.length <= 40 && !seen.has(english.toLowerCase())) {
            // 过滤纯中文（误匹配）
            if (!/^[\u4e00-\u9fff]/.test(english)) {
              seen.add(english.toLowerCase());
              results.push({ word: english.toLowerCase(), meaning: chinese });
            }
          }
        }
      }
    }
  }

  // 返回结果和原始文本（用于调试）
  const allText = results.map((r, i) => `${i + 1}. ${r.word}  ${r.meaning}`).join('\n');
  return { words: results, rawText: allText };
}

// 根据 Y 坐标将 pdf.js 的 text items 拼成行
function buildLines(items) {
  const filtered = items.filter(it => it.str.trim());
  // 按 Y（降序）+ X（升序）排序
  filtered.sort((a, b) => {
    const ya = a.transform[5], yb = b.transform[5];
    if (Math.abs(ya - yb) > 5) return yb - ya;
    return a.transform[4] - b.transform[4];
  });

  const lines = [];
  let currentLine = '';
  let lastY = null;
  let lastRight = null;

  for (const item of filtered) {
    const x = item.transform[4];
    const y = item.transform[5];
    const right = x + (item.width || 0);

    if (lastY !== null && Math.abs(y - lastY) > 5) {
      // 换行
      if (currentLine) lines.push(currentLine);
      currentLine = item.str;
      lastRight = right;
    } else if (lastRight !== null && x - lastRight > (item.height || 12) * 0.3) {
      // 间距大于字高30%，加空格
      currentLine += ' ' + item.str;
      lastRight = right;
    } else {
      // 紧挨着，直接拼接（修复 "l"+"ibrary" → "library"）
      currentLine += item.str;
      lastRight = right;
    }
    lastY = y;
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

const pdfExtractor = { extractFromPDF };

// ================================================================
// MODULE 3: morphology.js（词根词缀）
// ================================================================
const ROOTS = {
  'port':{m:'搬运',e:'export,import,transport'},
  'mit':{m:'发送',e:'permit,submit,transmit'},
  'miss':{m:'发送',e:'missile,mission'},
  'tract':{m:'拉',e:'attract,contract,extract'},
  'duc':{m:'引导',e:'conduct,produce,reduce'},
  'scrib':{m:'写',e:'describe,prescribe,subscribe'},
  'script':{m:'写',e:'script,manuscript'},
  'pel':{m:'推',e:'compel,expel,propel'},
  'puls':{m:'推',e:'pulse,impulse,repel'},
  'pend':{m:'悬挂',e:'suspend,depend,pending'},
  'pens':{m:'花费',e:'expense,pension,spend'},
  'spect':{m:'看',e:'respect,inspect,expect'},
  'struct':{m:'建造',e:'construct,instruct,destroy'},
  'form':{m:'形式',e:'transform,inform,reform'},
  'pos':{m:'放置',e:'compose,propose,expose'},
  'pon':{m:'放置',e:'component,postpone'},
  'vis':{m:'看',e:'vision,visit,invisible'},
  'vid':{m:'看',e:'video,evident,provide'},
  'aud':{m:'听',e:'audio,audience,audit'},
  'dic':{m:'说',e:'dictate,predict,indicate'},
  'cap':{m:'拿',e:'capture,capacity,escape'},
  'cept':{m:'拿',e:'except,intercept,accept'},
  'fer':{m:'携带',e:'transfer,refer,prefer'},
  'vert':{m:'转',e:'convert,advert,revert'},
  'vers':{m:'转',e:'reverse,diverse,universe'},
  'sist':{m:'站立',e:'resist,exist,insist'},
  'grad':{m:'走',e:'progress,grade,graduate'},
  'gress':{m:'走',e:'aggress,congress,progress'},
  'log':{m:'说',e:'dialogue,apology,psychology'},
  'loqu':{m:'说',e:'eloquent,colloquial'},
  'voc':{m:'叫喊',e:'vocabulary,vocation,advocate'},
  'vok':{m:'叫喊',e:'invoke,evoke,provoke'},
  'solv':{m:'松开',e:'solve,resolve,dissolve'},
  'solu':{m:'松开',e:'solution,absolute'},
  'ply':{m:'折叠',e:'apply,reply,supply,comply'},
  'ject':{m:'扔',e:'inject,reject,project,object'},
  'lect':{m:'选择',e:'collect,select,elect'},
  'ven':{m:'来',e:'prevent,invent,event'},
  'cid':{m:'切',e:'decide,suicide,incident'},
  'cis':{m:'切',e:'precise,scissors,incise'},
  'rupt':{m:'破',e:'interrupt,corrupt,erupt'},
  'loc':{m:'地方',e:'local,locate,location'},
  'clud':{m:'关闭',e:'include,exclude,conclude'},
  'clus':{m:'关闭',e:'conclusion,exclusion'},
  'flu':{m:'流',e:'fluent,fluid,influence'},
  'tain':{m:'持有',e:'contain,obtain,maintain'},
  'cur':{m:'跑',e:'current,occur,recur'},
  'curs':{m:'跑',e:'course,cursor,discourse'},
  'bio':{m:'生命',e:'biology,bio'},
  'geo':{m:'地球',e:'geography,geometry'},
  'phon':{m:'声音',e:'telephone,microphone'},
  'cycl':{m:'圆',e:'bicycle,recycle,cycle'},
  'meter':{m:'测量',e:'thermometer,speedometer'},
  'techn':{m:'技术',e:'technology,technique'},
  'nat':{m:'出生',e:'native,natural,nation'},
  'fin':{m:'结束',e:'finish,finite,infinite,define'},
  'anim':{m:'生命',e:'animal,animate'},
  'corp':{m:'身体',e:'corporate,corpse,corpus'},
  'man':{m:'手',e:'manual,manage,manuscript'},
  'ped':{m:'脚',e:'pedal,pedestrian'},
  'graph':{m:'写',e:'telegraph,photograph,paragraph'},
  'gram':{m:'写',e:'grammar,program,diagram'},
  'popul':{m:'人民',e:'population,popular,public'},
  'civ':{m:'公民',e:'civil,civilian,civilization'},
  'vac':{m:'空',e:'vacant,vacation,vacuum'},
  'med':{m:'治疗',e:'medicine,medical,remedy'},
  'psych':{m:'心理',e:'psychology,psycho'},
  'soci':{m:'社会',e:'social,society,associate'},
  'claim':{m:'叫',e:'exclaim,proclaim,acclaim'},
  'cred':{m:'相信',e:'credit,credible,incredible'},
  'fract':{m:'破',e:'fracture,fragile,fraction'},
  'frag':{m:'破',e:'fragment'},
  'junct':{m:'连接',e:'junction,adjunct,conjunction'},
  'norm':{m:'标准',e:'normal,enormous,abnormal'},
  'not':{m:'标记',e:'note,notebook,notice,notify'},
  'par':{m:'准备',e:'prepare,repair,compare'},
  'part':{m:'部分',e:'part,partner,apart,depart'},
  'pass':{m:'走',e:'pass,passage,past,compass'},
  'path':{m:'感情',e:'sympathy,antipathy,apathy'},
  'pet':{m:'追求',e:'compete,appetite,repeat'},
  'pound':{m:'放置',e:'compound,expose,compose'},
  'press':{m:'压',e:'press,pressure,express,impress'},
  'prim':{m:'第一',e:'primary,primitive,prime'},
  'pri':{m:'拿',e:'prison,capture,surprise'},
  'rect':{m:'直',e:'correct,direct,erect'},
  'reg':{m:'统治',e:'rule,regular,regulate,royal'},
  'spec':{m:'看',e:'spectacular,spectator,respect'},
  'spir':{m:'呼吸',e:'spirit,inspire,expire,conspire'},
  'stat':{m:'站立',e:'state,status,statue,estate'},
  'strict':{m:'拉紧',e:'strict,restrict,district'},
  'tempt':{m:'尝试',e:'attempt,temptation,contempt'},
  'tend':{m:'伸展',e:'extend,attend,tend,pretend'},
  'tens':{m:'伸展',e:'tense,tension,intense,extent'},
  'term':{m:'边界',e:'term,determine,terminal'},
  'test':{m:'测试',e:'test,protest,contest,attest'},
  'text':{m:'编织',e:'text,texture,pretext,context'},
  'treat':{m:'处理',e:'treat,treatment,retreat,entreat'},
  'turb':{m:'搅动',e:'disturb,turmoil,turbine'},
  'typ':{m:'印',e:'type,typical,typography,prototype'},
  'vad':{m:'走',e:'invade,evade,pervade'},
  'val':{m:'价值',e:'value,valid,valuable,evaluate'},
  'van':{m:'空',e:'vanish,vanity,evacuate'},
  'vari':{m:'改变',e:'variety,various,vary'},
  'vict':{m:'征服',e:'victory,convince,evict'},
  'vit':{m:'生命',e:'vital,vitamin,vivid'},
  'vol':{m:'卷',e:'volume,volunteer,revolt,evolution'},
  'vor':{m:'吃',e:'voracious,herbivore,carnivore'},
  'vow':{m:'誓言',e:'vow,vowel,devour'},
  'ward':{m:'守护',e:'warden,reward,awkward'},
};

const PREFIXES = [
  { p:'anti',m:'反' },{ p:'auto',m:'自动' },{ p:'bene',m:'好' },
  { p:'fore',m:'前面' },{ p:'over',m:'过度' },{ p:'semi',m:'半' },
  { p:'trans',m:'跨越' },{ p:'ultra',m:'超' },{ p:'under',m:'不足' },
  { p:'vice',m:'副' },{ p:'dis',m:'否定' },{ p:'mis',m:'错误' },
  { p:'non',m:'不' },{ p:'out',m:'超过' },{ p:'pre',m:'之前' },
  { p:'pro',m:'向前' },{ p:'sub',m:'下面' },{ p:'sur',m:'超过' },
  { p:'ab',m:'离开' },{ p:'ad',m:'向' },{ p:'de',m:'向下' },
  { p:'en',m:'使' },{ p:'ex',m:'向外' },{ p:'in',m:'向内' },
  { p:'re',m:'再' },{ p:'un',m:'不' },{ p:'up',m:'向上' },
  // com/con/col/cor 是 com- 前缀的变体
  { p:'com',m:'共同' },{ p:'con',m:'共同' },{ p:'col',m:'共同' },{ p:'cor',m:'共同' },
  // 其他常见变体
  { p:'ac',m:'向' },{ p:'af',m:'向' },{ p:'ag',m:'向' },{ p:'al',m:'向' },
  { p:'an',m:'向' },{ p:'ap',m:'向' },{ p:'as',m:'向' },{ p:'at',m:'向' },
  { p:'dif',m:'否定' },{ p:'il',m:'不' },{ p:'im',m:'不' },{ p:'ir',m:'不' },
  { p:'inter',m:'之间' },{ p:'intro',m:'向内' },{ p:'circum',m:'环绕' },
  { p:'counter',m:'反对' },{ p:'contra',m:'反对' },
  { p:'multi',m:'多' },{ p:'poly',m:'多' },
  { p:'tele',m:'远' },{ p:'micro',m:'微' },
  { p:'bi',m:'双' },{ p:'tri',m:'三' },
  { p:'homo',m:'相同' },{ p:'hetero',m:'不同' },
  { p:'hydro',m:'水' },{ p:'geo',m:'地' },
  { p:'post',m:'之后' },{ p:'retro',m:'向后' },
  { p:'sym',m:'共同' },{ p:'syn',m:'共同' },
];

const SUFFIXES = [
  { s:'able',m:'可...的' },{ s:'ible',m:'可...的' },{ s:'tion',m:'名词' },
  { s:'sion',m:'名词' },{ s:'ment',m:'名词' },{ s:'ness',m:'名词' },
  { s:'less',m:'无...的' },{ s:'ful',m:'充满' },{ s:'ing',m:'正在' },
  { s:'ish',m:'像...的' },{ s:'ist',m:'...主义者' },{ s:'ity',m:'名词' },
  { s:'ive',m:'...的' },{ s:'ous',m:'...的' },{ s:'ly',m:'副词' },
  { s:'er',m:'...的人' },{ s:'or',m:'...的人' },{ s:'ed',m:'过去式' },
  { s:'al',m:'...的' },{ s:'ic',m:'...的' },{ s:'ty',m:'名词' }
];

function morphologyAnalyze(word) {
  const w = String(word || '').toLowerCase();
  let prefix='', root='', suffix='';
  let pm='', rm='', sm='';
  for (const x of PREFIXES) {
    if (w.startsWith(x.p) && w.length > x.p.length) { prefix=x.p; pm=x.m; break; }
  }
  for (const x of SUFFIXES) {
    if (w.endsWith(x.s) && w.length > x.s.length) { suffix=x.s; sm=x.m; break; }
  }
  let mid = w;
  if (prefix) mid = mid.slice(prefix.length);
  if (suffix) mid = mid.slice(0, -suffix.length);
  if (mid && mid.length >= 3 && ROOTS[mid]) { root=mid; rm=ROOTS[mid].m; }
  else if (mid && mid.length >= 3) root = mid;

  // 只有词根在词根表里确认存在，才显示拆分（否则不可靠）
  const hasConfirmedRoot = root && ROOTS[root];
  if (!hasConfirmedRoot) return { prefix:'', root:'', suffix:'', explanation:'', displayText:'' };

  const parts = [];
  if (prefix) parts.push(`${prefix}(${pm})`);
  parts.push(`${root}(${rm})`);
  if (suffix) parts.push(`${suffix}(${sm})`);
  return { prefix, root, suffix, explanation: parts.join(' + '), displayText: parts.join(' + ') };
}

// ================================================================
// MODULE 4: dictionary-api.js（Free Dictionary API）
// ================================================================
const DICT_CACHE = new Map();

async function lookupWord(word) {
  if (DICT_CACHE.has(word)) return DICT_CACHE.get(word);
  try {
    const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!resp.ok) { DICT_CACHE.set(word, null); return null; }
    const data = await resp.json();
    if (!data || !data[0]) { DICT_CACHE.set(word, null); return null; }
    const entry = data[0];
    const meaning = (entry.meanings && entry.meanings[0] && entry.meanings[0].definitions && entry.meanings[0].definitions[0])
      ? entry.meanings[0].definitions[0].definition || ''
      : '';
    const phonetic = entry.phonetic || (entry.phonetics && entry.phonetics[0] ? entry.phonetics[0].text : '');
    const example = (entry.meanings && entry.meanings[0] && entry.meanings[0].definitions && entry.meanings[0].definitions[0])
      ? entry.meanings[0].definitions[0].example || ''
      : '';
    const result = { meaning, phonetic, example };
    DICT_CACHE.set(word, result);
    return result;
  } catch { DICT_CACHE.set(word, null); return null; }
}

async function lookupBatch(words, onProgress) {
  const results = {};
  for (let i = 0; i < words.length; i++) {
    const w = words[i].toLowerCase();
    results[w] = await lookupWord(w);
    if (onProgress) onProgress(i + 1, words.length);
    if (Math.random() > 0.6) await sleep(100);
  }
  return results;
}

// ================================================================
// MODULE 5: sentence-gen.js
// ================================================================

// 更好的模板：更自然、更贴合10岁孩子
const TEMPLATES = [
  (w,m) => `I saw "${w}" in my storybook today.`,
  (w,m) => `"${w}" is one of my favorite words.`,
  (w,m) => `Mom asked me to spell "${w}".`,
  (w,m) => `I will try to use "${w}" when I talk today.`,
  (w,m) => `The word "${w}" is fun to say.`,
  (w,m) => `I learned a new word: "${w}"!`,
  (w,m) => `Can you guess what "${w}" means?`,
  (w,m) => `I remember "${w}" from my English class.`,
  (w,m) => `Every time I read "${w}", I smile.`,
  (w,m) => `"${w}" — that's a cool word!`,
];

// 例句生成：只依赖 Free Dictionary API + 延迟防限流
let lastAPICall = 0;
const API_DELAY = 500; // 每次调用间隔 500ms

async function generateSentenceSmart(word, meaning='', dictExample='') {
  const w = word.toLowerCase();

  // 1. 优先用传入的词典例句
  if (dictExample && typeof dictExample === 'string' && dictExample.trim().length > 5 && dictExample.trim().length < 200) {
    return dictExample.trim();
  }

  // 2. Free Dictionary API（加延迟防限流）
  try {
    const now = Date.now();
    if (now - lastAPICall < API_DELAY) {
      await new Promise(r => setTimeout(r, API_DELAY));
    }
    lastAPICall = Date.now();

    const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
    if (resp.ok) {
      const data = await resp.json();
      for (const entry of (data||[])) {
        for (const m of (entry.meanings||[])) {
          for (const def of (m.definitions||[])) {
            if (def.example && typeof def.example === 'string' && def.example.length > 10 && def.example.length < 150) {
              return def.example.trim();
            }
          }
        }
      }
    }
  } catch (e) { /* 静默失败 */ }

  // 3. 都没有 → 不造假句
  return '';
}

// ================================================================
// MODULE 6: spaced-rep.js
// ================================================================
const BOX_LABELS = ['','🔴圆石','🟡泥土','🟢橡木','🔵铁块','🟣绿宝石'];
const BOX_COLORS  = ['','#ef4444','#f59e0b','#22c55e','#3b82f6','#a855f7'];
const RATING = { CORRECT:'correct', ALMOST:'almost', WRONG:'wrong' };

function computeNextReview(word, rating) {
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
  } else {
    interval = 1; ef = Math.max(1.3, parseFloat((ef - 0.2).toFixed(2))); box = 1;
  }
  const nextReview = rating === RATING.ALMOST ? today
    : new Date(Date.now() + interval * 86400000).toISOString().split('T')[0];
  return {
    interval, ef, box, nextReview, lastReview: today,
    timesReviewed: (word.timesReviewed||0)+1,
    timesCorrect: rating===RATING.CORRECT ? (word.timesCorrect||0)+1 : (word.timesCorrect||0)
  };
}

function getDueWords() {
  const today = new Date().toISOString().split('T')[0];
  // 只返回已学过（有lastReview）且到期待复习的词
  const due = store.getAll().filter(w => w.lastReview && w.nextReview && w.nextReview <= today);
  // 按box升序（优先复习难记的词）+ nextReview升序
  return due.sort((a,b) => { if (a.box!==b.box) return a.box-b.box; return a.nextReview.localeCompare(b.nextReview); });
}

// ================================================================
// MODULE 7: island.js
// ================================================================
const MILESTONES = [
  { t:10,  l:'草地', e:'🌿', c:'#22c55e', d:'开垦了一块草地！' },
  { t:25,  l:'树木', e:'🌳', c:'#16a34a', d:'种下了第一批树木！' },
  { t:50,  l:'房屋', e:'🏠', c:'#eab308', d:'建起了第一座房屋！' },
  { t:100, l:'城堡', e:'🏰', c:'#a855f7', d:'拥有了壮观的词汇城堡！' },
];

function getIslandLevel(n) { if(n>=100)return 4; if(n>=50)return 3; if(n>=25)return 2; if(n>=10)return 1; return 0; }
function getNextMilestone(n) { return MILESTONES.find(m=>n<m.t)||null; }
function getUnlockedMilestones(n) { return MILESTONES.filter(m=>n>=m.t); }
function getIslandEmojis(n) { return['🌊','🌿🌊','🌿🌳🌊','🌿🏠🌳🌊','🏰🌿🏠🌳🌊'][getIslandLevel(n)]||'🌊'; }
function getIslandName(n) { return['新建小岛','词汇小岛','词汇庄园','词源城堡','词汇王国'][getIslandLevel(n)]; }

// ================================================================
// TTS
// ================================================================
function speak(word) {
  try { window.speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(word); u.lang='en-US'; window.speechSynthesis.speak(u); } catch {}
}

// ================================================================
// Utility
// ================================================================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ================================================================
// App State
// ================================================================
let currentView = 'home';

// ================================================================
// Routing
// ================================================================
function navigate(view) { currentView = view; render(); }

// ================================================================
// Render
// ================================================================
function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const views = { home:renderHome, import:renderImport, study:renderStudy, island:renderIsland, stats:renderStats, wordbank:renderWordBank };
  app.appendChild(renderNav());
  const viewEl = (views[currentView] || renderHome)();
  if (viewEl) app.appendChild(viewEl);
}

// 返回顶部按钮
(function initBackToTop() {
  const btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.textContent = '⬆';
  btn.title = '返回顶部';
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.appendChild(btn);
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 300);
  });
})();

function el(tag, attrs={}, children=[]) {
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === 'className') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'disabled') { if (v) e.setAttribute(k, ''); } // 布尔属性：只有 true 时才设置
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else if (c instanceof Node) e.appendChild(c);
  }
  return e;
}

function renderNav() {
  const stats = store.getStats();
  const nav = el('nav', {className:'top-nav'}, []);
  const items = [
    { view:'home', icon:'🏠', label:'首页' },
    { view:'import', icon:'📥', label:'导入' },
    { view:'study', icon:'🧠', label:'学习', badge:stats.dueToday||null },
    { view:'island', icon:'🏝️', label:'岛屿' },
    { view:'wordbank', icon:'📚', label:'词库' },
    { view:'stats', icon:'📊', label:'统计' },
  ];
  for (const item of items) {
    const btn = el('button', {className:`nav-btn${currentView===item.view?' active':''}`, onClick:()=>navigate(item.view)}, [
      el('span', {className:'nav-icon'}, [document.createTextNode(item.icon)]),
      el('span', {className:'nav-label'}, [document.createTextNode(item.label)]),
      ...(item.badge ? [el('span', {className:'nav-badge'}, [document.createTextNode(item.badge)])] : [])
    ]);
    nav.appendChild(btn);
  }
  // 切换用户按钮
  nav.appendChild(el('button', {className:'nav-btn', onClick:()=>{
    currentUser = null;
    localStorage.removeItem('lif_current_user');
    renderLogin();
  }}, [
    el('span', {className:'nav-icon'}, [document.createTextNode('🔄')]),
    el('span', {className:'nav-label'}, [document.createTextNode(currentUser ? currentUser.name.substring(0,4) : '切换')])
  ]));
  return nav;
}

function renderHome() {
  // 直接从词库读取数量，避免getStats()计算出错导致按钮禁用
  const words = store.getAll();
  const totalWords = words.length;
  let stats = { total: totalWords, mastered: 0, learning: 0, newWords: 0, dueToday: 0, avgCorrect: 0 };
  try {
    const s = store.getStats();
    if (s && typeof s.total === 'number') stats = { ...stats, ...s };
  } catch {}
  const due = getDueWords();

  const wrap = el('div', {className:'view-home animate-fade-in'}, []);

  wrap.appendChild(el('div', {style:'text-align:center;margin-bottom:var(--space-lg)'}, [
    el('h1', {}, [document.createTextNode('🏝️ LearningIsFun')]),
    el('p', {className:'text-muted',style:'margin-top:var(--space-xs)'}, [document.createTextNode(currentUser ? `👋 ${currentUser.name}，每天10分钟，轻松背单词` : '每天10分钟，轻松背单词')])
  ]));

  wrap.appendChild(el('div', {className:'card mb-md'}, [
    el('div', {className:'flex justify-between items-center mb-sm'}, [
      el('span', {}, [document.createTextNode('📚 我的词库')]),
      el('strong', {}, [document.createTextNode(`${totalWords} 词`)])
    ]),
    el('div', {className:'flex gap-md text-center',style:'font-size:0.8rem;color:var(--color-text-muted)'}, [
      el('div', {}, [el('strong',{style:'color:var(--color-success)'},[document.createTextNode(stats.mastered)]), el('br'), document.createTextNode('已掌握')]),
      el('div', {}, [el('strong',{style:'color:var(--color-warning)'},[document.createTextNode(stats.learning)]), el('br'), document.createTextNode('学习中')]),
      el('div', {}, [el('strong',{style:'color:var(--color-accent)'},[document.createTextNode(stats.newWords)]), el('br'), document.createTextNode('新词')]),
    ])
  ]));

  const dueCard = el('div', {className:'card mb-md',style:'border-left:4px solid var(--color-accent)'}, [
    el('div', {className:'flex justify-between items-center'}, [
      el('div', {}, [
        el('div', {style:'font-size:1.5rem;font-weight:700'}, [document.createTextNode(due.length)]),
        el('p', {className:'text-muted',style:'margin:0'}, [document.createTextNode('今日待复习')])
      ]),
      el('div', {style:'text-align:right'}, [
        el('div', {style:'font-size:1.5rem;font-weight:700;color:var(--color-accent)'}, [document.createTextNode(`${stats.avgCorrect}%`)]),
        el('p', {className:'text-muted',style:'margin:0'}, [document.createTextNode('正确率')])
      ])
    ])
  ]);
  wrap.appendChild(dueCard);

  const studyBtn = el('button', {
    className:'btn btn-primary btn-lg mb-md',
    style:'width:100%',
    onClick:()=>navigate('study'),
    disabled: totalWords === 0
  }, [document.createTextNode('🧠 开始学习')]);
  wrap.appendChild(studyBtn);

  // 每日新词设置
  const settings = store.getSettings();
  const dailySetting = el('div', {className:'flex items-center justify-between mb-md',style:'padding:var(--space-sm);background:var(--color-surface);border-radius:8px'}, [
    el('span', {className:'text-muted'}, [document.createTextNode('📊 每日新词')]),
    el('div', {className:'flex gap-xs'}, [20,30,40].map(n => 
      el('button', {
        className: `btn btn-sm ${settings.dailyNewWords === n ? 'btn-primary' : 'btn-secondary'}`,
        onClick: () => { store.saveSettings({ dailyNewWords: n }); navigate('home'); }
      }, [document.createTextNode(String(n))])
    ))
  ]);
  wrap.appendChild(dailySetting);

  if (totalWords === 0) {
    wrap.appendChild(el('p', {className:'text-muted text-center',style:'margin:var(--space-md 0'}, [
      document.createTextNode('还没有单词，'), el('a',{href:'#',onClick:(e)=>{e.preventDefault();navigate('import');}},[document.createTextNode('去导入一本PDF')]), document.createTextNode(' 开始吧！')
    ]));
  }

  // 岛屿预览
  const level = getIslandLevel(stats.total);
  if (level > 0) {
    wrap.appendChild(el('div', {className:'card mb-md',style:'text-align:center;padding:var(--space-md)'}, [
      el('div', {style:'font-size:2rem'}, [document.createTextNode(getIslandEmojis(stats.total))]),
      el('div', {style:'font-weight:700;color:var(--color-success);margin-top:var(--space-xs)'}, [document.createTextNode(`Lv.${level} ${getIslandName(stats.total)}`)]),
      el('div', {className:'text-muted',style:'font-size:0.8rem'}, [document.createTextNode(`${stats.total} 个词汇建材`)]),
      el('button', {className:'btn btn-sm mt-sm',onClick:()=>navigate('island')}, [document.createTextNode('🏝️ 查看岛屿')])
    ]));
  }

  return wrap;
}

// ===== Import View =====
function renderImport() {
  const wrap = el('div', {className:'view-import animate-fade-in'}, []);
  wrap.appendChild(el('h2', {className:'mb-md'}, [document.createTextNode('📥 导入单词')]));

  const card = el('div', {className:'card'}, []);

  const fileWrap = el('div', {className:'file-upload mb-md'}, []);
  const fileInput = el('input', {type:'file',accept:'.pdf,.csv',id:'file-input',className:'hidden',onChange:()=>{
    if(fileInput.files[0]) fileLabel.textContent = fileInput.files[0].name;
  }});
  const fileLabel = el('label', {for:'file-input',className:'file-label'}, [document.createTextNode('📄 选择 PDF 或 CSV 文件')]);
  fileWrap.appendChild(fileInput);
  fileWrap.appendChild(fileLabel);
  card.appendChild(fileWrap);

  const extractBtn = el('button', {className:'btn btn-primary',style:'width:100%'}, [document.createTextNode('🔍 提取单词')]);
  card.appendChild(extractBtn);

  const preview = el('div', {id:'import-preview',className:'mt-md',style:'display:none'}, []);
  const previewHeader = el('div', {className:'mb-sm'}, [el('h3',{},[document.createTextNode('📋 待导入预览')])]);
  const previewList = el('div', {id:'preview-list'}, []);
  const previewCount = el('div', {className:'text-muted',style:'font-size:0.8rem;margin-top:var(--space-xs)'}, []);
  preview.appendChild(previewHeader);
  preview.appendChild(previewList);
  preview.appendChild(previewCount);

  const lookupBar = el('div', {}, []);
  const lookupStatus = el('span', {className:'text-muted',style:'font-size:0.8rem'}, []);
  const progressBar = el('div', {className:'progress-bar mt-sm mb-sm',style:'display:none'}, [
    el('div', {className:'progress-bar-fill',id:'lookup-fill',style:'width:0%'}, [])
  ]);
  const lookupInfo = el('div', {className:'mt-sm mb-md',style:'display:none;background:var(--color-bg);padding:var(--space-sm);border-radius:8px'}, [
    el('p', {style:'margin:0;font-size:0.85rem'}, [el('span',{className:'text-muted'},[document.createTextNode('🔍 正在查询词典和词根...')])]),
    el('div', {}, [lookupStatus]),
    progressBar
  ]);

  const importBtn = el('button', {className:'btn btn-success mt-md',style:'width:100%;display:none',id:'import-btn'}, [document.createTextNode('✅ 确认导入')]);
  const importResult = el('p', {className:'mt-md text-center',style:'color:var(--color-success);font-weight:700;display:none'}, []);

  const debugToggle = el('button', {className:'btn mt-sm',style:'font-size:0.75rem;padding:2px 8px',onClick:()=>{
    const d = document.getElementById('raw-text-debug');
    d.style.display = d.style.display==='none'?'block':'none';
  }}, [document.createTextNode('🐛 查看原始文本')]);
  const debugBox = el('pre', {id:'raw-text-debug',style:'display:none;max-height:200px;overflow:auto;font-size:0.7rem;background:var(--color-bg);padding:8px;border-radius:4px;white-space:pre-wrap;word-break:break-all'}, []);

  extractBtn.addEventListener('click', async () => {
    if (!fileInput.files[0]) { alert('请先选择一个文件'); return; }
    const file = fileInput.files[0];
    const isCSV = file.name.toLowerCase().endsWith('.csv');
    extractBtn.disabled = true; extractBtn.textContent = '⏳ 提取中...';
    try {
      const { words, rawText } = isCSV
        ? await extractFromCSV(file)
        : await pdfExtractor.extractFromPDF(file);
      extractBtn.textContent = `✅ 提取到 ${words.length} 个单词`;
      extractBtn.disabled = false;
      preview.style.display = 'block';
      lookupInfo.style.display = 'block';
      progressBar.style.display = words.length > 0 ? 'block' : 'none';
      debugBox.textContent = rawText;

      if (words.length === 0) {
        previewList.innerHTML = `<p style="color:var(--color-danger)">❌ 未提取到单词，请点下方"查看原始文本"检查格式</p>`;
        preview.appendChild(debugToggle);
        preview.appendChild(debugBox);
        return;
      }

      let imported = 0;
      lookupStatus.textContent = `0/${words.length} (已入库 0)`;

      // 逐个查询并立即存入，离开页面也不丢数据
      for (let i = 0; i < words.length; i++) {
        const entry = words[i];
        const word = entry.word;
        const pdfMeaning = entry.meaning || '';
        const dict = await lookupWord(word) || {};
        const morph = morphologyAnalyze(word);
        const wordData = {
          word,
          meaning: pdfMeaning || dict.meaning || '',
          phonetic: dict.phonetic || '',
          example: await generateSentenceSmart(word, pdfMeaning || dict.meaning || '', String(dict.example || '')),
          prefix: morph.prefix,
          root: morph.root,
          suffix: morph.suffix,
          explanation: morph.explanation || '',
        };
        // 每个词查完就存
        const added = store.addWord(wordData);
        if (added) imported++;

        const pct = ((i + 1) / words.length * 100).toFixed(0);
        document.getElementById('lookup-fill').style.width = pct + '%';
        lookupStatus.textContent = `${i + 1}/${words.length} (已入库 ${imported})`;

        // 实时更新预览列表（最近20个）
        const item = document.createElement('div');
        item.style.cssText = 'padding:4px 0;border-bottom:1px solid var(--color-bg);display:flex;justify-content:space-between;align-items:center;';
        item.innerHTML = `<strong>${word}</strong><div style="text-align:right;"><div style="font-size:0.75rem;color:var(--color-text-muted)">${wordData.meaning||'❓'}</div></div>`;
        if (previewList.children.length < 20) previewList.appendChild(item);
        else if (previewList.children.length === 20) previewList.insertAdjacentHTML('beforeend', `<p class="text-muted" style="font-size:0.8rem">... 继续入库中</p>`);

        if (Math.random() > 0.6) await sleep(100);
      }

      progressBar.style.display = 'none';
      lookupStatus.textContent = `✅ 全部完成！成功入库 ${imported} 个单词`;
      previewCount.textContent = `共处理 ${words.length} 个，导入 ${imported} 个（跳过重复 ${words.length - imported} 个）`;
      importResult.textContent = `🎉 成功导入 ${imported} 个单词！`;
      importResult.style.display = 'block';
      // 不再需要确认按钮，已逐个入库
    } catch(e) {
      extractBtn.textContent = '🔍 提取单词'; extractBtn.disabled = false;
      preview.innerHTML = `<p style="color:var(--color-danger)">提取失败：${e.message}</p>`;
    }
  });

  card.appendChild(preview);
  card.appendChild(lookupInfo);
  card.appendChild(importBtn);
  card.appendChild(importResult);
  wrap.appendChild(card);

  // 手动添加
  const manualCard = el('div', {className:'card mt-md'}, []);
  manualCard.appendChild(el('h3', {className:'mb-sm'}, [document.createTextNode('✏️ 手动添加单词')]));
  const wordInput = el('input', {type:'text',id:'manual-word',className:'input',placeholder:'输入英文单词',style:'margin-bottom:var(--space-xs)'}, []);
  const meaningInput = el('input', {type:'text',id:'manual-meaning',className:'input',placeholder:'中文释义（可选）',style:'margin-bottom:var(--space-xs)'}, []);
  const addBtn = el('button', {className:'btn btn-secondary',style:'width:100%'}, [document.createTextNode('➕ 添加到词库')]);
  addBtn.addEventListener('click', async () => {
    const w = wordInput.value.trim();
    if (!w) { alert('请输入单词'); return; }
    const morph = morphologyAnalyze(w);
    const ex = await generateSentenceSmart(w, meaningInput.value.trim());
    store.addWord({ word:w, meaning:meaningInput.value.trim(), example:ex, prefix:morph.prefix, root:morph.root, suffix:morph.suffix, explanation:morph.explanation||'' });
    wordInput.value = ''; meaningInput.value = '';
    alert(`✅ "${w}" 已添加！`);
  });
  manualCard.appendChild(wordInput);
  manualCard.appendChild(meaningInput);
  manualCard.appendChild(addBtn);
  wrap.appendChild(manualCard);

  return wrap;
}

// ===== Study View =====
// 学习流程：复习 → 学习新词 → 测试 → 庆祝
function renderStudy() {
  const wrap = el('div', {className:'view-study'}, []);
  const due = getDueWords();
  const allWords = store.getAll();
  const settings = store.getSettings();
  const dailyGoal = settings.dailyNewWords || 20;
  const dailyMax = settings.dailyMax || 60;

  // 追踪今日已学数量（按日期区分，过期重置）
  const today = new Date().toISOString().split('T')[0];
  const meta = loadData().meta || {};
  if (meta.lastLearnDate !== today) {
    meta.lastLearnDate = today;
    meta.learnedToday = 0;
    const d = loadData();
    d.meta = meta;
    saveData(d);
  }
  let learnedToday = meta.learnedToday || 0;

  // 阶段状态
  let phase = 'review'; // review | learn | test | celebration
  let reviewedWords = []; // 刚才复习过的词
  let learnedWords = []; // 刚才学过的新词
  let reviewIndex = 0;
  let learnIndex = 0;
  let testIndex = 0;
  let testCorrect = 0;
  let testQuestions = [];
  let reachedGoal = false; // 达到每日目标（20词）
  let reachedMax = false;   // 达到每日上限（60词）

  // 获取所有未学的新词
  const allNewWords = allWords.filter(w => !w.lastReview);
  // 根据今日已学数量，决定可学的新词
  const remainingNewWords = allNewWords.slice(learnedToday, learnedToday + dailyGoal);
  const hasNewWords = remainingNewWords.length > 0;
  const hasReview = due.length > 0;

  // 如果既没复习也没新词
  if (!hasReview && !hasNewWords) {
    wrap.appendChild(el('h2', {className:'mb-md'}, [document.createTextNode('🧠 学习')]));
    wrap.appendChild(el('div', {className:'card',style:'text-align:center;padding:var(--space-xl)'}, [
      el('div', {style:'font-size:3rem'}, [document.createTextNode('🎉')]),
      el('h3', {className:'mt-sm'}, [document.createTextNode('今日任务已完成！')]),
      el('p', {className:'text-muted'}, [document.createTextNode('明天再来复习更多单词吧～')]),
      el('button', {className:'btn mt-md',onClick:()=>navigate('home')}, [document.createTextNode('🏠 返回首页')])
    ]));
    return wrap;
  }

  // 确定起始阶段
  phase = hasReview ? 'review' : 'learn';

  // ===== 庆祝动画 =====
  function showCelebration() {
    wrap.innerHTML = '';
    const emojis = ['🎉','🎊','✨','⭐','🌟','💫','🏆','🎯'];
    const particles = [];
    for (let i = 0; i < 20; i++) {
      const particle = el('span', {
        style: `position:fixed;font-size:${20+Math.random()*30}px;left:${Math.random()*100}%;top:${Math.random()*100}%;animation:celebrate 1s ease-out forwards;pointer-events:none;opacity:0;z-index:1000`
      }, [document.createTextNode(emojis[Math.floor(Math.random()*emojis.length)])]);
      particles.push(particle);
      document.body.appendChild(particle);
    }
    setTimeout(() => particles.forEach(p => p.remove()), 3000);

    wrap.appendChild(el('div', {className:'card',style:'text-align:center;padding:var(--space-xl)'}, [
      el('div', {style:'font-size:4rem'}, [document.createTextNode('🏆')]),
      el('h2', {className:'mt-md',style:'color:var(--color-success)'}, [document.createTextNode('太棒了！')]),
      el('p', {className:'mt-sm'}, [document.createTextNode(`复习 ${reviewedWords.length} 词 · 学习 ${learnedWords.length} 词 · 测试 ${testCorrect}/${testQuestions.length} 对`)]),
      el('div', {className:'mt-md',style:'font-size:1.5rem'}, [document.createTextNode('💎 +10 积分')]),
      el('button', {className:'btn btn-primary mt-lg',onClick:()=>navigate('home')}, [document.createTextNode('🏠 返回首页')])
    ]));
  }

  // ===== 测试阶段 =====
  function showTest() {
    const pool = [...reviewedWords, ...learnedWords].filter(w => w && w.word && w.meaning);
    if (pool.length < 2) {
      showCelebration();
      return;
    }
    testQuestions = [];
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const allWords = store.getAll();
    for (let i = 0; i < Math.min(10, shuffled.length); i++) {
      const word = shuffled[i];
      const type = i % 2 === 0 ? 'choice' : 'spell';
      const distractors = pool.filter(w => w.id !== word.id).sort(() => Math.random() - 0.5).slice(0, 3);
      testQuestions.push({ word, type, distractors });
    }
    testIndex = 0;
    testCorrect = 0;
    renderTestQuestion();
  }

  function renderTestQuestion() {
    if (testIndex >= testQuestions.length) {
      showCelebration();
      return;
    }
    const q = testQuestions[testIndex];
    wrap.innerHTML = '';
    wrap.appendChild(el('h2', {className:'mb-md'}, [document.createTextNode(`📝 测试 ${testIndex+1}/${testQuestions.length}`)]));

    if (q.type === 'choice') {
      // 4选1：给单词选中文
      wrap.appendChild(el('div', {className:'card mb-md',style:'text-align:center'}, [
        el('div', {style:'font-size:1.5rem;font-weight:700'}, [document.createTextNode(q.word.word)]),
        el('button', {className:'btn btn-sm mt-sm',onClick:()=>speak(q.word.word)}, [document.createTextNode('🔊 发音')])
      ]));
      const options = [q.word, ...q.distractors].sort(() => Math.random() - 0.5);
      const optionsWrap = el('div', {className:'grid gap-sm'}, []);
      options.forEach(opt => {
        optionsWrap.appendChild(el('button', {
          className:'btn btn-secondary',
          style:'text-align:left',
          onClick:() => {
            if (opt.id === q.word.id) {
              testCorrect++;
              wrap.appendChild(el('div', {className:'text-success mt-sm',style:'text-align:center'}, [document.createTextNode('✅ 正确！')]));
            } else {
              wrap.appendChild(el('div', {className:'text-danger mt-sm',style:'text-align:center'}, [document.createTextNode(`❌ 答案是：${q.word.meaning}`)]));
            }
            setTimeout(() => { testIndex++; renderTestQuestion(); }, 800);
          }
        }, [document.createTextNode(opt.meaning || '(无释义)')]));
      });
      wrap.appendChild(optionsWrap);

    } else {
      // 拼写题：给中文+发音，点击字母排列成单词
      const target = q.word.word.toLowerCase();
      const letters = target.split('').sort(() => Math.random() - 0.5);
      let answer = []; // 已选字母
      let pool = [...letters]; // 待选字母

      wrap.appendChild(el('div', {className:'card mb-md',style:'text-align:center'}, [
        el('div', {style:'font-size:1.2rem'}, [document.createTextNode(`中文：${q.word.meaning}`)]),
        el('button', {className:'btn btn-sm mt-sm',onClick:()=>speak(q.word.word)}, [document.createTextNode('🔊 发音')]),
        el('div', {className:'text-muted mt-sm',style:'font-size:0.85rem'}, [document.createTextNode(`(${target.length}个字母)`)])
      ]));

      // 答案区
      const answerWrap = el('div', {className:'flex gap-sm mb-md',style:'justify-content:center;flex-wrap:wrap;min-height:48px'}, []);
      function renderAnswer() {
        answerWrap.innerHTML = '';
        if (answer.length === 0) {
          answerWrap.appendChild(el('span', {className:'text-muted',style:'line-height:40px'}, [document.createTextNode('点击下方字母排列')]));
        } else {
          answer.forEach((letter, i) => {
            const btn = el('button', {
              className:'btn btn-primary',
              style:'width:40px;height:40px;padding:0;font-size:1.2rem;font-weight:700',
              onClick:() => {
                // 点击答案区字母 → 移回字母池
                answer.splice(i, 1);
                pool.push(letter);
                renderAnswer();
                renderPool();
              }
            }, [document.createTextNode(letter)]);
            answerWrap.appendChild(btn);
          });
        }
      }

      // 字母池
      const poolWrap = el('div', {className:'flex gap-sm mb-md',style:'justify-content:center;flex-wrap:wrap'}, []);
      function renderPool() {
        poolWrap.innerHTML = '';
        pool.forEach((letter, i) => {
          const btn = el('button', {
            className:'btn btn-secondary',
            style:'width:40px;height:40px;padding:0;font-size:1.2rem;font-weight:700;text-transform:lowercase',
            onClick:() => {
              // 点击字母池字母 → 移到答案区
              pool.splice(i, 1);
              answer.push(letter);
              renderAnswer();
              renderPool();
            }
          }, [document.createTextNode(letter)]);
          poolWrap.appendChild(btn);
        });
      }

      // 按钮区
      const btnWrap = el('div', {className:'flex gap-sm',style:'justify-content:center'}, []);
      const clearBtn = el('button', {className:'btn btn-sm',onClick:() => {
        pool = [...letters].sort(() => Math.random() - 0.5);
        answer = [];
        renderAnswer();
        renderPool();
      }}, [document.createTextNode('🔄 清空')]);

      const submitBtn = el('button', {className:'btn btn-primary btn-sm',onClick:() => {
        const userAnswer = answer.join('');
        if (userAnswer === target) {
          testCorrect++;
          wrap.appendChild(el('div', {className:'text-success mt-sm',style:'text-align:center'}, [document.createTextNode('✅ 正确！')]));
        } else {
          wrap.appendChild(el('div', {className:'text-danger mt-sm',style:'text-align:center'}, [document.createTextNode(`❌ 正确拼写：${target}`)]));
        }
        submitBtn.disabled = true;
        clearBtn.disabled = true;
        setTimeout(() => { testIndex++; renderTestQuestion(); }, 1200);
      }}, [document.createTextNode('✅ 确定')]);

      btnWrap.appendChild(clearBtn);
      btnWrap.appendChild(submitBtn);

      wrap.appendChild(answerWrap);
      wrap.appendChild(poolWrap);
      wrap.appendChild(btnWrap);

      renderAnswer();
      renderPool();
    }
  }

  // ===== 学习新词阶段 =====
  function showLearn() {
    const word = remainingNewWords[learnIndex];
    if (!word || reachedMax) {
      // 没有更多新词或已达上限
      if (learnedWords.length > 0) {
        showTest();
      } else {
        showCelebration();
      }
      return;
    }

    const currentTotal = learnedToday + learnedWords.length;
    const isGoalReached = currentTotal >= dailyGoal;
    const isMaxReached = currentTotal >= dailyMax;

    wrap.innerHTML = '';
    // 进度条
    const progressPct = Math.min(100, (currentTotal / dailyGoal) * 100);
    wrap.appendChild(el('div', {className:'mb-sm'}, [
      el('div', {style:'display:flex;justify-content:space-between;font-size:0.85rem;color:var(--color-text-muted)',className:'mb-xs'}, [
        document.createTextNode(`📚 学习新词 ${currentTotal}/${dailyGoal}`),
        document.createTextNode(isMaxReached ? '🕐 明日继续' : (isGoalReached ? '🎯 目标达成' : ''))
      ]),
      el('div', {style:'height:6px;background:var(--color-surface);border-radius:3px;overflow:hidden'}, [
        el('div', {style:`width:${progressPct}%;height:100%;background:${isGoalReached?'var(--color-success)':'var(--color-accent)'};transition:width 0.3s`}, [])
      ])
    ]));

    const card = el('div', {className:'card',style:'text-align:center;padding:var(--space-lg)'}, []);
    card.appendChild(el('div', {style:'font-size:2rem;font-weight:700'}, [document.createTextNode(word.word)]));
    card.appendChild(el('button', {className:'btn btn-sm mt-sm',onClick:()=>speak(word.word)}, [document.createTextNode('🔊 发音')]));
    if (word.phonetic) card.appendChild(el('div', {className:'text-muted mt-sm'}, [document.createTextNode(word.phonetic)]));
    const morphText = word.explanation || (word.prefix || word.root || word.suffix ? [word.prefix, word.root, word.suffix].filter(Boolean).join(' + ') : '');
    if (morphText) card.appendChild(el('div', {className:'mt-md',style:'color:var(--color-accent)'}, [document.createTextNode(morphText)]));
    card.appendChild(el('div', {className:'mt-md',style:'font-size:1.2rem'}, [document.createTextNode(word.meaning || '(暂无释义)')]));
    if (word.example) card.appendChild(el('div', {className:'mt-sm text-muted',style:'font-style:italic'}, [document.createTextNode(String(word.example))]));
    wrap.appendChild(card);

    // 已达60词上限
    if (isMaxReached) {
      wrap.appendChild(el('div', {className:'card mt-lg',style:'text-align:center;background:var(--color-surface)'}, [
        el('div', {style:'font-size:1.5rem'}, [document.createTextNode('🌙 今日学习已达上限（60词）')]),
        el('p', {className:'text-muted mt-sm'}, [document.createTextNode('明天继续学习更多单词吧～')]),
        learnedWords.length > 0
          ? el('button', {className:'btn btn-primary mt-md',onClick:()=>showTest()}, [document.createTextNode('📝 进入测试')])
          : el('button', {className:'btn mt-md',onClick:()=>navigate('home')}, [document.createTextNode('🏠 返回首页')])
      ]));
      return;
    }

    // 达成20词目标，显示继续学习按钮
    if (isGoalReached && !reachedGoal) {
      reachedGoal = true;
      wrap.appendChild(el('div', {className:'card mt-lg',style:'text-align:center;background:linear-gradient(135deg,var(--color-success),#2ecc71);color:#fff'}, [
        el('div', {style:'font-size:2rem'}, [document.createTextNode('🎉')]),
        el('h3', {className:'mt-sm'}, [document.createTextNode('今日目标达成！')]),
        el('p', {}, [document.createTextNode(`已学习 ${currentTotal} 个新词 💪`)]),
        el('button', {className:'btn mt-md',style:'background:#fff;color:var(--color-success)',onClick:()=>{
          learnedWords.length > 0 ? showTest() : showCelebration();
        }}, [document.createTextNode('📝 进入测试')]),
        el('button', {className:'btn mt-sm',style:'color:#fff;opacity:0.9',onClick:()=>{
          reachedGoal = true;
          const d = loadData();
          d.meta = d.meta || {};
          d.meta.lastLearnDate = today;
          d.meta.learnedToday = learnedToday + learnedWords.length;
          saveData(d);
          learnedWords = [];
          learnedToday = d.meta.learnedToday;
          learnIndex = 0;
          showLearn();
        }}, [document.createTextNode('🚀 继续学习更多 →')])
      ]));
      return;
    }

    // 普通学习按钮
    wrap.appendChild(el('button', {className:'btn btn-primary mt-lg',style:'width:100%',onClick:()=>{
      const today2 = new Date().toISOString().slice(0,10);
      store.updateWord(word.id, { lastReview: today2, box: 1, timesReviewed: 1 });
      learnedWords.push(word);
      learnedToday++;
      const d = loadData();
      d.meta = d.meta || {};
      d.meta.lastLearnDate = today2;
      d.meta.learnedToday = learnedToday;
      saveData(d);
      learnIndex++;
      showLearn();
    }}, [document.createTextNode('✅ 我学会了')]));

    wrap.appendChild(el('button', {className:'btn mt-sm',style:'width:100%',onClick:()=>{
      learnedWords.push(word);
      learnedToday++;
      const d = loadData();
      d.meta = d.meta || {};
      d.meta.lastLearnDate = today;
      d.meta.learnedToday = learnedToday;
      saveData(d);
      learnIndex++;
      showLearn();
    }}, [document.createTextNode('⏭️ 跳过')]));
  }

  // ===== 复习阶段 =====
  function showReview() {
    if (reviewIndex >= due.length) {
      if (remainingNewWords.length > 0) {
        phase = 'learn';
        showLearn();
      } else if (reviewedWords.length > 0) {
        showTest();
      } else {
        showCelebration();
      }
      return;
    }

    const word = due[reviewIndex];
    wrap.innerHTML = '';
    wrap.appendChild(el('h2', {className:'mb-sm'}, [document.createTextNode(`🔄 复习 ${reviewIndex+1}/${due.length}`)]));
    wrap.appendChild(el('div', {className:'text-muted mb-md',style:'font-size:0.85rem'}, [
      document.createTextNode(`盒子：${BOX_LABELS[word.box]||'新词'} | `),
      document.createTextNode(`正确率：${word.timesReviewed?Math.round((word.timesCorrect||0)/(word.timesReviewed)*100):0}%`)
    ]));

    const card = el('div', {className:'card flashcard',style:'text-align:center;cursor:pointer'}, []);
    const wordEl = el('div', {style:'font-size:2rem;font-weight:700'}, [document.createTextNode(word.word)]);
    const phoneticEl = el('div', {className:'text-muted',style:'font-size:0.9rem'}, [document.createTextNode(word.phonetic||'')]);
    const morphEl = el('div', {style:'font-size:0.8rem;color:var(--color-accent)',className:'mt-sm'}, []);
    if (word.explanation) morphEl.textContent = word.explanation;
    else if (word.prefix||word.root||word.suffix) morphEl.textContent = [word.prefix,word.root,word.suffix].filter(Boolean).join(' + ');
    const meaningEl = el('div', {className:'mt-md text-muted',style:'font-size:1.1rem;display:none'}, [document.createTextNode(word.meaning||'(暂无释义)')]);
    const exampleEl = el('div', {className:'mt-sm',style:'font-size:0.9rem;color:var(--color-text-muted);font-style:italic;display:none'}, [document.createTextNode(String(word.example||''))]);

    let revealed = false;
    function reveal() {
      if (!revealed) {
        revealed = true;
        meaningEl.style.display = 'block';
        exampleEl.style.display = word.example ? 'block' : 'none';
        card.style.background = 'var(--color-surface)';
      }
    }
    card.onclick = reveal;
    card.appendChild(wordEl);
    card.appendChild(phoneticEl);
    card.appendChild(morphEl);
    card.appendChild(meaningEl);
    card.appendChild(exampleEl);
    wrap.appendChild(card);

    const btnWrap = el('div', {className:'grid gap-sm mt-lg'}, []);
    btnWrap.appendChild(el('button', {className:'btn btn-danger',onClick:()=>{ store.updateWord(word.id, computeNextReview(word, 0)); reviewedWords.push(word); reviewIndex++; setTimeout(showReview, 300); }}, [document.createTextNode('❌ 不会')]));
    btnWrap.appendChild(el('button', {className:'btn btn-warning',onClick:()=>{ store.updateWord(word.id, computeNextReview(word, 1)); reviewedWords.push(word); reviewIndex++; setTimeout(showReview, 300); }}, [document.createTextNode('🤔 有点忘')]));
    btnWrap.appendChild(el('button', {className:'btn btn-success',onClick:()=>{ store.updateWord(word.id, computeNextReview(word, 2)); reviewedWords.push(word); reviewIndex++; setTimeout(showReview, 300); }}, [document.createTextNode('✅ 记住了')]));
    wrap.appendChild(btnWrap);

    return wrap;
  }

  // 启动
  if (phase === 'review' && hasReview) {
    showReview();
  } else {
    showLearn();
  }
  return wrap;
}

// 庆祝动画CSS（动态注入）
if (!document.getElementById('celebrate-style')) {
  const style = document.createElement('style');
  style.id = 'celebrate-style';
  style.textContent = `@keyframes celebrate{0%{opacity:1;transform:scale(0) rotate(0deg)}50%{opacity:1;transform:scale(1.2) rotate(180deg)}100%{opacity:0;transform:scale(0.5) rotate(360deg) translateY(-100px)}}`;
  document.head.appendChild(style);
}

// ===== Island View =====
function renderIsland() {
  const stats = store.getStats();
  const wrap = el('div', {className:'view-island animate-fade-in'}, []);
  wrap.appendChild(el('h2', {className:'mb-md'}, [document.createTextNode('🏝️ 我的岛屿')]));

  const card = el('div', {className:'card',style:'text-align:center;padding:var(--space-lg)'}, []);
  card.appendChild(el('div', {style:'font-size:4rem;margin:var(--space-md) 0;line-height:1.2'}, [document.createTextNode(getIslandEmojis(stats.total))]));
  card.appendChild(el('div', {style:'font-size:1.5rem;font-weight:700;color:#4ade80'}, [document.createTextNode(`Lv.${getIslandLevel(stats.total)} ${getIslandName(stats.total)}`)]));
  card.appendChild(el('div', {className:'text-muted mt-sm'}, [document.createTextNode(`${stats.total} 个词汇建材`)]));

  const next = getNextMilestone(stats.total);
  if (next) {
    const progress = Math.round((stats.total/next.t)*100);
    card.appendChild(el('div', {className:'mt-md'}, [
      el('div', {className:'flex justify-between mb-sm',style:'font-size:0.8rem'}, [
        el('span', {}, [document.createTextNode(`${next.e} ${next.l}`)]),
        el('span', {}, [document.createTextNode(`${stats.total}/${next.t}`)])
      ]),
      el('div', {className:'progress-bar'}, [el('div', {className:'progress-bar-fill',style:`width:${progress}%;background:${next.c}`}, [])])
    ]));
  } else {
    card.appendChild(el('div', {className:'mt-md',style:'color:#a855f7;font-weight:700'}, [document.createTextNode('🎉 已解锁全部里程碑！')]));
  }

  const unlocked = getUnlockedMilestones(stats.total);
  if (unlocked.length > 0) {
    card.appendChild(el('div', {className:'mt-md',style:'font-size:0.85rem'}, [
      el('p', {className:'text-muted',style:'margin:0'}, [document.createTextNode('已解锁里程碑：')]),
      unlocked.map(m => el('span', {style:`margin-right:var(--space-sm);color:${m.c}`}, [document.createTextNode(`${m.e} ${m.l}`)]))
    ]));
  }
  wrap.appendChild(card);

  // 岛屿说明
  wrap.appendChild(el('div', {className:'card mt-md'}, [
    el('h3', {className:'mb-sm'}, [document.createTextNode('🏗️ 岛屿升级规则')]),
    ...MILESTONES.map(m => el('div', {className:'flex items-center gap-sm',style:'padding:4px 0'}, [
      el('span', {style:`color:${m.c};font-size:1.2rem`}, [document.createTextNode(m.e)]),
      el('span', {}, [document.createTextNode(`${m.t} 词 → ${m.l}`)]),
    ]))
  ]));

  return wrap;
}

// ===== Stats View =====
function renderStats() {
  const stats = store.getStats();
  const words = store.getAll();
  const boxCounts = [0,0,0,0,0];
  for (const w of words) boxCounts[w.box||1]++;
  const wrap = el('div', {className:'view-stats animate-fade-in'}, []);
  wrap.appendChild(el('h2', {className:'mb-md'}, [document.createTextNode('📊 学习统计')]));
  wrap.appendChild(el('div', {className:'grid grid-2 gap-sm mb-md'}, [
    el('div', {className:'card text-center'}, [el('div',{style:'font-size:1.5rem;font-weight:700'},[document.createTextNode(stats.total)]), el('p',{className:'text-muted',style:'margin:0'},[document.createTextNode('总词汇')])]),
    el('div', {className:'card text-center'}, [el('div',{style:'font-size:1.5rem;font-weight:700;color:var(--color-success)'},[document.createTextNode(stats.dueToday)]), el('p',{className:'text-muted',style:'margin:0'},[document.createTextNode('今日复习')])]),
    el('div', {className:'card text-center'}, [el('div',{style:'font-size:1.5rem;font-weight:700'},[document.createTextNode(`${stats.avgCorrect}%`)]), el('p',{className:'text-muted',style:'margin:0'},[document.createTextNode('正确率')])]),
    el('div', {className:'card text-center'}, [el('div',{style:'font-size:1.5rem;font-weight:700'},[document.createTextNode(stats.mastered)]), el('p',{className:'text-muted',style:'margin:0'},[document.createTextNode('已掌握')])]),
  ]));

  // 盒子分布
  wrap.appendChild(el('div', {className:'card mb-md'}, [
    el('h3', {className:'mb-sm'}, [document.createTextNode('📦 词汇盒子分布')]),
    ...[1,2,3,4,5].map(i => el('div', {className:'flex items-center gap-sm mb-sm'}, [
      el('span', {style:`font-weight:700;color:${BOX_COLORS[i]}`}, [document.createTextNode(BOX_LABELS[i])]),
      el('div', {className:'progress-bar',style:'flex:1'}, [el('div',{className:'progress-bar-fill',style:`width:${stats.total?Math.round(boxCounts[i]/stats.total*100):0}%;background:${BOX_COLORS[i]}`},[])]),
      el('span', {className:'text-muted',style:'font-size:0.8rem'}, [document.createTextNode(boxCounts[i])])
    ]))
  ]));

  // 清空
  if (stats.total > 0) {
    wrap.appendChild(el('button', {className:'btn',style:'width:100;color:var(--color-danger)',onClick:()=>{
      if(confirm('确定要清空所有单词吗？此操作不可恢复！')) { store.clearAll(); render(); }
    }}, [document.createTextNode('🗑️ 清空所有数据')]));
  }

  return wrap;
}

// ===== WordBank View =====
function renderWordBank() {
  const words = store.getAll();
  const wrap = el('div', {className:'view-wordbank animate-fade-in'}, []);
  wrap.appendChild(el('h2', {className:'mb-sm'}, [document.createTextNode('📚 词库')]));
  wrap.appendChild(el('p', {className:'text-muted mb-md'}, [document.createTextNode(`共 ${words.length} 个单词`)]));

  // AI 例句生成按钮 + 清理假句按钮 + 补全释义按钮
  const aiBtn = el('button', {className:'btn btn-secondary',style:'flex:1'}, [document.createTextNode('🤖 AI 生成例句')]);
  const cleanBtn = el('button', {className:'btn btn-danger',style:'flex:1'}, [document.createTextNode('🗑️ 清理假句')]);
  const fillMeaningBtn = el('button', {className:'btn btn-warning',style:'flex:1'}, [document.createTextNode('📖 补全释义')]);
  const aiStatus = el('div', {className:'text-center',style:'font-size:0.85rem;margin-top:8px;padding:8px;background:var(--color-surface);border-radius:4px;display:none'}, []);
  wrap.appendChild(el('div', {style:'display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap'}, [aiBtn, cleanBtn, fillMeaningBtn]));
  wrap.appendChild(aiStatus);
  
  aiBtn.addEventListener('click', async () => {
    try {
      aiStatus.style.display = 'block';
      aiStatus.style.color = 'var(--color-text)';
      aiStatus.textContent = '🔄 开始...';
      
      const knownTemplates = [
        'I learn', 'The word', 'Can you use', 'Do you know',
        '"', 'My teacher explained', 'I wrote', 'I saw',
        'Mom asked', 'I will try', 'I know', 'Every time',
        'Can you guess', 'I remember', 'People often', 'When I hear',
        'a ', 'the ',
      ];
      const isTemplate = ex => {
        const s = String(ex || '').trim();
        return !s || knownTemplates.some(t => s.startsWith(t)) || /^.{1,20}—/.test(s);
      };
      const needsAI = words.filter(w => {
        const ex = String(w.example || '').trim();
        return !ex || isTemplate(ex);
      });
      
      aiStatus.textContent = `📊 需要 ${needsAI.length} 个词`;
      if (needsAI.length === 0) { 
        aiStatus.textContent = '✅ 所有单词已有例句';
        aiStatus.style.color = 'var(--color-success)';
        return; 
      }
      
      aiBtn.disabled = true; 
      aiBtn.textContent = '⏳ 生成中...';
      
      let success = 0, failed = 0;
      for (let i = 0; i < needsAI.length; i++) {
        const w = needsAI[i];
        aiStatus.textContent = `⏳ ${i+1}/${needsAI.length}: ${w.word}`;
        try {
          const s = await generateSentenceSmart(w.word, w.meaning);
          if (s) {
            w.example = s;
            const data = loadData();
            const idx = data.words.findIndex(x => x.id === w.id);
            if (idx >= 0) { data.words[idx].example = s; saveData(data); }
            success++;
          } else {
            failed++;
          }
        } catch (e) {
          failed++;
          aiStatus.textContent = `❌ ${w.word}: ${e.message}`;
          await new Promise(r => setTimeout(r, 500));
        }
        await new Promise(r => setTimeout(r, 150));
      }
      
      aiBtn.textContent = '✓ 完成！'; 
      aiBtn.disabled = false;
      aiStatus.style.color = 'var(--color-success)';
      aiStatus.textContent = `✅ 成功 ${success}，失败 ${failed}`;
      setTimeout(() => render(), 1500);
    } catch (e) {
      aiBtn.textContent = '❌ 出错了';
      aiBtn.disabled = false;
      aiStatus.style.color = 'var(--color-error)';
      aiStatus.textContent = `❌ 错误: ${e.message}`;
    }
  });

  // 清理假句：把所有非真实来源的例句清空
  cleanBtn.addEventListener('click', () => {
    if (!confirm('确定要清空所有假句和损坏数据吗？真实例句不会被删除。')) return;
    const data = loadData();
    let cleared = 0;
    data.words.forEach(w => {
      const ex = String(w.example || '').trim();
      // 清理：模板句、释义格式、Promise对象、空字符串
      if (ex && (knownTemplates.some(t => ex.startsWith(t)) || /^.{1,20}—/.test(ex) || ex.startsWith('[object'))) {
        w.example = '';
        cleared++;
      }
    });
    saveData(data);
    alert(`已清空 ${cleared} 个假句/损坏数据`);
    render();
  });

  // 补全释义：批量查询没有中文释义的单词
  fillMeaningBtn.addEventListener('click', async () => {
    const noMeaning = words.filter(w => !w.meaning || !w.meaning.trim());
    if (noMeaning.length === 0) {
      alert('所有单词都有释义了！');
      return;
    }
    if (!confirm(`有 ${noMeaning.length} 个单词缺少释义，开始批量查询吗？`)) return;
    
    aiStatus.style.display = 'block';
    aiStatus.textContent = `⏳ 查询中... 0/${noMeaning.length}`;
    fillMeaningBtn.disabled = true;
    
    let success = 0, failed = 0;
    for (let i = 0; i < noMeaning.length; i++) {
      const w = noMeaning[i];
      aiStatus.textContent = `⏳ ${i+1}/${noMeaning.length}: ${w.word}`;
      try {
        const result = await lookupWord(w.word);
        if (result && result.meaning) {
          store.updateWord(w.id, { 
            meaning: result.meaning,
            phonetic: result.phonetic || w.phonetic,
            example: result.example || w.example
          });
          success++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
      // 延迟避免请求过快
      await new Promise(r => setTimeout(r, 300));
    }
    
    aiStatus.textContent = `✅ 完成！成功 ${success} 个，失败 ${failed} 个`;
    aiStatus.style.color = 'var(--color-success)';
    fillMeaningBtn.disabled = false;
    setTimeout(() => render(), 1000);
  });

  const searchInput = el('input', {type:'text',id:'wordbank-search',className:'input mb-md',placeholder:'🔍 搜索单词...'}, []);
  const list = el('div', {id:'wordbank-list'}, []);

  function renderList(filter='') {
    const filtered = filter
      ? words.filter(w => {
          const word = String(w.word || '');
          const meaning = String(w.meaning || '');
          return word.includes(filter.toLowerCase()) || meaning.includes(filter);
        })
      : words;
    if (filtered.length === 0) {
      list.innerHTML = '<p class="text-muted text-center" style="padding:var(--space-xl)">没有找到匹配的单词</p>';
      return;
    }
    list.innerHTML = filtered.map(w => `
      <div class="card mb-sm" style="padding:var(--space-sm)">
        <div class="flex justify-between items-center">
          <div>
            <strong>${w.word}</strong>
            <span style="font-size:0.75rem;color:var(--color-text-muted);margin-left:4px">${w.phonetic||''}</span>
          </div>
          <div style="font-size:0.85rem;color:${BOX_COLORS[w.box||1]}">${BOX_LABELS[w.box||1]||'新词'}</div>
        </div>
        <div style="font-size:0.85rem;color:var(--color-text-muted)">${w.meaning||'(无释义)'}</div>
        ${w.explanation?`<div style="font-size:0.75rem;color:var(--color-accent)">${w.explanation}</div>`:''}
        <div style="font-size:0.75rem;color:var(--color-text-muted);font-style:italic">${String(w.example||'')}</div>
      </div>
    `).join('');
  }

  searchInput.addEventListener('input', () => renderList(searchInput.value));
  wrap.appendChild(searchInput);
  wrap.appendChild(list);
  renderList();

  return wrap;
}

// ================================================================
// Boot
// ================================================================
window.__lif = { navigate };
window.navigate = navigate;

// URL hash 重置: 访问网址加 #reset 清空词库
if (location.hash === '#reset') {
  localStorage.clear();
  location.hash = '';
  location.reload();
}

// 初始化：检查用户登录状态
document.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('lif_current_user');
  if (savedUser) {
    setCurrentUser(savedUser);
    initTestData();
    render();
  } else {
    renderLogin();
  }
});
