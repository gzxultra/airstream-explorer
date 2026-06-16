# Round-2 Full-Site Audit — Visual / IA / Performance 视角 (5/5)

_审计对象: Airstream Explorer @ HEAD `0e24a8f`, 280 tests passing, live at
https://airstream-explorer.pages.dev. 纯 ESM Node / 零运行时依赖 / Cloudflare
Pages. 本视角只评估 视觉&编辑质量 / 图片策略 / 性能 / 移动端 / 可访问性 / 跨-tab IA。
只产出方案, 未改任何代码。_

测过的真实产物 (`npm run build`):
- HTML: index 84KB, explore 75KB, upgrades 73KB, community 32KB, credits 31KB,
  compare 24KB, campgrounds 13KB.
- 关键 assets (指纹化、immutable): `app.js` 118KB, `site.css` 80KB, controls 8.7KB,
  fonts.css 6.4KB; **MapLibre `maplibre-gl.js` 939KB** (懒加载), maplibre CSS 69KB;
  campground dataset **`campgrounds.<hash>.json` 979KB** (外置、懒 fetch)。
- 图片总量 **27MB / 511 张**: decor **11MB/142张**, gallery 6.8MB/177, floorplans
  2.8MB/59, heroes 1.5MB/12, thumbs 464KB/59。全部 `.webp`、已指纹化。
- 字体: 5 个自托管 woff2 (DM Sans + Fraunces, 静态实例, `font-display:swap`)。
- 一张详情页 (Classic 33FB) = 35 `<img>` (1 eager hero + 34 lazy)。

---

## 评估总览 (按视角)

排版编辑质量在 **premium 编辑级** 这条线上确实站得住 (截图实测: 详情页的 Fraunces
大标题 + 铜色 spec、tow/off-grid 仪表、per-site fit 条都读得出"杂志感"而非模板感)。
**真实短板集中在三处**: (1) 图片管线没有响应式/LQIP、décor 严重过尺寸 →
首屏字节与中国可达性双输; (2) 营地照片直连 `cdn.recreation.gov` (CloudFront) —
已知 GFW 待解项, 是营地页"半残"的最大单点; (3) 一批 thread-4 已规划但**未上线**的
低风险编辑/无障碍打磨 (view-transition、scroll-reveal、统一 type scale、skip-link、
reduced-motion 收口)。下面逐条。

标注: 【已上线-跳过】只确认现状; 【真实缺口-建议做】给方案; 【数据问题-需校准】。
每条标 价值 / 工作量(S/M/L) / 中国可达性影响 / 是否碰铁律。

---

## 【真实缺口-建议做】(按价值排序)

### G1. 营地照片直连 cdn.recreation.gov (CloudFront) — 中国可达性最大单点 ★★★★★
**问题**: 数据集 2561 营地中 **2460 张有照片**, 全部是 `cdn.recreation.gov/<path>_700.webp`
形式 (app.js L896-898 在运行时把相对路径拼成 CloudFront 绝对 URL)。CloudFront 在中国
被限速/间歇墙是已知事实 — 这意味着对国内用户, 营地 Finder 和每个详情页底部的
"Where this fits" 卡片会大面积出现**裂图/超长 pending/灰块**, 而这恰恰是全站最依赖
图片说服力的模块。截图 `fit-finder-hookup.png` 里照片能出是因为审计机器在墙外。

**为什么严重**: 这是铁律"所有外部资源必须防 GFW"的**唯一仍在违反的运行时外链**
(Google Fonts/Mapbox/CARTO 都已自托管)。2460 张照片不可能全部自托管 (体量 + 版权 +
Recreation.gov 不是 CC), 所以这是个真实的工程权衡题, 不是"补一下"。

**建议方案** (按推荐度):
1. **优雅降级 + 渐进增强 (S, 立刻做)**: 给 `.cg-card-img` 加 `onerror` → 替换为现有
   `.cg-card-noimg` 铜色 ▲ 占位 (现在 onerror 不处理, 裂图直接呈现)。再给营地卡的
   图片容器一个**编辑级渐变/地形纹理占位底** (类似车型卡的 `radial-gradient` 奶油底),
   这样即便照片永远加载不出, 卡片仍是"有意设计的留白"而非"坏掉的网站"。**这步最该先做**,
   它把"打不开"变成"优雅无图", 不碰版权、不增体量。
2. **同源缩略图代理 (M)**: 用 Cloudflare Pages 同源路径 (e.g. `/img-proxy/<path>`)
   或 build 时把营地首图抓一张 ~320px webp 缩略图 baked 进 `assets/img/cg/` —— 但 2460
   张 × ~15KB ≈ 37MB, 体量翻倍且版权存疑 (Recreation.gov 图片非 CC)。**不推荐全量**;
   可只为"编辑精选 Collections"里出现的营地 (Editor's Picks 等, 数量小) 自托管缩略图。
3. **lazy 之外加 `loading=lazy` + `decoding=async`** (已 lazy, 见 G2)。

**价值**: ★★★★★ (直接决定国内体验是否"残") · **工作量**: 方案1=S, 方案2=M ·
**中国可达性**: 决定性 · **铁律**: 命中"防 GFW"铁律, 但属"已知待解项"的正解。

---

### G2. 图片管线无响应式 srcset / 无 LQIP-blur-up / décor 严重过尺寸 ★★★★☆
**现状实测**:
- **décor swatch 过尺寸**: 源图 **600×600**, CSS 显示 **84×84** (`.decor-swatch img`)。
  即使 @2x retina 也只需 ~168px。142 张 swatch = **11MB (全站图片的 41%)**, 几乎全是
  浪费的像素。一个 16-floorplan 家族的详情页要拉十几张 600² 只为渲染指甲盖大小。
- **gallery 6.8MB/177**: 920×600 源图, 详情页两栏显示, 桌面单图 ~430px、移动端满宽。
  桌面端多下了一倍线性分辨率。
- **无 `srcset`/`sizes`**: 全站 `<img>` 只有单一固定源 + `width/height` (CLS 已防, 好)。
  手机用户和桌面用户拉同一张大图。
- **无 LQIP / blur-up / 占位色**: car 卡用 `radial-gradient` 奶油底兜底 (好), 但
  hero/gallery/decor 加载中是纯灰/底色闪一下, 没有低清模糊占位的"高级感"。

**建议方案**:
1. **décor 重新转码到 ~200px (S, 最高 ROI)**: `scripts/transcode-images.mjs` 已存在 —
   加一档把 decor 输出 200×200 webp。预计 11MB → **~1.5MB**, 省 ~9.5MB, 对国内是巨大
   的首字节胜利。**这是全站性价比最高的单条性能动作。**
2. **gallery/hero 出 2 档 + `srcset`/`sizes` (M)**: build 时每张出 `-sm`(~480w) /
   `-lg`(原图) 两档, render 写 `srcset`。手机用户省一半。指纹化管线已能处理多文件。
3. **LQIP blur-up (M)**: build 时为 hero/gallery 生成 ~20px webp 的 base64 内联到
   `background-image`, 图片 onload 后淡出。纯 CSS+1 行 JS, 防 GFW、零库。是 thread-4
   §"premium 编辑级"明确想要但未做的质感层。

**价值**: ★★★★☆ · **工作量**: décor=S / srcset=M / LQIP=M · **中国可达性**:
décor 重转码直接减 ~9.5MB 首屏外的下载压力 · **铁律**: 不碰 (全自托管同源)。

---

### G3. thread-4 已规划但未上线的编辑/动效打磨层 ★★★★☆
实测 CSS/JS: **view-transition、content-visibility、text-wrap、scroll-reveal、统一
`--step-*`/`--space-*` token、IntersectionObserver 全部查无** —— 即 thread-4
(`research-thread4-ux.md` §6 rollout) 的第 3/4/5/8 项**尚未落地**。它们恰是
"低风险、高 wow/行、全防 GFW"的那批。

**逐项 (都不碰铁律, 全部纯 CSS / 原生 API)**:
- **跨文档 View Transitions (S)**: 加 `@view-transition { navigation: auto }` +
  卡片→详情页 hero `view-transition-name`。MPA 原生、渐进增强、零库 —— thread-4 评为
  "biggest wow-per-line"。59 详情页 + hub 之间的导航立刻有电影感转场。
- **scroll-reveal (S/M)**: IntersectionObserver 一次性淡入 (family grid / xgrid /
  营地卡), `prefers-reduced-motion` 下禁用。subtle, 不是 SaaS 那种浮夸。
- **统一 fluid type + space scale token (M)**: 现在 `clamp()` 散落各处 (hero-head /
  explore-head / cg-hero 各写各的)。抽成 `--step-0..6` + `--space-*` 一套 token,
  消除"模板感"里最隐蔽的一种 —— 节奏不一致。
- **`text-wrap: balance` 给标题 / `pretty` 给 lede (S)**: 一行 CSS, 防孤儿字, 立刻
  更"排过版"。`content-visibility: auto` 给折叠下方的长 section (营地列表、gallery)
  降低首屏 layout 成本。

**价值**: ★★★★☆ (把"很好"推到"明显高级") · **工作量**: 多数 S, token=M ·
**中国可达性**: 全部同源/原生, 零影响 · **铁律**: 不碰。

---

### G4. 可访问性: 无 skip-link / 详情动效未收口 reduced-motion / 焦点态不统一 ★★★☆☆
**实测**:
- **无 skip-link**: 全站 7 页 `grep "skip to|sr-only|visually-hidden"` 全空。
  键盘/读屏用户每页都要 tab 过 topnav 才到正文。加一个视觉隐藏、focus 时出现的
  "Skip to content" → `<main id>` 是 WCAG 基本项。
- **`<main>` 缺失**: campgrounds.html 和 compare.html **没有 `<main>` 地标** (实测
  `grep -c '<main'` = 0)。营地 Finder 是核心页却无主地标, 读屏用户拿不到"主内容"锚点。
  (index 有 2 个 main —— 见 G6, 那是另一个问题。)
- **reduced-motion 覆盖不全**: 有 3 处 `prefers-reduced-motion` block (controls.css 1 +
  site.css 2, 含 collections rail 和 map pin)。但 **card/fam/xcard 的 hover
  `transform: translateY + scale(1.045)` 转场未被 reduced-motion 收口**, cphoto
  `scale(1.03)` 也没有。建议加一个全局 `@media (prefers-reduced-motion: reduce){ *{
  animation,transition 收敛 } }` 安全网 (thread-4 §8 也点了)。
- **焦点态**: 表单控件 focus 做得好 (铜色 ring, controls.css)。但**卡片链接 (.card /
  .fam / .xcard-link / .cg-card) 这些大点击块没有显式 `:focus-visible` 样式** —— 键盘
  用户 tab 到卡片时只能靠浏览器默认轮廓 (在奶油底 + 圆角上经常看不清)。

**对比度 (实测, 已基本达标, 记录在案)**: muted `#6B6258` on bg = 5.22, on surface =
5.64 (✓ AA 正文); copper-deep `#8A4524` on cream = 6.20 (✓); ink = 14.95 (✓);
white on copper btn = 4.75 (✓ AA)。**但 `--copper #B05C32` 直接做正文/eyebrow 文字时
= 4.15 (cream) / 4.48 (surface)** —— 对 normal-size 文字**未过 AA 4.5**。eyebrow 是
12px 大写加粗 (算 large? 不算, large 需 ≥18.66px bold)。**建议: 凡用 `--copper` 当
小号文字处 (eyebrow、cg-col-eyebrow、部分 label) 改用 `--copper-deep`**, 视觉几乎无差
但过线。纯铜色保留给图标/边框/填充块。

**价值**: ★★★☆☆ (合规底线 + 真实键盘/读屏体验) · **工作量**: S (skip-link + main +
focus-visible + reduced-motion 安全网都是小 CSS/HTML) · **中国可达性**: 无 ·
**铁律**: 不碰 (实际是"数据准确/编辑严谨"精神的无障碍延伸)。

---

### G5. 营地 Finder: 地图懒加载体验 & 移动端列表密度 ★★★☆☆
**现状 (实测代码)**: 架构很稳 —— MapLibre 939KB 懒加载、list-first、WebGL 不可用有
诚实 fallback、12s watchdog、数据集外置异步 fetch。这套"列表永远先活"的策略**值得肯定,
不要动**。但有两处体验缺口:
- **地图懒加载无 IntersectionObserver 触发**: `loadMapLibrary()` 在 `boot()` 里
  数据一到就立刻调 (app.js L2050), 即 939KB 仍是"列表渲染后马上抢带宽"。对国内慢网,
  更好的是**等地图容器进视口或 `requestIdleCallback` 再拉** —— 很多用户只看列表/用
  筛选, 根本不滚到地图。可显著推迟近 1MB 下载。(S)
- **移动端列表 2 列在窄屏偏挤**: `.cg-list` 在 ≤880px 仍是 `1fr 1fr`, 到 ≤520px 才
  单列。中端手机 (390-520px) 两列卡片里塞了名字+fit条+三个 pill+价格+按钮, 偏拥挤。
  建议把单列断点上提到 ~600px。(S)
- **地图 `cg-map` 在窄屏 360px 高、`order:-1` 顶到列表上方** —— 但它懒加载且常 fallback,
  移动端用户开屏先看到一块 360px 灰盒/“Map unavailable”再到列表, 体验倒挂。**建议
  移动端默认把地图折叠到列表下方/或做成"显示地图"按钮**, 让最有用的列表先占首屏。(S/M)

**价值**: ★★★☆☆ · **工作量**: S~M · **中国可达性**: 推迟 MapLibre = 国内省近 1MB ·
**铁律**: 不碰。

---

### G6. IA: Explore hub 双 `<h1>` + 双 `<main>` 语义问题 ★★★☆☆
**实测**: `index.html` 有 **2 个 `<h1>`** ("Every Airstream, by family" +
"Every floorplan, by the numbers") 和 **2 个 `<main>`** (family grid + explore
sections 各一)。因为 hub 把两个旧 tab (By family / All floorplans) 合进一页, 两个
view 各自带了完整 header。

**问题**: 一个文档应只有一个 `<main>` 和理想情况下一个 `<h1>`。当前即便有一个 view
`hidden`, DOM 里两个 `<main>`/两个 `<h1>` 同时存在 —— 读屏的"跳到主内容""列出标题"
会迷惑, SEO 也拿到模糊的文档大纲。

**建议方案 (S)**: 外层 hub 用单个 `<main id="content">`, 两个 view 降级为
`<section aria-labelledby>` + `<h2>` (或保留视觉大小但语义降级); 真正的页面 `<h1>`
只留一个 (hero band 里那个)。视觉零变化, 语义和无障碍立刻干净。

**价值**: ★★★☆☆ (语义/SEO/无障碍) · **工作量**: S · **中国可达性**: 无 · **铁律**: 不碰。

---

### G7. 字体: 无 `<link rel=preload>` 关键 woff2 → 首屏 FOUT ★★☆☆☆
**实测**: `fonts.css` 用 `font-display: swap` (好, 防 FOIT)。但 head 里**没有
`preload` 任何 woff2** —— 字体要等 CSS 下载+解析后才被发现并请求, 首屏会先用 system-ui
渲染再切到 Fraunces/DM Sans (FOUT 闪烁)。对于自托管同源字体, preload 是低成本提速。

**建议 (S)**: 在 `page()` head 里 `preload` 最关键的 2 个 woff2 —— DM Sans latin 400
(正文) + Fraunces latin 600 (标题), `crossorigin`。其余按需。注意只 preload
真正首屏用到的, 别全 preload (5 个全 preload 反而拖慢)。

**价值**: ★★☆☆☆ · **工作量**: S · **中国可达性**: 同源, 纯正向 · **铁律**: 不碰。

---

### G8. MapLibre CSS 69KB 渲染阻塞 (营地页) ★★☆☆☆
**实测 build.mjs**: campgrounds.html head 里 maplibre-gl.css 是普通
`<link rel=stylesheet>` (渲染阻塞), JS 才是 `preload`+懒加载。但地图本身是懒加载的,
**地图 CSS 没必要在首屏阻塞渲染** —— 69KB CSS 阻塞了营地列表的首次渲染。

**建议 (S)**: 把 maplibre CSS 也改成非阻塞 (`media="print" onload` 切换法, 或在
`loadMapLibrary()` 里和 JS 一起注入 `<link>`)。这样营地列表首屏完全不等地图任何资源。

**价值**: ★★☆☆☆ · **工作量**: S · **中国可达性**: 间接正向 · **铁律**: 不碰。

---

## 【数据问题-需校准】

### D1. "floorplan" 术语在全站自相矛盾 (31 vs 59) + footer 硬编码字面量 `${31}` ★★★★☆
**实测各页计数**:
- 首页 hero: **"12 families, 31 floorplans"** (动态 `${totalPlans}` = Σ`floorplanCount` = 31)
- 首页 footer: **"31 floorplans across 12 families"** —— 但源码是**字面量 `${31}`** (render.mjs `page()`)
- 首页 "All floorplans" view / explore.html lede: **"all 59 floorplans"** (`trailers.length` = 59)
- viewseg 副标题: **"59 by the numbers"**

**根因 (实测确认)**: 数据集有 **59 个 detail page (trailers)**, 但只有 **31 个 distinct
floorplan** —— 其余是同一 floorplan 的 2025/2026 双胞胎。`groupByFamily().floorplanCount`
Σ = 31 (去重后), `trailers.length` = 59 (含年份变体)。所以 **31 和 59 都"对", 但全站把
两者都叫 "floorplans"** —— 同一页里 hero 说 31、下面的 explore 区说 59, 用户无从知道到底
有几个。这对"审美/准确性极挑剔"的用户是明显的不一致感, 也是"数据准确是底线"精神的违反
(不是数字错, 是**术语没区分 distinct floorplan vs model-year variant**)。

**另一处真 bug**: footer 那个 31 是**硬编码字面量 `${31}`** (不是动态计数)。即便现在恰好
等于真实 distinct 数, 一旦目录增减就会静默说谎 —— 这正是 AGENTS.md 记的那类"字面量埋雷"。

**建议 (S)**:
1. footer 立刻把 `${31}` 换成动态计数 (传入 distinct floorplanCount 或 `trailers.length`)。
2. **统一术语**: 选一个口径并全站一致 —— 推荐 "**31 floorplans across 12 families** (59
   model-year configurations)" 或反之, 让 distinct 与 variant 各有明确名字, 别都叫
   "floorplans"。这是消除"模板感/不严谨感"里最实质的一条。

**价值**: ★★★★☆ (术语一致性 + 信任 + 防字面量埋雷) · **工作量**: S · **铁律**: 沾"数据准确"精神 (需修)。

### D2. home hero alt="An Airstream travel trailer at golden hour" — 通用且暗示 AI ★★☆☆☆
**实测**: 首页 hero 用 International 的红岩探险图, 但 alt 写死 "...at golden hour"。
(a) alt 与实际图不符 (不是 golden hour); (b) "golden hour" 恰是 thread-3 警告的
"太 AI"信号词。建议 alt 改成具体、真实的描述 (e.g. "Airstream International parked
on red-rock desert terrain"), 既准确又利于无障碍/SEO。**工作量 S, 碰"反 AI 感"用户偏好。**

---

## 【已上线-跳过】(确认现状, 不重复提)

- ✅ **自托管字体 + MapLibre + map glyphs/GeoJSON** —— 防 GFW, 已确认 head 引用同源指纹化
  路径, `font-display:swap` 到位。
- ✅ **指纹化 + immutable 缓存 + HTML no-cache** —— build.mjs 对 img/js/css/data 全
  content-hash, `_headers` 正确分层。已实测 live header `cache-control: no-cache` on HTML。
- ✅ **campground dataset 外置 (979KB) + 懒 fetch** —— 不再内联进 no-cache HTML, 同源
  immutable 缓存, 首屏不阻塞。架构正确。
- ✅ **MapLibre 939KB 懒加载 + list-first + WebGL fallback + watchdog** —— 健壮, 是
  全站性能架构的亮点。(改进点见 G5, 是锦上添花不是返工。)
- ✅ **CLS 防御** —— 全站 `<img>` 都带 `width`/`height` 内禀尺寸。
- ✅ **图片 lazy-load** —— hero 之外全 `loading="lazy"`, hero `fetchpriority="high"`。
- ✅ **编辑级铜色排版** —— Fraunces+DM Sans, tabular-nums on specs, 截图实测详情页有真
  "杂志感"。
- ✅ **Collections rail 编辑镜头 + reduced-motion 局部收口** —— rail/map-pin 已守 RM。
- ✅ **CSP-safe vanilla JS** —— 无内联 JS, data island 用 `<script type=application/json>`。
- ✅ **表单控件 focus 态** —— controls.css 铜色 ring, 做得好 (卡片链接缺, 见 G4)。

---

## 本视角 TOP-2 发现

**TOP-1 — 营地照片 CloudFront 外链 (G1) + 图片管线无优化 (G2) 是国内体验与性能的双重最大短板。**
2460 张营地图直连 `cdn.recreation.gov` 是全站**唯一仍在违反"防 GFW"铁律的运行时外链**,
对国内用户营地模块会大面积裂图; 而 décor 11MB 全是 600² 渲染成 84px 的浪费像素 (重转码到
200px 立省 ~9.5MB)。**两个立刻能做的高 ROI 动作**: (a) 给营地图加 `onerror` 优雅占位 +
编辑级渐变底, 把"打不开"变成"有意的无图"; (b) décor 重转码 200px。都不碰版权、不增体量。

**TOP-2 — "floorplan" 术语在同一页自相矛盾 (hero 31 vs explore 59), 且 footer 是硬编码字面量 `${31}` (D1)。**
59 个 detail page 里只有 31 个 distinct floorplan (其余是年份双胞胎), 但全站把 31 和 59
**都叫 "floorplans"** —— 同页 hero 说 31、下面说 59, 用户无从判断到底几个。对审美/准确性
极挑剔的用户这是明显的不严谨感。叠加 footer 那个**硬编码 `${31}`** (一旦目录变动就静默说谎,
正是 AGENTS.md 记过的字面量埋雷)。修法 S 级: footer 换动态计数 + 统一术语 (distinct
floorplan vs model-year configuration 各有其名), 应在视觉打磨之前先做。
