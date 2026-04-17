/**
 * morphology.js
 * 英语词根/前缀/后缀自动分析器
 *
 * 策略：最长匹配优先
 * - 前缀：从单词开头匹配
 * - 后缀：从单词末尾匹配
 * - 中间剩余部分作为词根
 */

// ============================================================
// 词根词典
// ============================================================
const ROOTS = {
  // ---- port = 搬运、携带 ----
  'port': { meaning: '搬运', examples: 'export, import, transport, portable, portfolio' },

  // ---- mit/miss = 发送 ----
  'mit': { meaning: '发送', examples: 'permit, submit, transmit, admit, emit' },
  'miss': { meaning: '发送', examples: 'missile, mission' },

  // ---- tract = 拉、抽 ----
  'tract': { meaning: '拉', examples: 'attract, contract, extract, distract, subtract' },
  'tract': { meaning: '拉', examples: 'tractor, protract' },

  // ---- duc/duct = 引导 ----
  'duc': { meaning: '引导', examples: 'conduct, introduce, produce, reduce, deduce' },
  'duct': { meaning: '引导', examples: 'conduct, product, duct' },

  // ---- scrib/script = 写 ----
  'scrib': { meaning: '写', examples: 'describe, prescribe, subscribe, inscribe' },
  'script': { meaning: '写', examples: 'script, manuscript, postscript' },

  // ---- pel/puls = 推 ----
  'pel': { meaning: '推', examples: 'compel, expel, propel, dispel' },
  'puls': { meaning: '推', examples: 'pulse, compulsory, impulse, repel, compel' },

  // ---- pend/pens = 悬挂、花费 ----
  'pend': { meaning: '悬挂', examples: 'suspend, depend, pendulum, pending' },
  'pens': { meaning: '花费', examples: 'expense, pension, spend, compensate' },

  // ---- spect = 看 ----
  'spect': { meaning: '看', examples: 'respect, inspect, expect, suspect, spectacle' },

  // ---- struct = 建造 ----
  'struct': { meaning: '建造', examples: 'construct, instruct, destroy, structure' },

  // ---- form = 形式 ----
  'form': { meaning: '形式', examples: 'transform, inform, perform, reform, uniform' },

  // ---- pos = 放置 ----
  'pos': { meaning: '放置', examples: 'compose, propose, expose, suppose, dispose' },
  'pon': { meaning: '放置', examples: 'component, postpone, opponent' },

  // ---- vis/vid = 看 ----
  'vis': { meaning: '看', examples: 'vision, visit, television, invisible, advise' },
  'vid': { meaning: '看', examples: 'video, evident, provide, divide' },

  // ---- aud = 听 ----
  'aud': { meaning: '听', examples: 'audio, audience, audit, auditorium' },

  // ---- dic/dict = 说 ----
  'dic': { meaning: '说', examples: 'dictate, predict, indicate, contradict' },
  'dict': { meaning: '说', examples: 'dictation, dictionary, predict' },

  // ---- cap/capt/cep = 拿、抓 ----
  'cap': { meaning: '拿', examples: 'capture, capacity, escape, except' },
  'capt': { meaning: '抓', examples: 'captive, capture' },
  'cept': { meaning: '拿', examples: 'except, intercept, accept' },

  // ---- fer = 携带 ----
  'fer': { meaning: '携带', examples: 'transfer, refer, prefer, offer, suffer, differ' },

  // ---- vert/vers = 转 ----
  'vert': { meaning: '转', examples: 'convert, advert, revert, divert' },
  'vers': { meaning: '转', examples: 'reverse, diverse, universe, conversation' },

  // ---- sist = 站立 ----
  'sist': { meaning: '站立', examples: 'resist, exist, consist, insist, persist' },

  // ---- sist = 站立 ----
  'sta': { meaning: '站立', examples: 'stable, status, stage, estate, instead' },
  'stit': { meaning: '站立', examples: 'constitute, substitute, institute' },
  'st': { meaning: '站立', examples: 'obstacle, circumstance, status' },

  // ---- grad/gress = 走 ----
  'grad': { meaning: '走', examples: 'progress, grade, gradual, graduate' },
  'gress': { meaning: '走', examples: 'aggress, progress, congress, ingredient' },

  // ---- log/loqu = 说 ----
  'log': { meaning: '说', examples: 'dialogue, catalog, apology, psychology' },
  'loqu': { meaning: '说', examples: 'eloquent, colloquial' },

  // ---- voc/vok = 叫喊 ----
  'voc': { meaning: '叫喊', examples: 'vocabulary, vocation, advocate, provoke' },
  'vok': { meaning: '叫喊', examples: 'invoke, evoke, provoke' },

  // ---- solv/solu = 松开 ----
  'solv': { meaning: '松开', examples: 'solve, resolve, dissolve' },
  'solu': { meaning: '松开', examples: 'solution, resolve, absolute' },

  // ---- ply/pli = 折叠 ----
  'ply': { meaning: '折叠', examples: 'apply, reply, supply, comply, imply, multiply' },
  'pli': { meaning: '折叠', examples: 'imply, explicit, implicit, comply' },

  // ---- strain/stringict = 拉紧 ----
  'strain': { meaning: '拉紧', examples: 'strain, constrain, restrain, restrain' },
  'strict': { meaning: '拉紧', examples: 'strict, restrict, district, construct' },

  // ---- press = 压 ----
  'press': { meaning: '压', examples: 'press, pressure, express, impress, compress, depress' },

  // ---- scrib/script = 写 ----
  'scrib': { meaning: '写', examples: 'describe, prescribe, subscribe' },

  // ---- ject = 扔 ----
  'ject': { meaning: '扔', examples: 'inject, reject, project, object, subject, eject' },

  // ---- lect/leg = 选择/读 ----
  'lect': { meaning: '选择', examples: 'collect, select, neglect, elect, intellect' },
  'leg': { meaning: '读', examples: 'legend, legible, intellect' },

  // ---- ven/vent = 来 ----
  'ven': { meaning: '来', examples: 'prevent, invent, event, adventure, convention' },
  'vent': { meaning: '来', examples: 'venture,vent' },

  // ---- cid/cis = 切 ----
  'cid': { meaning: '切', examples: 'decide, suicide, incident, accident' },
  'cis': { meaning: '切', examples: 'precise, scissors, incise' },

  // ---- fract/frag = 破 ----
  'fract': { meaning: '破', examples: 'fracture, fragile, fraction' },
  'frag': { meaning: '破', examples: 'fragment, fragile' },

  // ---- sid = 坐 ----
  'sid': { meaning: '坐', examples: 'president, reside, consider, reside' },

  // ---- tin/tain/ten = 持 ----
  'tain': { meaning: '持有', examples: 'contain, obtain, maintain, retain, sustain, obtain' },
  'tin': { meaning: '持有', examples: 'continent, continent' },
  'ten': { meaning: '持有', examples: 'tenant, ten, tenable' },

  // ---- flu/fluc = 流 ----
  'flu': { meaning: '流', examples: 'fluent, fluid, influence, float, flush' },
  'fluc': { meaning: '流', examples: 'fluctuate' },

  // ---- rupt = 破 ----
  'rupt': { meaning: '破', examples: 'interrupt, corrupt, erupt, bankrupt, disrupt' },

  // ---- loc = 地方 ----
  'loc': { meaning: '地方', examples: 'local, locate, location, allocate' },

  // ---- temper/contemper = 调节 ----
  'temper': { meaning: '调节', examples: 'temper, temperature, temper' },

  // ---- migr = 迁移 ----
  'migr': { meaning: '迁移', examples: 'migrate, immigrant, emigrate, immigrate' },

  // ---- cur/r/curs = 跑 ----
  'cur': { meaning: '跑', examples: 'current, occur, recur, curriculum' },
  'curs': { meaning: '跑', examples: 'course, cursor, precursor, discourse' },

  // ---- grav = 重 ----
  'grav': { meaning: '重', examples: 'gravity, grave, grav' },

  // ---- lev = 轻/举起 ----
  'lev': { meaning: '举起', examples: 'elevate, lever, lev' },

  // ---- fort = 力量 ----
  'fort': { meaning: '力量', examples: 'effort, comfortable, enforce, fortress' },

  // ---- civ = 公民 ----
  'civ': { meaning: '公民', examples: 'civil, civilian, civilization' },

  // ---- popul = 人民 ----
  'popul': { meaning: '人民', examples: 'population, popular, public' },

  // ---- vac = 空 ----
  'vac': { meaning: '空', examples: 'vacant, vacation, vacuum, vacate' },

  // ---- med/medic = 治疗 ----
  'med': { meaning: '治疗', examples: 'medicine, medical, remedy' },

  // ---- psych = 心理 ----
  'psych': { meaning: '心理', examples: 'psychology, psychic, psycho' },

  // ---- psych = 心理 ----
  'soci': { meaning: '社会', examples: 'social, society, associate' },

  // ---- techn = 技术 ----
  'techn': { meaning: '技术', examples: 'technology, technique, technical' },

  // ---- nat = 出生 ----
  'nat': { meaning: '出生', examples: 'native, natural, nature, nation, birth' },

  // ---- fin = 结束/边界 ----
  'fin': { meaning: '结束', examples: 'finish, finally, finite, infinite, define' },

  // ---- anim = 生命 ----
  'anim': { meaning: '生命', examples: 'animal, animate, unanimous' },

  // ---- corp = 身体 ----
  'corp': { meaning: '身体', examples: 'corporate, corporation, corpse, corpus' },

  // ---- man/manu = 手 ----
  'man': { meaning: '手', examples: 'manual, manage, manuscript, manicure' },
  'manu': { meaning: '手', examples: 'manufacture, manuscript, emancipate' },

  // ---- ped = 脚 ----
  'ped': { meaning: '脚', examples: 'pedal, pedestrian, expedition' },

  // ---- clud/clus = 关闭 ----
  'clud': { meaning: '关闭', examples: 'include, exclude, conclude, seclude, occlude' },
  'clus': { meaning: '关闭', examples: 'conclusion, exclusion, occlusion' },

  // ---- numer = 数 ----
  'numer': { meaning: '数', examples: 'numerous, numerical, enumerate' },

  // ---- graph/gram = 写/画 ----
  'graph': { meaning: '写', examples: 'telegraph, photograph, geography, paragraph' },
  'gram': { meaning: '写', examples: 'grammar, program, diagram' },

  // ---- phon = 声音 ----
  'phon': { meaning: '声音', examples: 'telephone, saxophone, microphone, symphony' },

  // ---- cycl = 圆 ----
  'cycl': { meaning: '圆', examples: 'bicycle, recycle, cycle, cyclone' },

  // ---- meter/metr = 测量 ----
  'meter': { meaning: '测量', examples: 'thermometer, speedometer, centimeter' },
  'metr': { meaning: '测量', examples: 'metric, geometry, symmetry' },

  // ---- bio = 生命 ----
  'bio': { meaning: '生命', examples: 'biology, biography, antibiotic' },

  // ---- geo = 地球 ----
  'geo': { meaning: '地球', examples: 'geography, geometry, geology' },

  // ---- aqu = 水 ----
  'aqu': { meaning: '水', examples: 'aquarium, aqual' },

  // ---- audi = 听 ----
  'audi': { meaning: '听', examples: 'audience, audible, audio' },

  // ---- cap = 头 ----
  'cap': { meaning: '头', examples: 'capital, captain, cabbage' },

  // ---- corp = 体 ----
  'corp': { meaning: '体', examples: 'corpse, corporate, incorporate' },

  // ---- claim = 叫 ----
  'claim': { meaning: '叫', examples: 'exclaim, proclaim, declaim, acclaim' },

  // ---- pend = 挂 ----
  'pend': { meaning: '挂', examples: 'depend, independent, appendix, suspend' },
};

// ============================================================
// 前缀词典（按长度降序排列 = 最长匹配优先）
// ============================================================
const PREFIXES = [
  // 4字符前缀
  { prefix: 'anti', meaning: '反' },
  { prefix: 'auto', meaning: '自动' },
  { prefix: 'bene', meaning: '好' },
  { prefix: 'fore', meaning: '前面' },
  { prefix: 'meta', meaning: '之后' },
  { prefix: 'over', meaning: '过度' },
  { prefix: 'semi', meaning: '半' },
  { prefix: 'semi', meaning: '半' },
  { prefix: 'trans', meaning: '跨越' },
  { prefix: 'ultra', meaning: '超' },
  { prefix: 'under', meaning: '不足' },
  { prefix: 'vice', meaning: '副' },
  { prefix: 'with', meaning: '向后' },

  // 3字符前缀
  { prefix: 'dis', meaning: '否定' },
  { prefix: 'ex', meaning: '向外' },
  { prefix: 'mis', meaning: '错误' },
  { prefix: 'non', meaning: '不' },
  { prefix: 'out', meaning: '超过' },
  { prefix: 'pre', meaning: '之前' },
  { prefix: 'pro', meaning: '向前' },
  { prefix: 'sub', meaning: '下面' },
  { prefix: 'sum', meaning: '总计' },
  { prefix: 'sup', meaning: '上面' },
  { prefix: 'sur', meaning: '超过' },
  { prefix: 'tri', meaning: '三' },
  { prefix: 'uni', meaning: '一' },

  // 2字符前缀
  { prefix: 'ab', meaning: '离开' },
  { prefix: 'ad', meaning: '向' },
  { prefix: 'an', meaning: '不' },
  { prefix: 'be', meaning: '使' },
  { prefix: 'by', meaning: '旁边' },
  { prefix: 'co', meaning: '共同' },
  { prefix: 'de', meaning: '向下' },
  { prefix: 'do', meaning: '做' },
  { prefix: 'em', meaning: '使' },
  { prefix: 'en', meaning: '使' },
  { prefix: 'ex', meaning: '向外' },
  { prefix: 'go', meaning: '去' },
  { prefix: 'in', meaning: '向内' },
  { prefix: 'in', meaning: '不' },
  { prefix: 'ir', meaning: '不' },
  { prefix: 'is', meaning: '不' },
  { prefix: 'it', meaning: '不' },
  { prefix: 'li', meaning: '里' },
  { prefix: 'lo', meaning: '下' },
  { prefix: 'of', meaning: '不' },
  { prefix: 'on', meaning: '上' },
  { prefix: 'op', meaning: '对面' },
  { prefix: 're', meaning: '再' },
  { prefix: 'to', meaning: '向' },
  { prefix: 'un', meaning: '不' },
  { prefix: 'up', meaning: '向上' },
];

// ============================================================
// 后缀词典（按长度降序排列）
// ============================================================
const SUFFIXES = [
  // 4字符后缀
  { suffix: 'able', meaning: '可...的' },
  { suffix: 'ible', meaning: '可...的' },
  { suffix: 'tion', meaning: '名词后缀' },
  { suffix: 'sion', meaning: '名词后缀' },
  { suffix: 'ment', meaning: '名词后缀' },
  { suffix: 'ness', meaning: '名词后缀' },
  { suffix: 'less', meaning: '无...的' },
  { suffix: 'fold', meaning: '倍' },
  { suffix: 'wise', meaning: '方向' },

  // 3字符后缀
  { suffix: 'ful', meaning: '充满...的' },
  { suffix: 'ing', meaning: '正在...' },
  { suffix: 'ion', meaning: '名词后缀' },
  { suffix: 'ish', meaning: '像...的' },
  { suffix: 'ist', meaning: '...主义者' },
  { suffix: 'ity', meaning: '名词后缀' },
  { suffix: 'ive', meaning: '...的' },
  { suffix: 'ous', meaning: '...的' },
  { suffix: 'ly', meaning: '副词后缀' },
  { suffix: 'er', meaning: '...的人' },
  { suffix: 'or', meaning: '...的人' },
  { suffix: 'ed', meaning: '过去式' },
  { suffix: 'es', meaning: '复数/三单' },
  { suffix: 'en', meaning: '使...' },
  { suffix: 'th', meaning: '名词后缀' },

  // 2字符后缀
  { suffix: 'al', meaning: '...的' },
  { suffix: 'an', meaning: '...人' },
  { suffix: 'ar', meaning: '...的' },
  { suffix: 'ee', meaning: '被动者' },
  { suffix: 'en', meaning: '由...制成' },
  { suffix: 'ic', meaning: '...的' },
  { suffix: 'ty', meaning: '名词后缀' },
];

// ============================================================
// 分析器
// ============================================================

/**
 * 分析单词的词根/前缀/后缀
 * @param {string} word - 英文单词
 * @returns {{ prefix: string, root: string, suffix: string, meaning: string }}
 */
function analyze(word) {
  const w = word.toLowerCase().trim();
  if (!w) return { prefix: '', root: '', suffix: '', meaning: '' };

  let prefix = '';
  let prefixMeaning = '';
  let root = '';
  let suffix = '';
  let suffixMeaning = '';

  // 1. 找前缀（最长匹配优先）
  for (const p of PREFIXES) {
    if (w.startsWith(p.prefix) && w.length > p.prefix.length) {
      prefix = p.prefix;
      prefixMeaning = p.meaning;
      break;
    }
  }

  // 2. 找后缀（最长匹配优先）
  for (const s of SUFFIXES) {
    if (w.endsWith(s.suffix) && w.length > s.suffix.length) {
      suffix = s.suffix;
      suffixMeaning = s.meaning;
      break;
    }
  }

  // 3. 提取词根：去掉前缀和后缀后剩余部分
  let middle = w;
  if (prefix) middle = middle.slice(prefix.length);
  if (suffix) middle = middle.slice(0, -suffix.length);

  // 4. 尝试识别词根
  if (middle) {
    const lowerMiddle = middle.toLowerCase();

    // 精确匹配词根词典
    if (ROOTS[lowerMiddle]) {
      root = lowerMiddle;
    } else {
      // 简化：剩余部分至少4个字母，可能是词根
      if (middle.length >= 4) {
        root = middle;
      } else {
        root = '';
      }
    }
  }

  // 组合语义说明
  const parts = [];
  if (prefix) parts.push(`${prefix}=${prefixMeaning}`);
  if (root) parts.push(`${root}=${ROOTS[root]?.meaning || ''}`);
  if (suffix) parts.push(`${suffix}=${suffixMeaning}`);

  return {
    prefix: prefix || '',
    root: root || '',
    suffix: suffix || '',
    prefixMeaning: prefixMeaning,
    rootMeaning: ROOTS[lowerMiddle]?.meaning || '',
    suffixMeaning: suffixMeaning,
    explanation: parts.join(' | ')
  };
}

/**
 * 批量分析多个单词
 * @param {string[]} words
 * @returns {Array<{word: string, analysis: ReturnType<typeof analyze>}>}
 */
function analyzeBatch(words) {
  return words.map(w => ({ word: w, analysis: analyze(w) }));
}

export const morphology = {
  analyze,
  analyzeBatch,
  ROOTS,
  PREFIXES,
  SUFFIXES
};
