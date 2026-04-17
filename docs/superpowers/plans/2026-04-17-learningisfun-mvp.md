# LearningIsFun — Implementation Plan v1.0

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MVP vocabulary learning web app for a 10-year-old kid. Features: PDF upload → auto word extraction → spaced repetition learning with Leitner 5-box system → gamified island building → TTS pronunciation.

**Architecture:** Single-page HTML/CSS/JS app, zero backend, zero deployment server. All data persisted in browser LocalStorage. External APIs used for dictionary lookups (Free Dictionary API) and TTS (Web Speech API). PDF text extracted client-side via pdf.js CDN.

**Tech Stack:** HTML5 + CSS3 + Vanilla JS, pdf.js (CDN), LocalStorage, Web Speech API (browser-native TTS), Free Dictionary API (https://api.dictionaryapi.dev), Tatoeba API

---

## 技术决策说明（3个遗留问题）

| 问题 | 决策 | 理由 |
|-----|------|------|
| 中文释义来源 | Free Dictionary API + 内置常见词库（约500词） | 免费API无key无速率限制；常见词内置响应快 |
| 测试题型 | 混合：选择题（4选1）+ 填空（输入框）各50% | 10岁孩子需要多样性，避免疲劳 |
| 设备适配 | Mobile-first 响应式 | 孩子最可能用平板/手机 |

---

## 文件结构

```
learningisfun/
├── index.html              # 单页应用入口
├── styles.css              # 全局样式 + CSS变量
├── README.md               # 项目说明
├── SPEC.md                 # 产品规格文档
├── .gitignore
│
└── js/
    ├── app.js              # 主程序：路由、状态管理
    ├── vocabulary-store.js  # 词库管理（导入/导出/LocalStorage）
    ├── pdf-extractor.js    # PDF文字提取（pdf.js封装）
    ├── dictionary-api.js   # 词典API（Free Dictionary + 内置中文）
    ├── morphology.js       # 词根拆解（内置~100词根词典）
    ├── sentence-gen.js     # 例句生成（Tatoeba API + 模板fallback）
    ├── spaced-rep.js        # 间隔重复算法（Leitner 5盒 + 简化SM-2）
    ├── tts.js              # TTS语音朗读（Web Speech API）
    └── island.js           # 岛屿渲染（建材收集 + 可视化）
```

---

## Task 1: 项目初始化

**Goal:** 创建项目骨架文件 + README + SPEC.md + .gitignore，提交到 GitHub

**Files:**
- Create: `README.md`
- Create: `SPEC.md`
- Create: `.gitignore`
- Create: `js/` 目录 + 空占位文件
- Create: `index.html`（最小HTML骨架）
- Create: `styles.css`（CSS变量定义）

**参考：**
- `word-learning-proposal-v1.md` 包含完整产品需求
- 模板文件内容见计划正文

---

- [ ] **Step 1: 创建 README.md**

包含：项目一句话介绍、功能列表、技术栈、MIT协议

- [ ] **Step 2: 创建 SPEC.md**

包含：愿景、目标用户、功能列表（P0/P1/P2优先级）、交互规格（刷词流程图）、算法规格（Leitner 5盒）、API列表、MVP范围定义

- [ ] **Step 3: 创建 .gitignore**

内容：`node_modules/`、`*.log`、`.DS_Store`

- [ ] **Step 4: 创建 js/ 占位文件**

创建9个空模块文件：
- `js/app.js`
- `js/vocabulary-store.js`
- `js/pdf-extractor.js`
- `js/dictionary-api.js`
- `js/morphology.js`
- `js/sentence-gen.js`
- `js/spaced-rep.js`
- `js/tts.js`
- `js/island.js`

- [ ] **Step 5: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LearningIsFun 🏝️</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app"></div>

  <!-- PDF.js CDN -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script>pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';</script>

  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 6: 创建 styles.css（含CSS变量）**

定义：背景色 `--color-bg: #1a1a2e`、主色 `--color-accent: #e94560`、5个盒子颜色（红/黄/绿/蓝/紫）、字体、圆角、阴影、移动端最大宽度480px

- [ ] **Step 7: Git commit**

```bash
git add .
git commit -m "chore: project init — README, SPEC, HTML/CSS skeleton"
git branch -M main
git remote add origin https://github.com/JackGameStudio/learningisfun.git
git push -u origin main
```

---

## Task 2: 词库数据模型 + LocalStorage

**Goal:** 实现核心数据结构（Word对象、词库集合）和 LocalStorage 持久化，提供清晰接口供其他模块调用。

**Files:**
- Create: `js/vocabulary-store.js`
- Modify: `js/app.js`（导入store，初始化）

**关键数据结构（Word对象）**：
```javascript
{
  word: 'export',           // 单词（必填）
  meaning: '出口',          // 中文释义
  phonetic: '/ɪkˈspɔːt/',   // 音标
  example: 'China exports tea.', // 例句
  prefix: 'ex-',            // 前缀
  root: 'port',             // 词根
  suffix: '',               // 后缀
  box: 1,                   // Leitner盒子（1-5）
  ef: 2.5,                  // 难度因子
  n: 0,                     // 连续正确次数
  interval: 1,              // 当前间隔（天）
  nextReview: '2026-04-17', // 下次复习日期
  lastReview: '',           // 上次复习日期
  timesReviewed: 0,         // 总复习次数
  timesCorrect: 0,          // 正确次数
  createdAt: '2026-04-17',  // 添加日期
  source: '七年级上册.pdf'   // 来源
}
```

---

- [ ] **Step 1: 写 vocabulary-store.js**

实现 `VocabularyStore` 类：
- `importWords(wordList, source)` — 导入单词（去重+合并）
- `getAll()` — 获取所有词
- `getDueWords()` — 获取今日待复习词
- `getNewWords(limit)` — 获取待学新词
- `updateWord(word, updates)` — 更新单词
- `deleteWord(word)` — 删除单词
- `getStats()` — 统计数据（总词数/掌握数/待复习数/正确率）
- `exportJSON()` — 导出备份
- `importJSON(str)` — 导入备份

**持久化**：读取/写入 `localStorage.getItem/setItem('lif_vocabulary')`

- [ ] **Step 2: 导出单例store**

```javascript
export const store = new VocabularyStore();
```

- [ ] **Step 3: Git commit**

```bash
git add js/vocabulary-store.js
git commit -m "feat: vocabulary data model + LocalStorage persistence"
git push
```

---

## Task 3: PDF 文字提取

**Goal:** PDF上传 → 提取文字 → 过滤（去停用词、去数字、去标点）→ 输出纯英文单词列表。

**Files:**
- Create: `js/pdf-extractor.js`
- Modify: `js/app.js`（添加导入界面）

**过滤规则**：
- STOP_WORDS：the, a, an, is, are, was, be, have, has, do, does, did, will, would, can, could...（约60个）
- 长度：3-20个字母
- 格式：纯字母（去除含数字/连字符/标点的词）

---

- [ ] **Step 1: 写 pdf-extractor.js**

实现 `PDFExtractor` 类：
- `extractWords(File)` — 返回 Promise<string[]>，已去重排序
- 内部使用 `pdfjsLib.getDocument()` 逐页提取
- 内部 `_parseWords(text)` 执行过滤逻辑

- [ ] **Step 2: 在 app.js 添加导入界面**

`showImportView()` 函数：
- 文件上传 input（accept=".pdf"）
- "提取单词"按钮（提取中显示loading）
- 预览区（显示前20个词 + 总数）
- "导入词库"按钮（调 store.importWords）
- 导入成功后跳转到首页

- [ ] **Step 3: Git commit**

```bash
git add js/pdf-extractor.js js/app.js
git commit -m "feat: PDF upload + text extraction with word filtering"
git push
```

---

## Task 4: 词典API + 中文释义

**Goal:** 为已提取的单词自动查词典（中文释义 + 音标），内嵌约500常见词作为缓存/Fallback，减少API调用。

**Files:**
- Create: `js/dictionary-api.js`（含内置词库 + API调用）
- Modify: `js/app.js`（导入流程中调用查词典）

**API**: `GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}`
**返回**: `{ word, phonetic, meanings: [{ partOfSpeech, definitions: [{ definition, example }] }] }`

**Fallback策略**：
1. 先查内置词库（O(1)，无网络）
2. 内置没有 → 调 Free Dictionary API
3. API失败 → 显示"释义待补充"

**批量处理**：每批5个词，间隔500ms（防速率限制）

---

- [ ] **Step 1: 写 dictionary-api.js**

实现 `DictionaryAPI` 类：
- `lookup(word)` — 查单个词（内置→API）
- `lookupBatch(words[])` — 批量查（500ms间隔，自动补全meaning字段）
- `BUILTIN_DICT` — 内置约500词中文库（key:小写单词, value:中文释义）

**内置词库内容**：包含小学-初中核心词约500个（export, import, transport, beautiful, important, dangerous, remember, understand...等常见词）

- [ ] **Step 2: 在 app.js 集成词典查询**

修改导入流程：
```
上传PDF → 提取单词 → [查词典] → 预览页 → 导入
```
在"提取单词"和"导入词库"之间加入异步查词典过程，实时显示进度（"查词典 3/47"）

- [ ] **Step 3: Git commit**

```bash
git add js/dictionary-api.js js/app.js
git commit -m "feat: auto dictionary lookup with built-in fallback cache"
git push
```

---

## Task 5: 词根拆解

**Goal:** 为单词自动识别词根/前缀/后缀，内嵌约100个常用词根词典。

**Files:**
- Create: `js/morphology.js`
- Modify: `js/app.js`

**内置词根库**（约100个，key=词根, value={meaning, examples}）：
- `ex-/ec-/ef-` = 出去（export, exit, escape）
- `im-/in-` = 进入（import, invite）
- `re-` = 再次/回（return, review, repeat）
- `un-` = 否定（unhappy, unable）
- `dis-` = 否定（disappear, dislike）
- `-tion/-sion` = 名词后缀（action, attention）
- `-ly` = 副词后缀（quickly, happily）
- `-able/-ible` = 可...的（readable, possible）
- `-er/-or` = ...的人/物（teacher, actor）
- `-ful` = 充满...的（beautiful, careful）
- `-less` = 没有...的（careless, hopeless）
- `port` = 搬运（export, import, transport）
- `mit/miss` = 发送（permit, transmit, miss）
- `tain` = 持有（obtain, contain, maintain）
- `scrib/script` = 写（describe, prescription）
- `voc/vok` = 叫喊（vocabulary, provoke）
- `duc/duct` = 引导（produce, conduct, reduce）
- 等约100个

**识别算法**：
1. 扫描前缀列表（最长匹配优先）
2. 扫描词根列表（最长匹配优先）
3. 扫描后缀列表（最长匹配优先）
4. 剩余部分为原始词根或难拆解词

---

- [ ] **Step 1: 写 morphology.js**

实现 `MorphologyAnalyzer` 类：
- `analyze(word)` → `{ prefix, root, suffix, isAnalyzed: bool }`
- 内部 `MORPHEME_DICT` 包含约100词根定义
- `findMorpheme(word, list, position)` — 在指定位置查找最长匹配词素

- [ ] **Step 2: 在 app.js 集成**

导入流程中，每个单词自动调用 `analyzer.analyze(word)`，补全 prefix/root/suffix 字段

- [ ] **Step 3: Git commit**

```bash
git add js/morphology.js
git commit -m "feat: automatic morpheme decomposition with 100-root dictionary"
git push
```

---

## Task 6: 例句生成

**Goal:** 自动为单词获取真实英文例句，来源：Tatoeba语料库 API，fallback：简单模板句。

**Files:**
- Create: `js/sentence-gen.js`
- Modify: `js/app.js`

**API**: `GET https://tatoeba.org/en/api_v0/search?from=eng&query={word}&sort=random&limit=1`
**备选**：`https://api.dictionaryapi.dev/api/v2/entries/en/{word}` 的 definitions[0].example

**Fallback策略**：
1. Tatoeba API → 2. 词典API的例句 → 3. 简单模板：`"{word} means {meaning}."`

---

- [ ] **Step 1: 写 sentence-gen.js**

实现 `SentenceGenerator` 类：
- `getSentence(word, meaning)` → Promise<string>
- 优先 Tatoeba → 其次词典API → 最后模板
- `getSentenceBatch(words[])` → 批量获取，带进度回调

- [ ] **Step 2: 在 app.js 集成**

导入流程最后阶段，批量获取例句，完成后所有单词数据补全，显示"JACK确认"预览页

- [ ] **Step 3: Git commit**

```bash
git add js/sentence-gen.js
git commit -m "feat: auto sentence generation with Tatoeba + fallback"
git push
```

---

## Task 7: 间隔重复算法 + 刷词流程

**Goal:** 实现 Leitner 5盒子 + 简化SM-2算法，以及完整的刷词流程UI（复习→学习→测试→结算）。

**Files:**
- Create: `js/spaced-rep.js`
- Modify: `js/app.js`（首页 + 刷词流程）

**算法（简化SM-2）**：
```
初始：interval=1, ef=2.5, box=1

🟢 记住（Correct）：
  interval = interval × ef（上限30天）
  ef = min(3.0, ef + 0.1)
  box = min(5, box + 1)
  nextReview = today + interval

🟡 有点忘（Almost）：
  interval 不变
  ef = max(1.3, ef - 0.1)

🔴 不会（Wrong）：
  interval = 1
  ef = max(1.3, ef - 0.2)
  box = 1
  nextReview = today
```

**刷词流程UI**：
1. **首页**：今日待复习数 + 可学新词数 + streak天数
2. **复习卡片**：显示单词 → 点"显示答案" → 翻面（释义+例句+词根） → 3按钮
3. **学习新词**：逐词展示（发音→释义→例句→词根），最后确认
4. **测试**：
   - A题（4选1）：给单词，选中文意思
   - B题（填空）：给中文+词根提示，写单词
   - 随机混合，3-5题
5. **结算**：得分 + 新解锁的建材 + 动画

---

- [ ] **Step 1: 写 spaced-rep.js**

实现 `SpacedRepetition` 类：
- `recordReview(wordKey, rating)` — 记录复习反馈（'correct'|'almost'|'wrong'）
- `getDueWords()` — 获取今日待复习词
- `getStats()` — 统计数据

- [ ] **Step 2: 在 app.js 实现刷词流程**

`showHomeView()` — 首页（进度统计入口）
`showReviewView()` — 复习流程
`showLearnView()` — 学习新词流程
`showTestView()` — 测试流程
`showResultView()` — 结算奖励

- [ ] **Step 3: 完善样式**

刷词卡片样式：翻转动效、按钮颜色、进度条、Minecraft盒子图标

- [ ] **Step 4: Git commit**

```bash
git add js/spaced-rep.js js/app.js styles.css
git commit -m "feat: spaced repetition algorithm + full study flow UI"
git push
```

---

## Task 8: TTS 语音朗读

**Goal:** 实现每个单词的英文发音，使用浏览器原生 Web Speech API，无需外部服务。

**Files:**
- Create: `js/tts.js`
- Modify: `js/app.js`（在学习/复习流程中加入发音按钮）

**实现**：`speechSynthesis.speak(new SpeechSynthesisUtterance(word))`
**设置**：lang='en-US', rate=0.85（稍慢，适合学习）

**注意**：Safari 和 Chrome 的语音质量不同，Chrome 可尝试 en-GB。

---

- [ ] **Step 1: 写 tts.js**

```javascript
export function speak(word, lang = 'en-US') {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = lang;
  utterance.rate = 0.85;
  // 尝试选择女声
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang.startsWith('en') && v.name.includes('Female')) 
                 || voices.find(v => v.lang === lang);
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}
```

- [ ] **Step 2: 在学习/复习界面加入发音按钮**

每个单词卡片都有🔊发音按钮，点击自动朗读。

- [ ] **Step 3: Git commit**

```bash
git add js/tts.js
git commit -m "feat: TTS pronunciation via Web Speech API"
git push
```

---

## Task 9: 岛屿建造（简化版MVP）

**Goal:** 简化版岛屿展示：建材数量累计，解锁里程碑视觉反馈。

**Files:**
- Create: `js/island.js`
- Modify: `js/app.js`（我的岛页面）

**简化版设计**：
- 岛屿是一个CSS绘制的像素风小岛（3-4种建材代表不同阶段）
- 岛屿大小/复杂度随词汇量增长（5/20/50/100词触发升级）
- 里程碑：
  - 10词：解锁"草地"
  - 25词：解锁"树木"
  - 50词：解锁"房屋"
  - 100词：解锁"城堡"

**CSS像素风**：纯CSS + emoji，不需要Canvas（保持简单）

---

- [ ] **Step 1: 写 island.js**

实现 `IslandRenderer` 类：
- `getIslandLevel(wordCount)` → 岛屿等级（1-4）
- `getMaterials(wordCount)` → 已解锁建材列表
- `render()` → 渲染岛屿HTML

- [ ] **Step 2: 在 app.js 添加"我的岛"页面**

`showIslandView()` — 显示岛屿 + 建材数 + 里程碑进度

- [ ] **Step 3: Git commit**

```bash
git add js/island.js js/app.js styles.css
git commit -m "feat: pixel art island display with milestone unlocks"
git push
```

---

## Task 10: 首页 + 导航 + 统计

**Goal:** 完整的主界面，连接所有功能模块，优化移动端体验。

**Files:**
- Modify: `js/app.js`
- Modify: `styles.css`

**首页内容**：
- 顶部：streak天数徽章
- 中部：今日待复习 + 可学新词（两个大按钮）
- 下部：快速入口（我的岛 / 词库管理 / 学习统计）
- 底部：底部导航（首页/刷词/我的岛）

---

- [ ] **Step 1: 完善 app.js 主入口**

`App` 类：
- 初始化 store、analyzer 等模块
- 根据 URL hash（#home / #study / #island / #import）切换视图
- 或使用简单的状态机切换

- [ ] **Step 2: 完善 styles.css**

- 底部固定导航栏（mobile风格）
- 大按钮卡片（刷词/我的岛）
- 进度环/进度条组件
- 动画（卡片翻转、奖励弹出）

- [ ] **Step 3: Git commit**

```bash
git add js/app.js styles.css
git commit -m "feat: main navigation + home screen + responsive layout"
git push
```

---

## 执行顺序总结

| 顺序 | 任务 | 文件数 | 复杂度 |
|-----|------|------|-------|
| 1 | 项目初始化 | 5 | ★ |
| 2 | 词库数据模型 | 1 | ★★ |
| 3 | PDF文字提取 | 2 | ★★ |
| 4 | 词典API+中文释义 | 2 | ★★★ |
| 5 | 词根拆解 | 2 | ★★★ |
| 6 | 例句生成 | 2 | ★★ |
| 7 | 间隔重复+刷词流程 | 2 | ★★★★★ |
| 8 | TTS语音 | 2 | ★ |
| 9 | 岛屿建造 | 2 | ★★★ |
| 10 | 首页+导航+统计 | 2 | ★★ |

**预计总工作量**：约10个Git提交，每次Task完成后提交一次。

**部署方式**：`git push` 后，GitHub Pages 自动构建（Settings → Pages → Source: main branch）。

---

*本计划基于 `word-learning-proposal-v1.md`（产品需求）和 `memory-science-research.md`（记忆科学研究）生成。*
