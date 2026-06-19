# Stream 4 — 技术架构、性能与无障碍审计

**Specialist 4 · Technical architecture, performance & accessibility analyst**
日期：2026-06-19 · 基线 commit 0015704 · 审计对象：实际代码库（已构建 dist/、跑通 520 测试）

---

## 0. 审计方法与实测基线（measured, not guessed）

所有结论尽量用真实测量背书。关键实测数据：

| 指标 | 实测值 | 备注 |
|---|---|---|
| `dist/` 总大小 | **38 MB** | 其中 `assets/img` = 31 MB（567 个 webp） |
| `app.js`（单文件） | **172 KB raw / 47.7 KB gzip** | 出现在 96/97 个 HTML 页面 |
| `site.css` | **126.5 KB raw / 25.0 KB gzip** | 主样式表 |
| 其余 CSS（fonts/controls/premium） | 0.8 + 2.5 + 3.5 KB gzip | 都很小 |
| MapLibre GL JS（vendor） | **939 KB raw / 248.6 KB gzip** | 全站最重单一资源；已 lazy-load |
| MapLibre CSS | 69 KB | |
| `campgrounds.json` | **1.00 MB raw**（~905 KB payload） | 已外置 + fingerprint + 异步 fetch |
| 自托管字体 | 208 KB（5 个 woff2） | Fraunces + DM Sans |
| 首页 `index.html` | 104 KB raw / 9.1 KB gzip | |
| 典型 detail 页 `m/*.html` | 47 KB raw / 11.6 KB gzip | |
| 测试 | **520 pass / 0 fail**（实跑，49s） | grep 计 586 个 `test(` 调用，部分在循环里 |
| `<img>` 总数 | 1894，**100% 带 width/height**，1763 带 `loading="lazy"` | CLS 防护良好 |

**整体评价：** 这是一个工程质量明显高于平均水平的静态站。零依赖、自托管一切（字体/地图/瓦片）、内容指纹缓存、构建期 image guardrail、图片全部带尺寸、地图懒加载且 list 永不被 map 阻塞——很多"性能升级"在别的项目里要做的事，这里**已经做完了**。因此本报告刻意区分「真正还开着的缺口」与「已 ship 不要重做的」，把精力放在前者。

---

## 1. 代码健康（Code health）

### 1.1 app.js 体积与拆分 —— 现状比"172KB 单文件"听上去健康得多

`app.js` = 3411 LOC / 172 KB raw / **47.7 KB gzip**，通过 `<script defer>` 出现在 96 个页面。架构是一个 IIFE 内多个**自守卫模块**（每个模块开头 `if (!root) return;`，靠页面上特定 DOM 元素是否存在来决定是否运行）。注释里明确写："Independent modules guarded by the elements they need, so one script serves every page."

**判断：现在还不该急着 code-split。理由有实测支撑：**
- gzip 后只有 47.7 KB，且带 `immutable, max-age=1yr` + content-hash 指纹——**全站只下载一次，之后所有 96 个页面都是缓存命中**。把它拆成 per-page bundle 会牺牲这个"一次下载、全站复用"的最大优势，反而对多页浏览的用户更慢。
- 真正的重资源是 MapLibre（248 KB gzip），而它**已经**按需懒加载，不在 app.js 里。
- 零依赖、零打包器（no bundler）是项目的硬约束之一；引入 Rollup/esbuild 做 tree-shaking + 多 entry 会破坏"Node built-ins only / zero-dep"的构建哲学。

**仍值得做的轻量优化（按价值排序）：**

**(a) 把"纯地图模块"从 app.js 拆出，仅在有地图的页面加载。** — 价值中、effort M
app.js 里两大地图模块（campsites hub map ~L959–1250，campground finder map ~L1688–3260）合计占文件相当大比例，但只有 2 个页面（`campsites.html`、`campgrounds.html`）用到。其余 94 个页面下载了它们却永不执行（虽然 gzip 后省不了多少 KB，但解析/编译 JS 仍有成本，尤其低端手机）。
- **做法（零依赖友好）：** 在 build.mjs 里把地图相关模块抽到 `app-map.js`，detail/index 等页面只引 `app.js`，两个地图页额外引 `app-map.js`。两文件都走现有 fingerprint 流程。
- **约束风险：** 低。不引新依赖，纯文件切分 + build 改造。
- **第一步：** 在 app.js 里用现有的 section 注释边界（`// 4./5./6.` 等）划出"core vs map"两组，测一下各自 gzip 大小确认收益是否值得（建议先量化：如果地图模块 gzip < 15 KB，可能不值得拆）。

**(b) 不该做：引入打包器做 ES module 拆分。** 违反 zero-dep 构建约束，收益（已被缓存抵消）不抵复杂度。明确**否决**。

### 1.2 lib 模块边界 —— 健康

`src/lib/` 27 个 .mjs / 7015 LOC，边界清晰（按领域切：tow / fuel / payload / estimate / campsite-fit / campgrounds / render / seo …），纯函数为主、无 DOM/IO，单测覆盖好。`render.mjs` 1051 LOC 偏大但属于"模板渲染天然集中"，可接受。**无需重构。**

### 1.3 ⚠️ 关键发现：off-grid 数学的"重复 + parity 测试缺口"

Brief 说"off-grid math 在 app.js↔estimate.mjs 重复，有 parity test"。**实测核对结果：重复属实，但 parity 测试并不覆盖它。**

- app.js 第 1449–1545 行 `offGrid()` 里硬编码了一整套常量：`LOAD={light:1500,moderate:2800,heavy:5000}`、`PSH={summer:5.5,shoulder:4.0,winter:2.5}`、`USABLE=0.8, DERATE=0.7, GRAY_FRAC=0.8`、`WATER={...}`——这些是 `src/lib/estimate.mjs` 里同名常量的手抄副本。
- 但**唯一的 parity tripwire**（`test/client-parity.test.mjs`，靠 `/* PARITY-MIRROR:BEGIN/END */` 标记从 app.js 抽块比对）**只覆盖 campsite-fit 的函数**（trailerFit / hookupMatch / nightsHere / elevationContext / peakSunHoursAt / inElevationBand）。off-grid、tow、fuel、payload 这 4 套 app.js 镜像**全部没有 parity 保护**。
- 同样地，app.js 第 1550 行 `towTool`（镜像 tow.mjs）、L3272 fuel（镜像 fuel.mjs）、L3330 payload（镜像 payload.mjs）也都只是注释里写"Mirrors … EXACTLY"，没有自动化 tripwire。

**这是真实的回归风险：** 有人改了 estimate.mjs 的 DERATE，detail 页服务端渲染的数字会变，但客户端交互工具仍用旧常量，二者**静默不一致**——而这正是该站"accuracy paramount"硬约束最怕的失败模式。

- **升级：把 off-grid / tow / fuel / payload 也纳入 PARITY-MIRROR tripwire。** 价值**高**、effort **S–M**。
- **做法：** 仿照已有的 campsite-fit 模式，在 app.js 的 4 个工具里加 `/* PARITY-MIRROR */` 标记块（或至少把常量抽成可被测试 import 的形式），扩展 client-parity.test.mjs 用相同 fixtures 跑双份比对。零新依赖（用现有 `node:vm` 抽块手法）。
- **约束风险：** 无。纯测试增强，强化 accuracy 约束。
- **第一步：** 先做 off-grid（brief 已点名），把 L1449–1545 的常量与 estimate.mjs 的 LOAD_PRESETS/PEAK_SUN_HOURS/WATER 用一个新 test 断言数值相等——这一步几行就能堵住最明显的洞。

### 1.4 死代码 / 重复 —— 基本干净

- 搜了 `finance/mortgage/loan/月供` 等（brief 提到历史上有被移除的金融代码），**当前 src/ 无残留**（命中的都是月份名数组、map 变量名误匹配）。fingerprint 机制注释也确认旧金融代码已靠 content-hash 清掉。
- `explore.html` 现为 shim（老书签跳转），是有意保留的兼容层，非死代码。
- **结论：** 无显著死代码。最大"重复"就是 1.3 的镜像常量——靠 parity 测试管理而非消除（客户端确实需要不依赖网络的本地副本），方向正确，只是覆盖面要补齐。

---

## 2. 性能（Performance）

### 2.1 已 ship、不要重做的（避免重复劳动）

实测确认以下都已到位：
- ✅ 全部 1894 个 `<img>` **都带 width/height**（防 CLS）+ 1763 个 `loading="lazy"`。
- ✅ 首页 hero 用 `fetchpriority="high"`（LCP 优化）。
- ✅ MapLibre 939 KB **懒加载**：用 IntersectionObserver 在地图近视口才拉库，list 永不被阻塞；还有 12s watchdog + WebGL 不可用时的降级。
- ✅ campgrounds.json 905 KB **外置成独立 fingerprint 文件**，异步 fetch，不内联进 HTML、不阻塞首屏。
- ✅ 字体 `font-display: swap` + unicode-range 分片 + 自托管。
- ✅ 资源 content-hash + `immutable` 缓存；HTML `no-cache` 必重验证——缓存策略教科书级。

### 2.2 真正还开着的性能缺口

**(a) 图片体积是首屏真正的大头，缺 responsive `srcset`。** — 价值**高**、effort **M**
- `assets/img` = 31 MB / 567 webp。最大单图 294 KB（community thumb）、hero 多在 160–226 KB。
- 现在每张图只有**一个尺寸**。手机上一个 360px 宽的卡片缩略图，仍下载为桌面同款全尺寸 webp——浪费带宽，伤 LCP 与移动数据。
- **做法（零依赖）：** 现有 `scripts/transcode-images.mjs` 已在做 webp 转码，扩展它对 hero/gallery/thumb 生成 2–3 个宽度档（如 400/800/1280），render 时输出 `srcset` + `sizes`。沿用 build 的 fingerprint。
- **约束风险：** 低（不引依赖；若用 `sharp` 会引依赖，建议沿用现有转码工具链或 `cwebp` CLI）。China-robust 不受影响（都同源）。
- **第一步：** 先只给 hero 图（每页 1 张、LCP 元素）加 480w/960w/1440w 三档 + `sizes`，量 LCP 收益再推广到 gallery。

**(b) hero 字体未 preload，FOUT 风险。** — 价值中、effort S
- 实测首页**无任何 `<link rel="preload" as="font">`**。Fraunces（标题）靠 swap，首屏 H1 会先以 fallback serif 渲染再跳字。
- **做法：** 在 `page()` 的 head 里给 latin 子集的 Fraunces 500 + DM Sans 400 两个 woff2 加 `<link rel="preload" as="font" type="font/woff2" crossorigin>`。
- **约束风险：** 无。第一步：只 preload 这两个最关键的 woff2，别全 preload（会抢首屏带宽）。

**(c) site.css 126 KB（25 KB gzip）可能含未用规则。** — 价值低–中、effort M
- 单文件 126 KB 偏大。没有 critical-CSS 内联，也未做 unused 剔除。25 KB gzip 在 render-blocking 链路里不算灾难，但 detail 页用不到 campsites/finder 的大量 `.cg-*`/`.cs-*` 规则。
- **做法：** 可考虑按"页面族"拆 CSS（core + map-pages.css），或引一个零依赖的 PostCSS purge 步骤。**优先级低**——收益小且有破坏风险，放在 (a)(b) 之后。
- **约束风险：** purge 工具会引依赖，与 zero-dep 冲突；建议手工按 section 拆，或干脆不做。

**(d) Core Web Vitals 风险小结：**
- **LCP：** 首页 hero 已 fetchpriority=high，但缺 srcset（见 a）+ 缺 font preload（见 b）是当前两个最实际的 LCP 杠杆。
- **CLS：** 风险低（图全带尺寸）。需复查地图容器、抽屉（drawer）插入时是否预留高度。
- **INP：** app.js 模块化、用 DOM API 重建（避免 innerHTML），风险低；地图页交互重，但已隔离。

---

## 3. 无障碍 WCAG 2.1 AA（Accessibility）

### 3.1 ⚠️ 关键发现：copper 文字对比度未达 AA（实测）

我用 WCAG 相对亮度公式实测了调色板（`--copper:#B05C32` on `--bg:#F4EFE6`）：

| 前景 / 背景 | 对比度 | AA 普通文本(4.5) | AA 大文本(3.0) |
|---|---|---|---|
| **copper / bg** | **4.15** | ❌ **FAIL** | ✅ pass |
| **copper / surface (#FBF8F2)** | **4.48** | ❌ **FAIL（差 0.02）** | ✅ |
| copper-deep / bg | 6.20 | ✅ | ✅ |
| copper-deep / surface | 6.70 | ✅ | ✅ |
| ink / bg | 14.95 | ✅ | ✅ |
| muted / bg | 5.22 | ✅ | ✅ |
| white / copper（按钮反白字） | 4.75 | ✅（刚过） | ✅ |
| white / copper-deep | 7.10 | ✅ | ✅ |

**问题：** `color: var(--copper)` 在 CSS 里被用作**文字色 57 次（site.css）+ 4 次（controls.css）**，包括 `.eyebrow`（小标签）、`.est-method summary`、`.tow-method summary`、`.cg-pop a`（弹窗链接）、各种 12–13px 小字。这些是**普通尺寸文本**，4.15–4.48:1 **不满足 AA 的 4.5:1**。`.eyebrow` 还是 12px 全大写——属于普通文本范畴。

- **升级：把"作为文字色的 copper"换成 copper-deep（或微调 copper 加深）。** 价值**高**（合规 + 可读性）、effort **S**。
- **做法：** copper-deep（#8A4524）在 bg 上是 6.20:1，轻松达标，且与品牌色同系、视觉差异小。两条路线：
  1. 引入语义 token `--copper-text: var(--copper-deep)`，把 57+ 处文字用途批量换成它，**保留** copper 作为边框/填充/背景（边框/图标对比要求只 3:1，copper 够）。
  2. 或直接把 `--copper` 整体加深到约 #A2522C（≈4.5:1），但会牵动反白按钮（white/copper 当前 4.75 已经很紧，加深 copper 反而会改善反白对比，需重测）。
- **约束风险：** 无（不碰静态/依赖约束；纯设计 token）。但要保住"premium 铜色"观感——copper-deep 已在站内大量使用（hover、active），视觉一致。
- **第一步：** 加 `--copper-text` token，先替换 `.eyebrow` + 所有 `summary` + `.cg-pop a` 这些纯文字场景，跑一遍视觉回归截图。

### 3.2 缺 skip-link（跳到主内容） — 价值中、effort S
- 实测：**0 个页面有 skip-link**（grep 命中的"skip"是正文里"owner deliberately skipped"）。键盘用户每页都要 Tab 过整个导航。
- 好消息：页面**有 `<main>` landmark**（`<main class="fam-grid">` 等），所以基础结构在。
- **做法：** 在 `page()` 模板 body 顶部加一个 `<a class="skip-link" href="#main">Skip to content</a>`（视觉隐藏、focus 时显示），给各页 `<main>` 加 `id="main"`。
- **第一步：** 改 render.mjs 的 `page()` shell + 给 main 加 id（注意各页 main 的 class/id 不统一，需统一锚点）。

### 3.3 ARIA / 语义 —— 整体很好
实测属性分布健康：`aria-label`×1945、`aria-hidden`×1397、`aria-expanded`×331 + 配套 `aria-controls`×331、`aria-current`×77、`aria-pressed`×57、`aria-live`×2、`role="tooltip"`×331 / `role="img"`×87 / `role="group"`×54。floorplan hotspots 用 `aria-expanded`+`aria-controls`+tooltip——做得相当到位。

**待查/小修：**
- `aria-live` 只有 2 处。**交互计算器（tow / off-grid / fuel / payload）的结果数字更新时，屏幕阅读器可能不播报**。建议给结果容器（`#og-nights`、tow verdict、fuel/payload 输出）加 `aria-live="polite"`，让盲用户知道算出了新结果。价值中、effort S。
- 验证 focus management：抽屉（availability drawer）打开时焦点是否移入、Esc 是否关闭（代码里有 Escape 处理，需确认 focus trap）。

### 3.4 地图无障碍 —— 已知难点，已有基础
- 有 WebGL 不可用时的 no-op stand-in + "honest notice" 降级，list 完全可用——这本身就是地图 a11y 的兜底（地图数据在 list 里有等价可访问表示）。
- canvas 地图对屏幕阅读器天然不可达，但因为**list 是 source of truth、map 是增强**，合规上可接受。建议给地图容器加 `role="application"` + `aria-label` 说明"交互地图，下方列表含同样信息"。

### 3.5 焦点样式 —— 良好
`:focus-visible` 出现 21 次、`:focus` 35 次，表单聚焦用 `outline: 2px solid var(--copper)`。注意：focus outline 用 copper（#B05C32），其对 bg 对比 4.15——非文本 UI 组件要求 3:1，**焦点环达标**（≥3:1），无需改。

---

## 4. 移动端 / 触摸（Mobile / touch）

- ✅ **触摸目标良好：** `.tagfilter`/select 等用了 `min-height: 44px`（命中 WCAG 2.5.5 / Apple HIG 44px）。floorplan hotspots 注释为"touch-safe"。
- ⚠️ **导航无汉堡菜单：** topnav 用 `flex-wrap: wrap` + 窗口窄时缩小 padding/font（`@media` 到 13px）。导航项少（Explore/Campsites/Upgrades/Maintenance）时 wrap 可接受，但如果 i18n 后中文标签变长或加项，wrap 会换行难看。**当前可接受，i18n 时需重审。**
- ⚠️ **地图在手机上的可用性需实测：** 2500 点 GPU 聚类在低端手机的 WebGL 表现、popup 在小屏的尺寸、`clusterRadius:52` 在手机密度——建议真机/CDP 截图验证（audits/ 里已有 campsites-map 截图先例，可复用 `scripts/cdp-shot.cjs`）。
- ⚠️ **floorplan hotspots 触摸：** 已标"touch-safe"且用 aria-expanded，但热点 dot 的实际点击半径需在小屏确认 ≥44px。

价值中、effort S（多为验证 + 小修），第一步：跑 CDP 移动视口截图过一遍 campsites/finder/detail 三类页。

---

## 5. PWA / 离线（Offline potential）

实测：**无 manifest、无 service worker、无 theme-color**——目前完全不是 PWA。

**评估：对这个站，离线价值真实且与定位高度契合（房车出行、营地常无信号）。** 但要分清能离线什么：
- **可离线（高价值）：** 静态 HTML/CSS/app.js/字体、trailer/motorhome 规格页、maintenance 计划、upgrades、tow/off-grid/fuel/payload 计算器（纯客户端，断网照算）、campgrounds.json（905 KB，可缓存供营地查询）。**这正是"开到信号盲区的营地还能查规格/算配重/看保养"的杀手场景。**
- **不可离线：** recreation.gov 实时 availability fetch、地图瓦片（除非预缓存特定区域，复杂）。

- **升级：加一个保守的 service worker（cache-first 静态壳 + 选缓 campgrounds.json）。** 价值**高（与用户场景极契合）**、effort **M**。
- **约束风险：** 中——需谨慎。
  - **China-robust：** SW 本身同源，无 GFW 问题 ✅。但 SW 注册脚本、manifest 都须自托管。
  - **缓存正确性是最大坑：** 站点已有精心设计的 `immutable + content-hash`（资源）vs `no-cache`（HTML）策略。SW 必须尊重它——HTML 用 network-first（拿最新指向最新 hash 资源），fingerprint 资源用 cache-first。**写错会重演"用户卡在旧版本"的历史 bug。**
  - 不引依赖：手写 SW（~100 行）即可，别引 Workbox（依赖 + 体积）。
- **第一步：** 先做最小可用：一个 manifest.webmanifest（名称/图标/theme-color，让"加到主屏"可用）+ 一个 network-first(HTML) / cache-first(/assets/*) 的 SW，**先不缓 campgrounds.json/瓦片**。验证缓存失效逻辑与现有 _headers 不打架后，再加营地数据预缓存。
- **次序建议：** 这是个有"footgun"的功能，建议排在 §1.3 parity、§3.1 对比度、§2.2a srcset 这些低风险高价值项之后。

---

## 6. 双语 i18n（EN / 中文）—— 用户本人双语，价值高但 effort 要诚实

**现状评估（决定 effort 的关键）：**
- 文案是**硬编码英文**，散落在 ~27 个 .mjs 渲染模块 + 数据 JSON + app.js 里。没有任何 i18n 框架、没有字符串表、没有 `t()` 包装。render.mjs 等模板里大量 `>Motorhomes<`、`>Campsites<`、`>How this is calculated<`、`>Tow vehicle<` 等内联文本。
- 数据层（trailers.json 等）里也有英文描述性字段、来源说明。
- **字体不支持中文：** 自托管的 Fraunces + DM Sans 的 woff2 只含 latin / latin-ext / vietnamese unicode-range，**没有 CJK 字形**。渲染中文会 fallback 到系统字（破坏"premium editorial"观感），或需引入一个中文 webfont——而中文 webfont 动辄 数 MB（即便子集化也要按页动态子集），与 zero-dep/静态/China-robust 都有摩擦。

**Effort 诚实评级：L（大）。** 这不是"加个开关"，是穿透整个渲染层的工程：

1. **字符串提取（最大工作量）：** 把 27 个模块 + app.js 的内联英文抽成 `src/i18n/en.json` + `zh.json` 两张表，模板改成查表。这是几百到上千条字符串的人工迁移 + 翻译。
2. **构建期双输出（最契合现有架构的方案）：** 因为是静态站，最干净的做法是 build.mjs 跑两遍，输出 `/` (en) 和 `/zh/`（中文）两套完整 HTML，各自 `<html lang>` 正确、互加 `hreflang` + canonical、导航加语言切换器。**不需要运行时 i18n、不需要 JS 切语言**——完全符合静态/零服务器约束 ✅。
3. **语言切换器 UI + 持久化：** topnav 加 EN/中 切换，localStorage 记忆，跳到对应 `/zh/` 路径。
4. **数据层翻译：** 规格数字语言无关，但描述性文案、来源注释、计算器假设说明需要中文版——且必须保持 accuracy 约束（中文翻译不能引入事实漂移）。
5. **中文字体策略（独立子问题）：** 选一个开源中文字（如思源宋体/黑体的 subset）自托管，或对中文页接受系统字体。这块本身就是中等工作量 + 体积权衡。

- **约束风险：**
  - 静态/零服务器：**无风险**（build-time 双输出是最静态友好的 i18n 方案）。
  - China-robust：中文 webfont 体积是真风险（多 MB），需子集化 + 同源，否则伤中国用户首屏——讽刺的是中文页给的正是中国用户。
  - Accuracy：翻译需校对，规格类内容尤其。
  - dist 体积近乎翻倍（97→~194 页 HTML，但 HTML gzip 小，图片/JS/CSS 资源共享不翻倍，可接受）。
- **第一步（务实的切入点）：** **先做一个垂直切片验证可行性**——只把 `page()` 外壳（导航 + footer + 语言切换器）+ 首页 抽成 en/zh 双表，build 出 `/zh/index.html`，确认双输出 + hreflang + 切换器 + 中文字体方案这条链路通，再决定要不要把全部 27 模块 + 数据 + 计算器铺开。**不要一上来全量翻译。**
- **建议定位：** 这是路线图上**最大、最值得但最贵**的一项。鉴于用户本人双语、且是站点 owner，价值排序很高，但应作为一个独立的、分阶段的大工程立项，而非和小修一起做。

---

## 7. 站内搜索（Search）

**现状：** 有**逐页过滤式搜索**（explore 页 `#x-search`、compare 页 `#cmp-search`、campground finder 搜索框，`type="search"` 共 4 处），但**没有全站统一搜索**——你不能从任意页搜"Flying Cloud 25FB"或"anode rod 保养"然后跳过去。

**评估：客户端搜索索引完全可行且契合零依赖/静态约束。** — 价值中–高、effort M

- 内容规模适中：59 trailer + 11 motorhome + upgrades(6 类) + maintenance(39 任务) + ~2500 营地。给前面这些（不含 2500 营地，营地已有专门 finder）建一个轻量 JSON 索引（title/slug/类型/关键字段），几十 KB 级别。
- **做法（零依赖）：** build.mjs 额外产出一个 `search-index.json`（fingerprint + 异步加载），app.js 加一个 ~100 行的客户端搜索模块（简单 token 匹配/前缀匹配即可，70 条目无需 lunr/fuse 这类库——**避免引依赖**）。一个全站搜索框放 topnav 或快捷键唤起。
- **约束风险：** 低。纯客户端、同源、零新依赖。China-robust ✅。
- **第一步：** 在 build 里生成涵盖 trailers+motorhomes+upgrades+maintenance 的 `search-index.json`，先做一个最小的"输入→过滤→跳转"下拉，验证体验后再扩字段/加键盘导航。

---

## 优先级总表（建议执行顺序）

| # | 升级项 | 价值 | Effort | 约束风险 | 第一步 |
|---|---|---|---|---|---|
| 1 | **§1.3 off-grid/tow/fuel/payload 纳入 parity tripwire** | 高 | S–M | 无 | 给 off-grid 常量加一个数值相等 test |
| 2 | **§3.1 copper 文字对比度修复（→copper-deep / `--copper-text`）** | 高 | S | 无 | 加 token，先换 .eyebrow + summary + 弹窗链接 |
| 3 | **§0/Brief 已知项：stale "AI-generated" 免责声明** | 高(可信度) | XS | 无 | 改 README:51 + render.mjs:92 + motorhome-render.mjs:64 |
| 4 | **§2.2b hero 字体 preload** | 中 | S | 无 | preload 2 个关键 woff2 |
| 5 | **§3.2 skip-link + §3.3 计算器结果 aria-live** | 中 | S | 无 | page() 加 skip-link，结果容器加 aria-live=polite |
| 6 | **§2.2a 图片 srcset/responsive（先 hero）** | 高 | M | 低 | 给 hero 出 3 档宽度 + sizes |
| 7 | **§7 全站客户端搜索（70 条目，零依赖）** | 中–高 | M | 低 | build 出 search-index.json |
| 8 | **§4 移动端 CDP 截图验证 + 触摸半径核对** | 中 | S | 无 | 跑现有 cdp-shot 过三类页 |
| 9 | **§1.1a 地图模块从 app.js 拆出（先量化收益）** | 中 | M | 低 | 量 map 模块 gzip 大小决定是否值得 |
| 10 | **§5 保守 PWA（manifest + network-first SW）** | 高 | M | 中(缓存正确性) | 先 manifest + 静态壳 SW，不缓数据 |
| 11 | **§6 EN/中文双语（build-time 双输出）** | 高 | **L** | 中(中文字体体积) | 先做外壳+首页垂直切片验证链路 |

### 明确"不要做"
- ❌ 引入打包器（Rollup/esbuild/Workbox 等）做 code-split / SW——违反 zero-dep 构建约束，且 app.js 已被 immutable 缓存抵消收益。
- ❌ 大改 lib 模块边界——现状健康。
- ❌ CSS purge 工具——引依赖且有破坏风险，收益小。

### 已 ship、勿重做（避免和已完成工作冲突）
图片懒加载、img 尺寸防 CLS、MapLibre 懒加载、campgrounds.json 外置异步、字体自托管+swap、content-hash immutable 缓存、image guardrail、两个边缘代理（cdn/tiles，写得很扎实，allowlist + 边缘缓存 + 同源，无需改）、GPU 地图聚类。
