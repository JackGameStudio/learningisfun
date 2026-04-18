/**
 * app.js - LearningIsFun 主程序（单文件，解决GitHub Pages CORS）
 * 使用 Free Dictionary API 在线查询
 */

// ================================================================
// MODULE 1: vocabulary-store.js
// ================================================================
const STORE_KEY = 'lif_v1';

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

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

const store = {
  getAll() { return loadData().words; },
  getWord(id) { return loadData().words.find(w => w.id === id) || null; },
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

// ================================================================
// MODULE 2: pdf-extractor.js
// ================================================================
// 解析 3 列排版 PDF，每页号码从 1 开始
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
  filtered.sort((a, b) => {
    const ya = a.transform[5], yb = b.transform[5];
    if (Math.abs(ya - yb) > 5) return yb - ya; // Y 降序（从上到下）
    return a.transform[4] - b.transform[4];     // X 升序（从左到右）
  });

  const lines = [];
  let currentLine = '';
  let lastY = null;

  for (const item of filtered) {
    const y = item.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 5) {
      if (currentLine) lines.push(currentLine);
      currentLine = item.str;
    } else {
      currentLine += ' ' + item.str;
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
  'duc':{m:'引导',e:'educate,produce,conduct'},
  'form':{m:'形式',e:'transform,perform,uniform'},
  'fract':{m:'破',e:'fracture,fragile,fraction'},
  'frag':{m:'破',e:'fragment'},
  'junct':{m:'连接',e:'junction,adjunct,conjunction'},
  'norm':{m:'标准',e:'normal,enormous,abnormal'},
  'not':{m:'标记',e:'note,notebook,notice,notify'},
  'par':{m:'准备',e:'prepare,repair,compare'},
  'par':{m:'相等',e:'equal,apart,compare'},
  'part':{m:'部分',e:'part,partner,apart,depart'},
  'pass':{m:'走',e:'pass,passage,past,compass'},
  'path':{m:'感情',e:'sympathy,antipathy,apathy'},
  'pend':{m:'挂',e:'depend,independent,appendix'},
  'pet':{m:'追求',e:'compete,appetite,repeat'},
  'pet':{m:'寻找',e:'petition,competent,impetus'},
  'ply':{m:'折叠',e:'imply,explicit,implicit'},
  'ply':{m:'充满',e:'apply,supply,comply'},
  'pound':{m:'放置',e:'compound,expose,compose'},
  'press':{m:'压',e:'press,pressure,express,impress'},
  'prim':{m:'第一',e:'primary,primitive,prime'},
  'pri':{m:'拿',e:'prison,capture,surprise'},
  'pri':{m:'价格',e:'price,precious,appreciate'},
  'rect':{m:'直',e:'correct,direct,erect'},
  'reg':{m:'统治',e:'rule,regular,regulate,royal'},
  'rupt':{m:'断裂',e:'interrupt,bankrupt,disrupt'},
  'scrib':{m:'写',e:'describe,prescribe,inscribe'},
  'sist':{m:'站立',e:'resist,assist,persist,consist'},
  'solv':{m:'松开',e:'solve,solution,resolve,dissolve'},
  'spec':{m:'看',e:'spectacular,spectator,respect'},
  'spir':{m:'呼吸',e:'spirit,inspire,expire,conspire'},
  'stat':{m:'站立',e:'state,status,statue,estate'},
  'strict':{m:'拉紧',e:'strict,restrict,district'},
  'struct':{m:'建造',e:'structure,construct,destroy'},
  'tain':{m:'保持',e:'contain,obtain,retain,sustain'},
  'tempt':{m:'尝试',e:'attempt,temptation,contempt'},
  'tend':{m:'伸展',e:'extend,attend,tend,pretend'},
  'tens':{m:'伸展',e:'tense,tension,intense,extent'},
  'term':{m:'边界',e:'term,determine,terminal'},
  'test':{m:'测试',e:'test,protest,contest,attest'},
  'text':{m:'编织',e:'text,texture,pretext,context'},
  'tract':{m:'拉',e:'tractor,attract,contract,distract'},
  'treat':{m:'处理',e:'treat,treatment,retreat,entreat'},
  'turb':{m:'搅动',e:'disturb,turmoil,turbine'},
  'typ':{m:'印',e:'type,typical,typography,prototype'},
  'vac':{m:'空',e:'vacant,vacuum,vacate'},
  'vad':{m:'走',e:'invade,evade,pervade'},
  'val':{m:'价值',e:'value,valid,valuable,evaluate'},
  'van':{m:'空',e:'vanish,vanity,evacuate'},
  'vari':{m:'改变',e:'variety,various,vary'},
  'ven':{m:'来',e:'adventure,convene,intervene'},
  'vert':{m:'转',e:'convert,revert,divert,advert'},
  'vict':{m:'征服',e:'victory,convince,evict'},
  'vid':{m:'看',e:'video,evidence,provide'},
  'vis':{m:'看',e:'vision,visit,advise,supervise'},
  'vit':{m:'生命',e:'vital,vitamin,vivid'},
  'voc':{m:'声音',e:'vocal,vocation,advocate,provoke'},
  'vol':{m:'卷',e:'volume,volunteer,revolt,evolution'},
  'vor':{m:'吃',e:'voracious,herbivore,carnivore'},
  'vow':{m:'誓言',e:'vow,vowel,devour'},
  'ward':{m:'守护',e:'warden,reward,awkward'},
  'way':{m:'路',e:'subway,highway,away'},
  'wealth':{m:'财富',e:'wealth,healthy,stealthy'},
  'wear':{m:'穿',e:'wear,unaware,hardware,software'},
  'weather':{m:'天气',e:'weather,whether,wether'},
  'weep':{m:'哭',e:'weep,sweeping,underwear'},
  'weigh':{m:'重量',e:'weigh,weight,freight'},
  'well':{m:'井',e:'well,farewell,welfare,wels'},
  'wet':{m:'湿',e:'wet,wetter,wetting,sweat'},
  'what':{m:'什么',e:'whatever,somewhat,anywhat'},
  'wheel':{m:'轮子',e:'wheel,wheelchair,whoever'},
  'when':{m:'何时',e:'whenever,somewhen,whence'},
  'where':{m:'哪里',e:'wherever,somewhere,anywhere'},
  'whether':{m:'是否',e:'whether,weather,wether'},
  'which':{m:'哪个',e:'whichever,somewhich'},
  'while':{m:'当...时',e:'while,worthwhile,whilst'},
  'whip':{m:'鞭子',e:'whip,whisper,whipsaw'},
  'whole':{m:'全部',e:'whole,wholesale,wholesome'},
  'whose':{m:'谁的',e:'whose,whoever,shower'},
  'wide':{m:'宽',e:'wide,widen,widely,widespread'},
  'wife':{m:'妻子',e:'wife,midwife,housewife'},
  'wild':{m:'野生的',e:'wild,wilderness,wildlife'},
  'win':{m:'赢',e:'win,winner,wind,winding'},
  'wind':{m:'风',e:'wind,window,winder,rewind'},
  'wing':{m:'翅膀',e:'wing,sting,bring,string'},
  'winter':{m:'冬天',e:'winter,wintery,wintersweet'},
  'wipe':{m:'擦',e:'wipe,swipe,pipe,tripe'},
  'wire':{m:'电线',e:'wire,wired,wiring,wiretap'},
  'wise':{m:'聪明',e:'wise,wisdom,otherwise,likewise'},
  'wish':{m:'希望',e:'wish,biography,wishful'},
  'wit':{m:'智慧',e:'wit,witness,witty,witch'},
  'with':{m:'与',e:'with,withdraw,within,without'},
  'within':{m:'在...内部',e:'within'},
  'without':{m:'没有',e:'without'},
  'witness':{m:'证人',e:'witness'},
  'wizard':{m:'巫师',e:'wizard'},
  'woke':{m:'醒',e:'woke,awake,awaken,waken'},
  'wolf':{m:'狼',e:'wolf,wolves,woolly'},
  'woman':{m:'女人',e:'woman,women,womanhood'},
  'wonder':{m:'想知道',e:'wonder,wonderful,ponder'},
  'wood':{m:'木头',e:'wood,woods,wooden,woodwork'},
  'wool':{m:'羊毛',e:'wool,woolen,woolly'},
  'word':{m:'单词',e:'word,password,keyword'},
  'work':{m:'工作',e:'work,homework,homework,network'},
  'world':{m:'世界',e:'world,worldwide'},
  'worm':{m:'虫子',e:'worm,earthworm'},
  'worn':{m:'磨损的',e:'worn,warning,warning'},
  'worried':{m:'担心的',e:'worried,worry,worrying'},
  'worse':{m:'更糟',e:'worse,worst,worsen'},
  'worship':{m:'崇拜',e:'worship'},
  'worst':{m:'最糟的',e:'worst'},
  'worth':{m:'价值',e:'worth,worthy,worthwhile'},
  'worthy':{m:'值得的',e:'worthy'},
  'would':{m:'将会',e:'would,should,wouldn'},
  'wound':{m:'伤口',e:'wound,wounded'},
  'wrap':{m:'包裹',e:'wrap,wrapper,wrapping'},
  'wrath':{m:'愤怒',e:'wrath,wreak,wreath'},
  'wreck':{m:'破坏',e:'wreck, wreckage'},
  'wrestle':{m:'摔跤',e:'wrestle,wrestling'},
  'wring':{m:'拧',e:'wring,wrinkle,wrist'},
  'wrist':{m:'手腕',e:'wrist,wrinkle'},
  'write':{m:'写',e:'write,writer,writing,written'},
  'wrong':{m:'错误的',e:'wrong,write,wrath'},
  'yard':{m:'院子',e:'yard,yardstick'},
  'year':{m:'年',e:'year,yearly,yearn'},
  'yell':{m:'喊叫',e:'yell,yellow'},
  'yesterday':{m:'昨天',e:'yesterday'},
  'yield':{m:'产生',e:'yield,field,yielding'},
  'young':{m:'年轻的',e:'young,younger,youngest'},
  'your':{m:'你的',e:'your,yours,yourself'},
  'youth':{m:'青年',e:'youth,youthful'},
  'zero':{m:'零',e:'zero,zest,zone'},
  'zone':{m:'区域',e:'zone,ozone,freeze'}
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

// Datamuse: 找真实搭配（动词/形容词/名词搭配）
// 从 Tatoeba 获取真实例句（免费、无需 key）
async function fetchTatoebaExample(word) {
  try {
    // 使用 CORS 代理
    const url = `https://corsproxy.io/?${encodeURIComponent('https://tatoeba.org/en/api_v0/search?query='+word+'&from=eng&to=cmn&limit=5')}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    const sentences = (data.results || []).filter(r => r.text && r.text.length > 10 && r.text.length < 150);
    if (sentences.length > 0) return sentences[Math.floor(Math.random() * sentences.length)].text;
  } catch (e) { console.warn('Tatoeba error:', e); }
  return null;
}

async function generateSentenceSmart(word, meaning='', dictExample='') {
  const w = word.toLowerCase();

  // 1. 优先用传入的词典例句
  if (dictExample && typeof dictExample === 'string' && dictExample.trim().length > 5 && dictExample.trim().length < 200) {
    console.log(`[例句] ${word}: 使用词典例句 ✓`);
    return dictExample.trim();
  }

  // 2. Free Dictionary API 真实例句
  try {
    const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
    if (resp.ok) {
      const data = await resp.json();
      const examples = [];
      for (const entry of (data||[])) {
        for (const m of (entry.meanings||[])) {
          for (const def of (m.definitions||[])) {
            if (def.example && typeof def.example === 'string' && def.example.length > 10 && def.example.length < 150) {
              examples.push(def.example.trim());
            }
          }
        }
      }
      if (examples.length > 0) {
        console.log(`[例句] ${word}: Free Dict API ✓`);
        return examples[Math.floor(Math.random() * examples.length)];
      }
    }
  } catch (e) { console.warn('Free Dict error:', e); }

  // 3. Tatoeba 真实语料例句
  try {
    const tatoeba = await fetchTatoebaExample(w);
    if (tatoeba) return tatoeba;
  } catch (e) { console.warn('Tatoeba error:', e); }

  // 4. 都没有 → 不造假句
  console.log(`[例句] ${word}: 无真实例句`);
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
  const due = store.getAll().filter(w => w.nextReview && w.nextReview <= today);
  const newDue = due.filter(w => !w.lastReview).sort(() => Math.random() - 0.5);
  const reviewDue = due.filter(w => w.lastReview).sort((a,b) => { if (a.box!==b.box) return a.box-b.box; return a.nextReview.localeCompare(b.nextReview); });
  return [...newDue, ...reviewDue];
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
    el('p', {className:'text-muted',style:'margin-top:var(--space-xs)'}, [document.createTextNode('每天10分钟，轻松背单词')])
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
  const fileInput = el('input', {type:'file',accept:'.pdf',id:'pdf-input',className:'hidden',onChange:()=>{
    if(fileInput.files[0]) fileLabel.textContent = fileInput.files[0].name;
  }});
  const fileLabel = el('label', {for:'pdf-input',className:'file-label'}, [document.createTextNode('📄 选择 PDF 文件')]);
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
    if (!fileInput.files[0]) { alert('请先选择一个 PDF 文件'); return; }
    extractBtn.disabled = true; extractBtn.textContent = '⏳ 提取中...';
    try {
      const { words, rawText } = await pdfExtractor.extractFromPDF(fileInput.files[0]);
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

  // 阶段状态
  let phase = 'review'; // review | learn | test | celebration
  let reviewedWords = []; // 刚才复习过的词
  let learnedWords = []; // 刚才学过的新词
  let reviewIndex = 0;
  let learnIndex = 0;
  let testIndex = 0;
  let testCorrect = 0;
  let testQuestions = [];

  // 获取新词（没有lastReview的）
  const newWords = allWords.filter(w => !w.lastReview).slice(0, 5);
  const hasReview = due.length > 0;
  const hasNewWords = newWords.length > 0;

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
    // 3秒后移除粒子
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
    // 生成测试题：从复习/学习的词中出题
    const pool = [...reviewedWords, ...learnedWords].filter(w => w && w.word && w.meaning);
    if (pool.length < 2) {
      // 词不够，跳过测试直接庆祝
      showCelebration();
      return;
    }

    // 生成题目：一半4选1，一半填空
    testQuestions = [];
    const shuffled = pool.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(10, shuffled.length); i++) {
      const word = shuffled[i];
      const type = i % 2 === 0 ? 'choice' : 'fill';
      // 获取干扰项
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
          className:'btn',
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
      // 填空：给中文+词根提示，写单词
      const morphHint = q.word.explanation || (q.word.prefix || q.word.root || q.word.suffix ? [q.word.prefix, q.word.root, q.word.suffix].filter(Boolean).join(' + ') : '');
      wrap.appendChild(el('div', {className:'card mb-md',style:'text-align:center'}, [
        el('div', {style:'font-size:1.1rem'}, [document.createTextNode(`中文：${q.word.meaning}`)]),
        morphHint ? el('div', {className:'text-muted mt-sm',style:'font-size:0.9rem'}, [document.createTextNode(`词根：${morphHint}`)]) : null,
      ].filter(Boolean)));

      const inputWrap = el('div', {className:'flex gap-sm'}, []);
      const input = el('input', {type:'text',placeholder:'输入单词',style:'flex:1;padding:var(--space-sm)',autofocus:true});
      const submitBtn = el('button', {className:'btn btn-primary',onClick:checkFill}, [document.createTextNode('确定')]);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') checkFill(); });

      function checkFill() {
        const answer = input.value.trim().toLowerCase();
        const correct = q.word.word.toLowerCase();
        if (answer === correct) {
          testCorrect++;
          wrap.appendChild(el('div', {className:'text-success mt-sm',style:'text-align:center'}, [document.createTextNode('✅ 正确！')]));
        } else {
          wrap.appendChild(el('div', {className:'text-danger mt-sm',style:'text-align:center'}, [document.createTextNode(`❌ 答案是：${q.word.word}`)]));
        }
        setTimeout(() => { testIndex++; renderTestQuestion(); }, 800);
      }

      inputWrap.appendChild(input);
      inputWrap.appendChild(submitBtn);
      wrap.appendChild(inputWrap);
    }
  }

  // ===== 学习新词阶段 =====
  function showLearn() {
    if (learnIndex >= newWords.length) {
      // 学完新词，进入测试
      if (learnedWords.length > 0) {
        showTest();
      } else {
        showCelebration();
      }
      return;
    }

    const word = newWords[learnIndex];
    wrap.innerHTML = '';
    wrap.appendChild(el('h2', {className:'mb-sm'}, [document.createTextNode(`📚 学习新词 ${learnIndex+1}/${newWords.length}`)]));

    const card = el('div', {className:'card',style:'text-align:center;padding:var(--space-lg)'}, []);
    // 单词
    card.appendChild(el('div', {style:'font-size:2rem;font-weight:700'}, [document.createTextNode(word.word)]));
    // 发音按钮
    card.appendChild(el('button', {className:'btn btn-sm mt-sm',onClick:()=>speak(word.word)}, [document.createTextNode('🔊 发音')]));
    // 音标
    if (word.phonetic) card.appendChild(el('div', {className:'text-muted mt-sm'}, [document.createTextNode(word.phonetic)]));
    // 词根拆解
    const morphText = word.explanation || (word.prefix || word.root || word.suffix ? [word.prefix, word.root, word.suffix].filter(Boolean).join(' + ') : '');
    if (morphText) card.appendChild(el('div', {className:'mt-md',style:'color:var(--color-accent)'}, [document.createTextNode(`词根：${morphText}`)]));
    // 释义
    card.appendChild(el('div', {className:'mt-md',style:'font-size:1.2rem'}, [document.createTextNode(word.meaning || '(暂无释义)')]));
    // 例句
    if (word.example) card.appendChild(el('div', {className:'mt-sm text-muted',style:'font-style:italic'}, [document.createTextNode(String(word.example))]));

    wrap.appendChild(card);

    // 确认按钮
    wrap.appendChild(el('button', {className:'btn btn-primary mt-lg',style:'width:100%',onClick:()=>{
      // 标记已学习（设为盒子1，下次复习）
      const today = new Date().toISOString().slice(0,10);
      store.updateWord(word.id, { lastReview: today, box: 1, timesReviewed: 1 });
      learnedWords.push(word);
      learnIndex++;
      showLearn();
    }}, [document.createTextNode('✅ 我学会了')]));

    // 跳过按钮
    wrap.appendChild(el('button', {className:'btn mt-sm',style:'width:100%',onClick:()=>{
      learnIndex++;
      showLearn();
    }}, [document.createTextNode('⏭️ 跳过')]));
  }

  // ===== 复习阶段 =====
  function showReview() {
    if (reviewIndex >= due.length) {
      // 复习结束，进入学习新词
      if (newWords.length > 0) {
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
        exampleEl.style.display = 'block';
        speak(word.word);
      } else {
        revealed = false;
        meaningEl.style.display = 'none';
        exampleEl.style.display = 'none';
      }
    }
    card.addEventListener('click', reveal);

    card.appendChild(wordEl);
    card.appendChild(phoneticEl);
    card.appendChild(morphEl);
    card.appendChild(meaningEl);
    card.appendChild(exampleEl);
    wrap.appendChild(card);

    wrap.appendChild(el('p', {className:'text-muted text-center',style:'font-size:0.8rem;margin:var(--space-sm) 0'}, [document.createTextNode('💡 点击卡片显示释义')]));

    const btnWrap = el('div', {className:'mt-md'}, []);
    const btnStyle = {flex:1, padding:'var(--space-sm) var(--space-xs)',fontSize:'0.9rem'};
    btnWrap.appendChild(el('button', {className:'btn btn-danger',style:btnStyle,onClick:()=>answerReview(word,RATING.WRONG)}, [document.createTextNode('❌ 不会')]));
    btnWrap.appendChild(el('button', {className:'btn btn-warning',style:btnStyle,onClick:()=>answerReview(word,RATING.ALMOST)}, [document.createTextNode('🤔 有点忘')]));
    btnWrap.appendChild(el('button', {className:'btn btn-success',style:btnStyle,onClick:()=>answerReview(word,RATING.CORRECT)}, [document.createTextNode('✅ 记住了')]));
    wrap.appendChild(btnWrap);

    function answerReview(w, rating) {
      const updates = computeNextReview(w, rating);
      store.updateWord(w.id, updates);
      reviewedWords.push(w);
      reviewIndex++;
      showReview();
    }
  }

  // 开始
  if (phase === 'review') showReview();
  else if (phase === 'learn') showLearn();

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

document.addEventListener('DOMContentLoaded', render);
