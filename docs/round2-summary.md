# Round-2 全站审计 — 汇总与优先级方案

**协调者:** 升级小组(5 视角并行)
**日期:** 2026-06-16
**基线:** HEAD `0e24a8f`,280 测试全过,3 tab(Explore / Campgrounds / Upgrades),59 floorplan 详情页,线上 https://airstream-explorer.pages.dev
**输入:** `docs/round2-audit-{data,explore,campgrounds,upgrades,visual}.md`(5 篇)
**性质:** 纯方案,未改任何代码/数据。所有建议均防 GFW、不碰商业/联盟/预订铁律、数据可溯源。

---

## 0. 跨视角收敛信号(多个独立视角同时点名 → 最强证据)

| 议题 | 谁点名 | 收敛强度 |
|---|---|---|
| **营地照片 CloudFront 外链 → 中国大面积裂图,且 image proxy 从未落地** | Campgrounds(G1)+ 视觉(G1+G2)+ 数据(缺口) | ★★★ 三视角独立判为最高优先 |
| **数据准确性硬伤(过期价 / 错误标配 / 垃圾极值)** | 数据(D1/D2/S2)+ Upgrades(D1–D3) | ★★ 两视角,踩"可溯源"底线 |
| **Explore↔Upgrades / Explore 筛选体验割裂** | Upgrades(G1)+ Explore(D1/G1/G2) | ★★ 两视角指向同一"目录→工具"升级 |
| **已在 payload 却没用的字段(amenity / off-grid nights / activity)** | Campgrounds(彩蛋 G3/G4)+ Explore | ★ 零新数据即可解锁 |

---

## 1. 总优先级排序(价值÷工作量,可落地顺序)

### 🥇 P0 — 立即做(高价值 / 低风险 / 踩铁律或底线)

**P0-1 · 营地照片同源 image proxy(Cloudflare Function)** 〔Campgrounds G1 + 视觉 G1〕
- **问题:** 96%(2460/2561)营地卡片 `<img>` 直连 `cdn.recreation.gov`(实测 = CloudFront/S3 us-east-1),是全站**唯一仍违反"防 GFW"铁律的运行时外链**;中国用户整个 finder 视觉残缺。panel-5 已把完整方案(同源代理 + edge 缓存 + licensing + guardrail + 5 步迁移 + 代码 sketch)研究透,但实测 `functions/` 目录**根本不存在** —— round-1 全部研究里唯一"已拍板却零落地"的 China-critical 项。
- **动作:** 落地 `functions/` 同源代理 + edge 缓存;`<img>` 改指代理路径。
- **价值 ★★★★★ / 工作量 M / 不碰铁律(代理非售卖)**

**P0-2 · 营地图优雅降级(onerror 占位)+ décor 图重转码** 〔视觉 G1+G2〕
- **问题:** 在 P0-1 落地前(或代理失败时),裂图应变"有意的无图"——加 `onerror` → 编辑级渐变占位。另:décor 图 11MB(全站图片 41%)是 600² 渲染成 84px 的纯浪费像素。
- **动作:** (a) 营地图 `onerror` 占位;(b) décor 重转码到 ~200px,立省 ~9.5MB。
- **价值 ★★★★☆ / 工作量 S / 不碰版权不增体量**
- **次序:** 可与 P0-1 并行;onerror 是 P0-1 的安全网,应先上。

**P0-3 · 数据准确性硬伤批量校准** 〔数据 D1/S2 + Upgrades D1–D3〕
踩"数据可溯源"底线,逐条勾兑后修正:
- **solarStandard 标配/选配错误** 〔数据 D1〕:Bambi / Caravel / Flying Cloud 标 `solarStandard:true`,但 airstream.com 当前规格页对这三线明确标 "(Optional)";同仓 upgrades.json 正文已正确写 optional —— 两文件自相矛盾。⚠️ **需先精确重数受影响行**:数据 agent 称"12 行",但实测 `solarStandard=true` 共 43 行,仅 Bambi(6)+Caravel(6)+Flying Cloud(10)=22 行(年份双胞胎已翻倍)。**改前必须逐 slug 列清单核对**,勿照搬"12"。
- **2026 MSRP 偏离** 〔数据 S2〕:8 个 2026 行价格偏离官方当前价(International 27FB +$11,245 最离谱);且免责 specNote **加错对象**——加在未编造的 4 行,真正过期的 8 行反而没标。需重新对齐 specNote 与实际过期行。
- **Upgrades 错价** 〔Upgrades D1–D3〕:Equal-i-zer 入门标 $500(实际 $600–950)、预算锂电标 $230–280/100Ah(实际 ~$170–250)。round-1 panel-accuracy 已点名未落实。
- **价值 ★★★★☆ / 工作量 S–M / 是底线问题**

**P0-4 · "floorplan" 术语自相矛盾 + 硬编码字面量** 〔视觉 D1〕
- **问题:** 59 详情页只有 31 个 distinct floorplan(其余 2025/2026 年份双胞胎),全站把 31 和 59 **都叫 "floorplans"**(首页 hero 说 31、explore 区说 59);且 footer 的 31 是**硬编码 `${31}`**(目录一变就静默说谎,正是 AGENTS.md 记过的字面量埋雷)。
- **动作:** 统一术语(model/floorplan/年份变体 三层命名),footer 数字改为派生计算。
- **价值 ★★★★☆ / 工作量 S / 应在任何视觉打磨之前先做**

---

### 🥈 P1 — 高价值升级(把站点从"目录"升级成"工具")

**P1-1 · Explore 车型 ↔ Upgrades 联动** 〔Upgrades G1,ux panel round-1 早点名〕
- 用已有 `offGridScore`(39–93)/`solarW`/`batteryKwh`/`tags` 驱动**确定性、可解释、不编造**的规则式"这台车最该上的改装"推荐。两个最强 tab 至今零联动。最高杠杆,站内推荐非售卖、不碰铁律。
- **价值 ★★★★★ / 工作量 M**

**P1-2 · Explore 筛选维度大修** 〔Explore D1 + G2〕
- 现有 tag chip 形同摆设:"Off-grid" 命中 59/59、"Family" 57/59(点≈没点),"Couples" 仅 2 台;而**价格区间($54.9k–$222.9k)、长度、家族**三大关键维度全缺。
- **动作:** 剔除/校准无效 tag(S)+ 补价格/长度/家族筛选(M),全程复用现有 `data-*` 客户端管线。
- **价值 ★★★★★ / 工作量 S+M / 零铁律风险**

**P1-3 · Explore 筛选结果可分享/深链** 〔Explore G1〕
- campgrounds 已有完整 hash 分享(`share.mjs`),Explore 的筛选/排序/tow 状态只落 localStorage、刷新即丢、发不出去 —— 体验割裂。仿 `share.mjs` 把视图态编进 URL hash。
- **价值 ★★★★☆ / 工作量 M**

**P1-4 · Campgrounds 实时层降级 + 走同源代理** 〔Campgrounds top-2〕
- live `/api/search`(moveend)与 availability 抽屉直连 recreation.gov、无 circuit-breaker,中国每次拖地图吊死 9–12s。**关键纠正:这两个公共端点都不需要 RIDB key**(app.js 现就在无 key 调用),可与 P0-1 图片走**同一个**同源 CF 代理;panel-5"blocked on API key、推未来"的归类是过时假设,应推翻。
- **动作:** 至少加会话级 circuit-breaker + 区域降级文案;最好复用 P0-1 代理。
- **价值 ★★★★☆ / 工作量 S–M / China-critical**

---

### 🥉 P2 — 高性价比"已有数据未用"(零/低新数据)

**P2-1 · amenity 字段做筛选 checkbox** 〔Campgrounds 彩蛋 G3〕
- `ds/dw/sh/fl/ac`(dump/饮用水/冲水厕所/无障碍)五字段**已在 ship 的 payload 里**,却既不渲 pill 也不能筛。加几个 checkbox 解锁 RVer 最高频筛选。**价值 ★★★★☆ / 工作量 S / 零新数据**

**P2-2 · finder 卡片接入 off-grid「nights here」** 〔Campgrounds G4〕
- off-grid 估算引擎已存在(仅 detail 页用),finder 卡片复用即可。**价值 ★★★☆ / 工作量 S**

**P2-3 · 地图三连(fit-aware 聚合 / hover 联动 / fly-to)** 〔Campgrounds G7〕
- 实测均未 ship。**价值 ★★★☆ / 工作量 M**

---

### P3 — 内容深度与打磨(审美风险需把控)

- **P3-1 · Upgrades 内容深度** 〔Upgrades G2–G5〕:加 `tradeoff` 反方观点字段、安装难度 DIY-vs-shop 维度(接 filter lens 第4维)、climate section 补厚、单卡源数量可见化。**价值 ★★★☆ / 工作量 S–M**
- **P3-2 · 编辑/动效层** 〔视觉 G3〕:thread-4 已规划未上线的 view-transition、scroll-reveal、统一 type token、text-wrap(全防 GFW、零库)。**价值 ★★★☆ / 工作量 M**
- **P3-3 · 无障碍收口** 〔视觉 G4〕:skip-link、campgrounds/compare 缺 `<main>`、卡片链接 focus-visible、reduced-motion 收口、copper 小字未过 AA 4.5、hub 双 h1/双 main。**价值 ★★★☆ / 工作量 S–M / 底线类**
- **P3-4 · 性能尾部** 〔视觉 G5/G7/G8〕:营地地图懒加载再推迟近 1MB、字体 preload、MapLibre CSS 渲染阻塞、移动端列表密度。**价值 ★★☆ / 工作量 S–M**
- **P3-5 · NP 编辑 guide 页** 〔Campgrounds G6〕:审美风险高,**必须排在 P0-1 图片管线之后**再考虑。**价值 ★★★☆ / 工作量 L / 审美高风险**

---

## 2.【数据问题-需校准】完整清单

| 编号 | 文件 | 问题 | 怀疑/核实 | 动作 |
|---|---|---|---|---|
| D-1 | trailers.json | `solarStandard:true` 误标(Bambi/Caravel/Flying Cloud) | 已 curl `__NUXT_DATA__` 核实为 Optional;与 upgrades.json 矛盾 | 逐 slug 重数后改 false(⚠️"12 行"待核,实测 true 共 43 行) |
| D-2 | campgrounds.json | `maxLengthFt`/`trailerMaxFt` 含 RIDB 垃圾极值(152 个 >100ft,极端 500/255/227ft) | RIDB 把"无限制/未知"错填超大数,破坏"我的 25ft 装得下吗"核心用例 | 长度 cap 上限或置 null;fit 优先用自洽的 `trailerLenHistogram` |
| D-3 | campgrounds.json | `reservable` 全 2561 恒 true(采集只留可订) | 实测确认 | 作筛选维度零信息量,勿做 reservable filter |
| D-4 | trailers.json | 8 个 2026 MSRP 偏离官方;specNote 加错对象 | International 27FB +$11,245 最离谱 | 重对齐价格与 specNote 标注行 |
| D-5 | upgrades.json | Equal-i-zer / 预算锂电价格区间过期 | browser_search 2026-06 市价 | 更新区间 |
| D-6 | campgrounds.json | `activities` 大小写未归一;slim 只 ship top-4 activity | — | 任何 activity filter 必须 build 时 bake,不能客户端重算 |
| D-7 | trailers.json | 缺 REI Co-op Basecamp 20X、Pottery Barn SE(upgrades 文案已提及却无记录) | 特别版在 airstream.com 无独立 explore 页(404) | 补录需另找官方 landing/press 核实,**不可照搬** |

---

## 3.【已上线-跳过】(确认勿重复造轮子)

- **数据正面确认:** 全 59 行物理规格(UBW/GVWR/NCC/Hitch/Tank)精确匹配 airstream.com;`cccLb==gvwr−weight` 全成立;combined-tank 6 行处理正确;International 27FB/28RB **未互换**(中途误判已澄清);**tow-vehicles 11 车**内部自洽、sources 真实,**保持不动**;upgrades 价格相比 round-1 已基本修复、溯源充分;无 affiliate、价格统一标 "reference"——铁律合规。
- **已 ship 功能(勿当新点子):** fit-density 直方图(trailerLenHistogram)、MapLibre 聚合、localStorage shortlist+compare、实时 Recreation.gov 搜索+可订抽屉、距离/haversine、海拔分带、hookup 匹配、Collections rail(6 镜头)、deep-link(col=)、静态 fallback、Tow Safety Calculator、consensus tier、filter lens、官方 airstream.com 链接、自托管地图+字体+glyphs(防 GFW)、fingerprinted assets、CSP-safe vanilla JS、consensus/数据契约校验(validateUpgrades)。

---

## 4. 建议执行批次(若要落地)

1. **批次 A(数据底线,最快):** P0-3 + P0-4 + D 系列 —— 纯数据/文案,低风险,先把"线上说谎"修掉。
2. **批次 B(China-critical 基建):** P0-1 + P0-2 + P1-4 —— 一个同源 CF 代理同时解决图片与实时层,onerror 占位先行兜底。
3. **批次 C(目录→工具):** P1-1 + P1-2 + P1-3 + P2-1/P2-2 —— 复用现有客户端管线,把 Explore/Campgrounds 体验补齐。
4. **批次 D(打磨,审美把控):** P3 系列,P3-5 务必在批次 B 之后。
