# Upgrade Stream 5 — 视觉 & 编辑设计分析 (Visual & Editorial Design)

**作者:** Specialist 5 — Visual & editorial design analyst
**日期:** 2026-06-19
**基线:** commit `0015704`, 59 trailers + 11 motorhomes, 520 tests pass, live `airstream-explorer.pages.dev`
**铁律遵守:** 本文每一条都在 **NO AI-generated imagery (功能/diagram 内容)** + **inline SVG only / `currentColor` / theme token** + **real-photo heroes/gallery (Wikimedia/CC + attribution)** + **premium Fraunces + DM Sans editorial** + **static-site / China-robust** 之内。任何会诱使生成 AI 图的点都单独 **🚩 FLAG** 出来并给 SVG/真照片替代。

---

## 0. 现状勘察 (ground truth — 实测代码, 不臆测)

**已有的可复用视觉原语 (这是本流的最大资产 —— 几乎所有 data-viz 都能复用, 不必新发明):**

| 原语 | 位置 | 形态 | 复用价值 |
|---|---|---|---|
| `.est-bar` track+fill | site.css 690-695 | 水平条, `linear-gradient(90deg, copper, copper-deep)` 填充, 14天封顶 | ⭐ off-grid endurance / tank fill 直接复用 |
| `.cg-bar` fit 条 | site.css 1016-1041 | 4色语义条 (fits绿/tight金/unknown灰/no红) | ⭐ 阈值类对比直接复用 |
| `.payload` breakdown 条 | render.mjs 604-612 | 占 CCC 百分比的预算条 | ⭐ payload budget 已是雏形 |
| 严重度 pip meter `●●○` | maintenance.mjs / site.css 1938 | 3档离散圆点 | ⭐ 离散分级 (off-grid tier) |
| community-signal meter | site.css 1321 | `●●●○` 圆点 | ⭐ 同上 |
| 行内 SVG 线性图标 | maintenance.mjs 200-212, overnight.mjs | `viewBox 0 0 24 24` `stroke=currentColor` `stroke-width=1.6` `fill=none` | ⭐ 全站统一的 SVG 规范, 直接照抄 |

**结论:** 站点已有一套成熟的「currentColor 线性图标 + copper 渐变条 + 离散 pip」视觉语言。新 data-viz **应该长在这套语言上**, 而不是引入图表库 (Chart.js/D3 全部违反 China-robust + "too SaaS" 铁律)。这是本流所有提案的根基。

**设计 token (verbatim `:root`):** `--bg #F4EFE6` / `--surface #FBF8F2` / `--ink #1F1B16` / `--muted #6B6258` / `--line #E0D7C8` / `--copper #B05C32` / `--copper-deep #8A4524` / `--radius 2px` / `--maxw 1120px`。类型: Fraunces 500/600/700 (无 italic 字面!) + DM Sans 400/500/700。

**可被可视化的真实数据 (实测 range, 全字段非空除注明):**
- `lengthFt` 16.17–33.25 · `weightLb` 2700–8425 · `gvwrLb` 3500–10000
- `cccLb` 350–2275 · `hitchWeightLb` 450–1150
- `freshGal` 19–53 · `grayGal` 24–40 (**6 个 null** — Bambi/Basecamp 合并废水箱) · `blackGal` 12–39
- `sleeps` 2–8 · `msrp` 55900–222900 · `solarW` 100–600 · `batteryKwh` 2.5–18.5 · `offGridScore` 39–93

**关键缺口 (实测):**
1. **详情页 spec table 是纯 `<dl>` 文字** (render.mjs 757-770) —— 没有任何可视化。Length/weight/tank/off-grid 全是裸数字, 读者无法"一眼对比这台在全系里偏大还是偏小"。**最大的 data-viz 真空。**
2. **Compare page 是纯文字表格** (render.mjs 977+) —— 三台并排只有数字, 没有任何视觉对比 (条/点/范围标尺)。
3. **真照片覆盖:** heroes 16 · gallery 210 · floorplans 59 · community 36 (全部 Wikimedia/CC, 有 `artist`/`license`/`licenseUrl`/`source` 完整 attribution schema)。decor 142 · upgrades 34 · thumbs 70。
4. 🚩 **详情页 hero 仍是 AI 图** (实测截图 `detail-page.png`: Classic 33FB 的红霞海岸图是典型 AI 合成 —— 拉丝铝车身反射与背景光不符、植被过度完美)。这与 brief「all imagery is now real photos」**矛盾**, 也与 stale disclaimer 互相印证。见 §C-FLAG-1。

---

## A. DATA-VIZ 机会 (inline SVG / CSS, no-AI)

按「价值 × 可行性」排序。每条标: **是什么 / 价值 / 工作量 S·M·L / 数据依赖 / 铁律契合 / 第一步**。

### A1. 详情页 spec table → 「全系分位标尺」(percentile rail) ⭐⭐⭐⭐⭐ 最高价值

- **是什么:** 详情页 `<dl class="specs-grid">` 的每个数值型 spec (length / dry weight / GVWR / CCC / fresh / off-grid score / battery / solar) 旁边加一条**极细的水平标尺**, 标出本车在全系 min–max 区间里的位置 (一个 copper 圆点/竖线 + 浅色轨道)。例如 Classic 33FB 的 length 点落在最右端 → 一眼"这是最大的之一"。
- **价值:** 把孤立数字变成**有语境的数字** —— 这正是 premium 参考站和"网上随便一个 spec 表"的分界线。零额外文字, 纯视觉传达 relative position。是详情页从"准确"升到"有洞察"的单条最高 ROI 动作。
- **工作量:** **M** (一个 `specRailRow()` helper, build 时算各字段全系 min/max 一次, 渲染 `style="--pct:NN%"`; 复用 `.est-bar-track` 的轨道样式)。
- **数据依赖:** 零新数据 —— 全部来自 trailers.json 现有字段 + build 时计算的全系 min/max。
- **铁律契合:** ✓ 纯 CSS + inline marker, currentColor/copper token, 同源, 无 AI。
- **第一步:** 在 render.mjs 写 `const SPEC_RANGES = computeRanges(trailers)` (length/weight/gvwr/ccc/fresh/black/offGrid/battery/solar 的 min/max); 给 `specRow()` 加可选 `rail` 参数, 输出 `<span class="spec-rail"><span class="spec-rail-dot" style="left:${pct}%"></span></span>`。
- **可访问性:** rail `aria-hidden`, 同时在文字里保留"(在 16–33 ft 区间)"或 `aria-label`; 颜色不单独承载意义。
- **⚠️ 诚实边界:** trailer 与 motorhome 分别算 range (混在一起标尺无意义); tank 为 null (合并废水箱) 的车型 rail 隐藏不画。

### A2. Per-model 三箱「tank-fill」可视化 (fresh / gray / black) ⭐⭐⭐⭐

- **是什么:** 详情页 spec 区把 "Fresh / gray / black 53 / 34 / 39" 这行升级成**三个等比水罐 SVG**, 高度按 gal 比例填充 (copper 实色), 顶部标 gal 数。合并废水箱车型 (grayGal null) 画**两箱 + 一个"Combo"合并标记** (诚实反映 specNote)。
- **价值:** tank 容量是 boondocking 决策核心, 但 "53/34/39" 三个数字读者要心算比例。三箱图把"淡水比废水大很多 / 这台废水合并"变成一眼可见。强化站点的 off-grid 专业定位。
- **工作量:** **S–M** (一个 SVG 模板, 3 个 `<rect>` 按 `freshGal/maxTank` 算高度; null 处理分支)。
- **数据依赖:** freshGal / grayGal / blackGal + specNote (已全有)。
- **铁律契合:** ✓ inline SVG, currentColor, 无 AI。**🚩 替代提醒:** 绝不用 AI 渲染"水箱照片"——SVG 矢量是唯一正解。
- **第一步:** 复用 maintenance.mjs 的 SVG 包装规范, 写 `tankDiagram(t)`; 先在一个 detail page 验证 null/Combo 分支 (Bambi 16RB blackGal=30 合并)。

### A3. Off-grid endurance「持久力点阵」(详情页静态版) ⭐⭐⭐⭐

- **是什么:** 详情页现在的 off-grid estimator 是**交互工具 (需 JS, 用户点选才出)**。新增一个**静态、首屏即见**的小可视化: 用 `offGridScore` (39–93) 驱动一个 5 档 pip meter (`●●●○○`) + 一句"在全系第 N 百分位"。复用现有 community-signal pip 样式。
- **价值:** off-grid 是站点差异化卖点, 但 score 现在只是 spec 表末尾一行 "65 / 100" 裸数字。pip 让它成为详情页**视觉锚点之一**, 且不依赖 JS (首屏/爬虫/JS 关闭都可见)。
- **工作量:** **S** (复用 pip CSS, score→pip 档位映射函数)。
- **数据依赖:** offGridScore (已有, 0 null)。
- **铁律契合:** ✓ 纯 CSS 圆点, 离散分级避免"假精确"。
- **第一步:** `offGridPips(score)` → 5 档 (≤45/≤60/≤72/≤84/>84); 放在 spec 区或 hero 下的 "at a glance" 条。

### A4. Compare page「对比叠加条」(side-by-side rail overlay) ⭐⭐⭐⭐

- **是什么:** Compare page 现在三台并排是纯数字表。给每个数值行加一条**共享标尺**: 三台的点/条画在同一条全系轨道上, 用三种深浅 copper 区分 (非彩虹色, 守 brand)。一眼看出"A 比 B 重 1500 lb、off-grid 高一档"。
- **价值:** Compare 的全部价值就是"看差异", 而纯数字最不擅长表达差异量级。叠加条是 compare 类页面公认的最高价值升级, 且这里有现成 rail 原语 (A1 的复用)。
- **工作量:** **M** (客户端 JS 已构建表格, 加一列 mini-rail; 与 A1 共享 range 计算 —— 但 compare 是 client-side 渲染, range 需注入 JSON island 或客户端算)。
- **数据依赖:** compact JSON 已含所有字段 (render.mjs 982-1006); 只需附带全系 min/max。
- **铁律契合:** ✓ CSS/inline, 同源。
- **第一步:** 在 `renderCompare` 的 JSON island 里加 `_ranges` 对象; 客户端建表时每数值 cell 追加 `.cmp-rail`。

### A5. Explore hub「散点定位图」length × weight (或 msrp × offGrid) ⭐⭐⭐

- **是什么:** Explore/Compare 顶部一个**纯 SVG 散点图**: x=lengthFt, y=weightLb, 每点一台, 点击跳详情。可切轴 (msrp×offGridScore)。点用 copper, hover 显名。
- **价值:** 给"全系 59 个怎么分布"一个鸟瞰 —— 大而轻 vs 小而重一目了然, 是 enthusiast 参考站很"懂行"的一笔。也填补 Explore hub 纯卡片网格缺少"全局视角"的空白。
- **工作量:** **M–L** (SVG 坐标映射 + 轴 + 可访问 fallback 表; hover/点击交互)。
- **数据依赖:** 全字段已有。
- **铁律契合:** ✓ 手写 SVG, 无库, currentColor。**注意** 可访问性: 散点对读屏不友好 → 必须配一个 visually-hidden 数据表或 `<title>` per point。
- **第一步:** 先做静态不可交互版 (build 时生成 SVG), 验证视觉密度 (59 点会不会糊); 再加交互。**风险:** 59 点可能偏挤, 需测试。

### A6. Solar-harvest-by-region 月度曲线 (SVG sparkline) ⭐⭐⭐

- **是什么:** solar-harvest.mjs 已有 NREL 纬度×月份 GHI 真实数据 + 车型 solarW。把"这台 300W 在不同纬度的月度发电量"画成一条**SVG 折线/面积 sparkline** (12 月), 或一个纬度带的小型 heat-strip。
- **价值:** 把已有的严谨太阳能模型**可视化**出来 —— 现在它只服务于交互估算器, 数据资产被低估。一条"夏 5.5h 冬 2.5h"的曲线极具说服力, 强化"我们真的算过"的可信度。
- **工作量:** **M** (数据已建模, 主要是 SVG path 生成)。
- **数据依赖:** solar-harvest.mjs LAT_BANDS (已有, NREL 来源) + solarW。
- **铁律契合:** ✓ SVG, 真实 NREL 数据 (符合"每个事实需来源 URL"), 无 AI。
- **第一步:** `solarSparkline(solarW, lat)` 返回 12 点 polyline; 先嵌在 off-grid estimator 结果区作为"年度采光"补充。

### A7. Weight/payload「预算环」(CCC budget) ⭐⭐⭐

- **是什么:** payload 计算器已有 breakdown 条 (render.mjs 604-612)。新增详情页**静态**版: 一个 CCC 预算的水平堆叠条 —— dry→GVWR 的余量里, 水/丙烷/标准化"人+装备"各占多少, 剩余可用。
- **价值:** "1,575 lb CCC"对新手无概念。堆叠条显示"装满水就用掉 X、剩 Y 给行李"——把抽象载重变成直觉。安全相关 (超 CCC = 超 GVWR), 教育价值高。
- **工作量:** **S** (条原语已存在, 静态化即可)。
- **数据依赖:** cccLb / freshGal (已有)。
- **铁律契合:** ✓ CSS 条, 无 AI。
- **第一步:** 复用 `barPct`/`.est-bar`, 静态算 water=freshGal×8.34、propane=40、剩余。

---

## B. 交互视觉元素 (premium, accessible, touch-safe)

### B1. 跨文档 View Transitions (MPA 原生) ⭐⭐⭐⭐ — round2 已点名未做

- **是什么:** `@view-transition { navigation: auto }` + 卡片→详情页 hero 共享 `view-transition-name`。卡片点进详情, hero 图平滑放大过渡。
- **价值:** "biggest wow-per-line" (round2 thread-4 评)。59 详情页 ↔ hub 间导航瞬间有电影感, 是 premium 感最廉价的一笔。
- **工作量:** **S** · **数据依赖:** 无 · **铁律:** ✓ 原生 CSS, 零库, 渐进增强 (不支持的浏览器正常跳转), 必须配 `prefers-reduced-motion` 收口。
- **第一步:** page() head 加 meta + CSS; 给 hero `view-transition-name: hero-${slug}` (注意名字唯一)。

### B2. Spec-rail hover「展开到全系上下文」⭐⭐⭐

- **是什么:** A1 的分位标尺, hover/focus 时展开一个小 tooltip: "最轻 2,700 / 本车 8,425 / 最重 8,425 lb · 全系前 5%"。touch 上用 tap 切换 (非 hover-only)。
- **价值:** 渐进披露 —— 静态时是干净的点, 想深究时给精确语境。premium 参考站的细节感。
- **工作量:** **M** · **铁律:** ✓ ; touch-safe (复用 floorplan-zones 的 touch hotspot 模式, 已验证移动端可用)。
- **第一步:** 复用 floorplan-zones.mjs 的 tap-toggle 逻辑作为 tooltip 触发。

### B3. Tank-diagram / off-grid pip 的 reduced-motion 安全网 ⭐⭐⭐

- **是什么:** 任何新增的填充/淡入动画 (tank 水位上升、rail 点滑入) 统一包 `@media (prefers-reduced-motion: reduce)` 关闭。round2 G4 已指出卡片 hover transform 未收口 —— 新元素不要重蹈。
- **价值:** 可访问性底线 + 防晕动。**工作量 S** · **铁律:** ✓。
- **第一步:** 加全局安全网 `@media (prefers-reduced-motion: reduce){ *{animation-duration:.01ms!important; transition-duration:.01ms!important} }`。

---

## C. 摄影策略 (real-photo, Wikimedia/CC + attribution)

### 现状盘点 (实测)
- **覆盖:** heroes 16 · gallery 210 · floorplans 59 (官方图) · community 36 (Wikimedia/CC, attribution schema 完整: `artist`/`license`/`licenseUrl`/`source`/`sourceUrl`)。
- **attribution 基建已成熟** —— community-photos.json 是模范 schema, 任何新真照片应套同一结构。

### 🚩 C-FLAG-1: 详情页 hero 仍是 AI 合成图 (最高优先) ⭐⭐⭐⭐⭐
- **问题:** 实测 `detail-page.png` (Classic 33FB) hero 是 AI 图 (光照/反射/植被破绽), 且 stale disclaimer (render.mjs:92, README:51, motorhome-render.mjs:64) 仍写 "Some imagery is AI-generated" —— **三处自我拆台**, 与 brief「all real photos」矛盾。对"信任优先 / 反 AI 感"的目标用户是致命伤。
- **诱惑陷阱:** "再生成一张更好的 AI hero" —— **拒绝**。这正是铁律 #3 禁止的。
- **正解 (real-photo 替代):**
  1. **(S, 立刻)** 删/改三处 stale disclaimer, 改成诚实口径 ("Heroes & galleries are real photographs under Creative Commons; diagrams are hand-coded SVG")。
  2. **(M)** 逐车型/家族用 Wikimedia Commons + Flickr CC 真照片替换 AI hero。**注意:** 不是每个 floorplan 都有真照片 → 缺图时 fallback 到**家族级真 hero** 或 **编辑级 SVG/渐变占位** (复用车卡 radial-gradient 奶油底), 而非 AI 补图。
  3. **(S)** 凡真照片必带 attribution (沿用 community schema), 详情页 hero 角落加 `figcaption` 微型署名。
- **第一步:** 审计哪些 hero 是 AI vs 真照片 (grep heroes/ + 比对 community schema 有无覆盖); 列出真照片可替换清单。

### C2. 真照片缺口 → 编辑长文配图 (见 §D) 的图源策略 ⭐⭐⭐
- **是什么:** 编辑长文 (model-line history 等) 需要历史/场景照片。Wikimedia Commons 有大量 Airstream 历史 CC 图 (Wally Byam 时代、复古巡游)。
- **价值:** 真历史照片是长文可信度与"杂志感"的来源, 且完全合规。
- **工作量:** **M** (策展 + 转码 + attribution 录入) · **铁律:** ✓ CC + 署名。
- **第一步:** 用现有 image 管线 (scripts/transcode-images.mjs) + community schema 扩一个 `editorial-photos.json`。
- **🚩 替代提醒:** 长文绝不能用 AI"复古照片"填充历史空白 —— 宁可少图、用真档案图或 SVG 时间线 (见 D2)。

### C3. décor swatch 过尺寸重转码 (round2 G2, 性能+真实性) ⭐⭐⭐
- 142 张 600² swatch 渲染成 84px = 11MB 浪费。重转码 200px 立省 ~9.5MB。**纯性能/真实图操作, 不碰 AI。** 工作量 S, 已有 round2 详述, 本流仅确认它仍未做、应做。

---

## D. 编辑长文机会 (premium enthusiast 参考)

站点目前**完全没有长文/essay/history** (实测 grep 全空)。这是与"premium enthusiast 参考站"(如 Hagerty、Hemmings 风格) 的最大编辑差距。以下都在静态站 + 真照片/SVG 约束内。

### D1. 「买家指南」essays (buyer's-guide) ⭐⭐⭐⭐
- **是什么:** 4–6 篇主题长文, 复用真数据: "如何选 off-grid Airstream"(挂 offGridScore/solar/battery data-viz)、"重量与拖车安全入门"(挂 GVWR/CCC viz + tow 工具)、"小 vs 大: 16ft 到 33ft 怎么权衡"。
- **价值:** 把分散的工具/数据缝成**有观点的叙事** —— 这是参考站从"数据库"升到"权威"的关键。SEO 长尾 + 停留时长 + premium 编辑感三赢。
- **工作量:** **L** (内容创作为主) · **数据依赖:** 全系数据 (已有, 可内嵌 A1–A7 的 viz) · **铁律:** ✓ (无 commerce, 真数据, 真照片/SVG 配图)。
- **第一步:** 先写 1 篇 off-grid 指南 MVP, 嵌入 A3/A6 viz, 验证版式 (Fraunces 大标题 + DM Sans 正文 + drop-cap?)。

### D2. Model-line 历史 (家族小史) + SVG 时间线 ⭐⭐⭐⭐
- **是什么:** 每个家族 (Bambi/Classic/Flying Cloud…) 一段编辑小史 + 一条**SVG 横向时间线** (年份节点, currentColor)。
- **价值:** enthusiast 最爱 lineage 叙事; 时间线是 no-AI 的完美 data-viz (纯 SVG)。家族页现在只是 floorplan 网格, 加历史立刻有"杂志专题"感。
- **工作量:** **M** (内容 + 一个 timeline SVG 模板) · **数据依赖:** 需新增家族史 facts (每条挂来源 URL, 守准确铁律) · **铁律:** ✓。
- **🚩 替代提醒:** 历史配图用 Wikimedia 档案照 (C2) 或纯 SVG 时间线, **不用 AI 复古图**。
- **第一步:** 选 Classic (历史最厚) 试点, SVG 时间线 + 3 张真档案照。

### D3. How-to 叙事 (升级/保养 narrative) ⭐⭐⭐
- **是什么:** 把现有 upgrades.json / maintenance.json 的工具型内容, 补一层"为什么/怎么做"的编辑叙事 (e.g. "第一次 boondock 前该做的 5 件事"), 嵌入现有 SVG diagram。
- **价值:** 工具页现在偏"表格", 叙事让它更"读得下去"。复用 panel-visual.md 已设计的 consensus pip + source chips。
- **工作量:** **M** · **铁律:** ✓ (panel-visual.md 已铺好视觉语言)。
- **第一步:** 与 panel-visual.md 的 upgrades 改版合并推进 (consensus pip + "Cited from the community" chips 已设计好)。

---

## E. Premium-feel 细节打磨 (concrete, 非泛泛)

按 round2 已点名但**未上线**的实测清单 (都不碰铁律, 全原生/同源):

### E1. 统一 fluid type/space scale token ⭐⭐⭐⭐
- **实测问题:** `clamp()` 散落各处 (hero-head/explore-head/cg-hero 各写各的)。抽成 `--step-0..6` + `--space-*` 一套。
- **价值:** 消除"模板感"最隐蔽的来源 —— 节奏不一致。premium 站的根基是**一致的垂直律动**。
- **工作量:** M · **第一步:** 审计所有 font-size/clamp, 归并到 token, 逐页替换。

### E2. `text-wrap: balance` (标题) + `pretty` (lede) ⭐⭐⭐
- 一行 CSS 防孤儿字, 立刻"排过版"。`content-visibility: auto` 给折叠下方长 section 降首屏成本。**工作量 S。**

### E3. 字体 preload 关键 woff2 (Fraunces 600 + DM Sans 400) ⭐⭐⭐
- round2 G7: 现无 preload → 首屏 FOUT (system-ui 闪到 Fraunces)。premium 编辑站首屏字体闪烁最伤质感。**工作量 S, 同源纯正向。**

### E4. 卡片 `:focus-visible` 统一焦点态 ⭐⭐⭐
- round2 G4: 大点击块 (.card/.fam/.xcard/.cg-card) 无显式 focus-visible, 键盘用户在奶油底圆角上看不清。加 copper ring。**工作量 S, 可访问性 + 细节craft。**

### E5. eyebrow 小号文字对比度 (copper→copper-deep) ⭐⭐⭐
- round2 G4: `--copper #B05C32` 做 <18px 文字 = 4.15:1 **未过 AA**。小号 eyebrow/label 改 `--copper-deep` (6.20:1), 视觉几乎无差。**工作量 S, 合规 + 严谨感。**

### E6. LQIP blur-up (hero/gallery 真照片) ⭐⭐⭐
- round2 G2: 加载中纯灰闪一下, 无低清模糊占位的高级感。build 时为 hero/gallery 生成 ~20px webp base64 内联 `background-image`, onload 淡出。**工作量 M, 纯 CSS+1行JS, 防 GFW, 是 premium 质感层。**
- 🚩 注意: LQIP 是真照片的低清版, 非 AI 生成 —— 合规。

### E7. scroll-reveal 微淡入 ⭐⭐
- IntersectionObserver 一次性淡入 (family grid/xgrid/营地卡), reduced-motion 下禁用。subtle, 非 SaaS 浮夸。**工作量 S–M。**

---

## F. 🚩 会诱使 AI 图的点 (全部给替代方案)

| 诱惑 | 为何危险 | 正解 (no-AI) |
|---|---|---|
| 详情页 hero "再生成更美的 AI 图" | 违反铁律 #3, 且现有 AI hero 已是信任伤口 (C-FLAG-1) | Wikimedia/Flickr CC 真照片 + 缺图 fallback 到家族 hero 或编辑级渐变占位 |
| tank/水箱"渲染照片" | 功能性 diagram 必须 SVG | A2 矢量三箱 SVG (currentColor) |
| 历史长文"复古风照片"填空 | AI 假档案 = 严重可信度欺骗 | Wikimedia 真档案照 (C2) 或 D2 的 SVG 时间线 |
| 散点/图表"美化背景插画" | 引入 AI 装饰 | 纯 SVG 几何 + copper token, 留白即设计 |
| décor "更高清 swatch" | 应是真材质照, 非 AI | 真 swatch 照重转码 200px (C3/round2 G2) |
| 家族页"氛围图 banner" | AI 氛围图最易显假 | 真照片 hero 或 §A1 数据标尺作视觉锚 |

---

## G. 优先级建议 (本流自评 — 供 lead 排期)

**第一梯队 (高价值 × 低中工作量, 立刻可做):**
1. **C-FLAG-1** 删 stale AI disclaimer + 审计/替换 AI hero (信任底线, S 起步)
2. **A1** 详情页 spec 分位标尺 (data-viz 单条最高 ROI, M)
3. **A2** tank-fill 三箱 SVG (off-grid 卖点可视化, S–M)
4. **A3** off-grid pip (静态、首屏, S)
5. **E1/E2/E3/E4/E5** premium 打磨包 (多数 S, 一次性消除模板感)

**第二梯队 (高价值 × 较大工作量):**
6. **A4** compare 叠加条 (M)
7. **D1/D2** 买家指南 + 家族史长文 (L, 编辑差距最大但内容成本高)
8. **B1** View Transitions (S, wow-per-line 最高, 可插队进第一梯队)

**第三梯队 (锦上添花/有风险):**
9. **A5** 散点图 (M–L, 59 点密度需验证)
10. **A6/A7** solar sparkline / payload 环 (M/S, 数据资产复用)
11. **E6/E7** LQIP / scroll-reveal (质感层)

**共识 (跨流): A1 的 spec range 计算 helper 被 A1/A2/A4/B2 共享 —— 应作为第一个落地的基础设施。**
