# Stream 1 — Product & UX / 功能缺口分析

**作者:** Specialist 1（Product & UX / feature-gap analyst）
**日期:** 2026-06-19
**基线:** brief `upgrade-2026-06-19-brief.md` + 实际代码巡检（render.mjs / explore.mjs / collections.mjs / share.mjs / app.js 3411 LOC / upgrades.mjs / campsite-fit.mjs / maintenance.mjs）
**方法:** 先读 brief 与既有 UX 结论（round2-summary、ux-panel-review），再逐文件核对**当前真实实现**，区分「已上线」与「真正还缺」。所有提案严守铁律:无商业/联盟/预订、可溯源、功能性图形仅 inline SVG、静态站、防 GFW。

---

## 0. 核对结论:已上线 vs 仍缺(避免重造轮子)

巡检确认 **已 SHIPPED**(勿当新点子):
- **导航 6→3 合并已落地** — render.mjs `NAV_ITEMS` 现为 Explore(index 中枢) / Campsites / Upgrades / Maintenance(实为 4 项;Compare/Community/Campgrounds map 降为 footer)。ux-panel-review 的 6→4 方案已执行。
- **Explore hub 段控**(By family ↔ All floorplans)、family-first 默认视图、hash 深链(`#families`/`#all`、`#all&type=motorhome`)— 已在 `renderIndex` + app.js `exploreHub` IIFE 落地。
- **详情页四大工具**:Tow-safety calc(3-check)、Fuel cost、Payload/packing、Off-grid endurance — 全部 server-render + client 重算 + 方法 `<details>` + 数据岛,honesty contract 到位。
- **Compare 选择盘**:explore 卡片 `Compare` checkbox → `cmp-bar` → compare.html,sessionStorage(`ax-compare`)承载。
- **Campsites/Campgrounds**:MapLibre 自托管、collections rail(6 镜头,collections.mjs)、length-fit、live recreation.gov、saved shortlist(`cg.saved` localStorage)、share-by-URL(share.mjs 完整 hash 往返)。
- **Maintenance**:cadence/severity filter、**my-rig**(axle/heater/battery)、DIY/Shop 年度预算 rollup、checklist 模式(`maintenance.done`)、compact/print。
- **Upgrades**:consensus 分级(●●●○)、Factory/Aftermarket、fits(trailer/coach)、use-case filter lens、来源契约。

巡检确认 **仍缺(真正的 gap)**:
- ❌ **无 "Which Airstream for me" quiz / 引导式选车**(grep 零命中)。
- ❌ **无 Total-Cost-of-Ownership(TCO)视图**(零命中;唯一成本是 maintenance 年度预算 rollup 和 fuel 单程估算,二者割裂)。
- ❌ **无 route / 行程可行性规划**(零命中;campgrounds 是单点查询,无多点串联)。
- ❌ **无 onboarding / 新车主首程流程**(零命中)。
- ❌ **Explore↔Upgrades↔Maintenance 零跨链** — 详情页只链回 `index.html#all`(tow 匹配),不链 Upgrades 也不链 Maintenance;Upgrades 卡片不按车型推荐;Maintenance my-rig 与某台已存车型无关联。
- ❌ **无持久化「我的车」概念** — 三套独立、互不相通的存储:Compare 用 `sessionStorage`(关页即失)、Campgrounds 用 `cg.saved`、Maintenance 用 `maintenance.rig`。用户在每个工具里反复重述自己的车。
- ❌ **Explore 筛选维度仍薄** — 见 §1 友A;tag chips 实测仍近乎无用。
- ❌ **Explore 筛选态不可分享/深链** — campgrounds 有完整 share.mjs,explore 只落 localStorage(`explore.prefs`),刷新/发链即丢筛选态。

---

## 1. 用户旅程 × 摩擦点(具体到页面/工具/交互)

### 旅程 A — 选车的 shopper(dreamer → spec → compare)
**当前路径:** index.html(family grid)→ 段控切「All floorplans」→ tow matcher + 搜索/排序/筛选 → 勾 Compare → compare.html。骨架已不错。

**真实摩擦点:**
- **A1 · tag chips 近乎无信息量(brief 怀疑已实测证实)。** 跑 `trailers.json` 实数:`off-grid 59/59 (100%)`、`family 57/59 (97%)`、`full-time 26/59`、`national_parks 16/59`、`solo 15/59`、`luxury 14/59`、`couples 2/59 (3%)`。前两个 chip 点了等于没点;`couples` 只命中 2 台 — 而 `filterExplore`/`exploreTags` 仍把它们当一等公民展示在 `.xc-tags`。**这是 round2 P1-2 点过、至今未修的同一问题。**
- **A2 · 缺核心数值筛选维度。** explore.mjs `filterExplore` 支持 year/q/sleepsMin/msrpMax/tags/towRating,但**客户端 UI(app.js explore IIFE)只暴露** search / sort / year / sleeps / tow / type — **没有价格区间滑杆、没有长度区间、没有车系(family)筛选**。价格跨度 $54.9k–$222.9k、长度 16–33ft 是选车最硬的两个维度,却只能靠 sort 间接逼近。
- **A3 · 筛选态不可分享。** explore 只 `Store.set('explore.prefs')`,刷新保留、但**发不出去**:把「半吨皮卡能拖的、睡 4 人、$120k 以内」这套筛选发给配偶 = 不可能。campgrounds 早有 share.mjs 范式,explore 没接。
- **A4 · Compare 用 sessionStorage,关页即失。** `cmpGet/cmpSet` 用 `sessionStorage`,而 campgrounds shortlist 用 localStorage。shopper 今天勾 3 台、明天回来 → 没了。体验不一致且违背「shortlist 应持久」直觉。
- **A5 · tow matcher 与 sleeps/价格不联动呈现。** tow 把 over 车型「dimmed 不 hide」很好,但结果摘要只说「X of Y 安全匹配」,无法叠加「且在预算内」的复合判断。

### 旅程 B — 全新车主(brand-new owner)
**当前路径:** 几乎没有为他设计的入口。Maintenance 页是唯一相关,但它是一张「全量日历」,不是「你刚提车,先做这 5 件」。

**真实摩擦点:**
- **B1 · 无 onboarding / 首程清单。** grep `new owner|first-owner|onboard|delivery day|PDI` 零命中。新车主最焦虑的「提车验收(PDI)该查什么、第一次 towing 前必做、第一次 boondock 前怎么装水排污」全无引导。
- **B2 · maintenance 「my-rig」与「我买的那台」脱节。** my-rig 让用户手选 axle/heater/battery 三个维度 —— 但用户刚提车未必知道自己是 Nev-R-Lube 还是 E-Z Lube。如果系统知道他的车型(见 §2 「我的车」),这三项本可自动预填。
- **B3 · 工具散落,无「针对我这台车」的聚合页。** off-grid/payload/tow/fuel 四工具都在**详情页**内,但车主提车后很少再回到「目录详情页」—— 他需要的是一个「我的 Globetrotter 27FB:它能拖吗/能装多少/能离网几晚/该保养啥/该升级啥」的单一主控页。目前不存在。

### 旅程 C — trip planner(已有车,规划出行)
**当前路径:** Campsites/Campgrounds map → length-fit → live availability → saved shortlist。单点查询体验已强。

**真实摩擦点:**
- **C1 · 无多点行程串联。** campgrounds 是「找一个营地」,不是「从 A 到 B 沿途停哪几晚」。无 route、无里程、无「这条线每晚营地是否 fit 我的 25ft」串联。grep `route|itinerary` 零命中。
- **C2 · fuel 估算与行程脱节。** fuel tool 在**详情页**、按单程固定里程估;trip planner 在 campsites 页。规划一条 800mi 行程时,无法把「这趟油费」带进来。
- **C3 · saved 营地与 saved 车型不互通。** `cg.saved` 和 explore 的 compare 选择是两套孤立存储,无「我的行程 = 我的车 + 这几个营地」的组合概念。

### 旅程 D — DIY maintainer(动手保养/改装)
**当前路径:** Maintenance(cadence/severity/my-rig/预算/checklist)+ Upgrades(consensus/fits/use-case)。两页各自都很完整。

**真实摩擦点:**
- **D1 · Maintenance 与 Upgrades 零跨链。** 看完「每年要查 propane 检漏」,旁边没有「→ 相关升级:更好的 LP 检漏器」;看完某升级,没有「→ 装它后新增的保养项」。两个最成熟的 owner 页彼此不知道对方存在。
- **D2 · Upgrades 不按车型/离网能力推荐。** upgrades.json 的 item 有 `fits`(trailer/coach)和 `useCases`,但**没有按某台车的 `offGridScore`/`solarW`/`batteryKwh` 给出「你这台 offGridScore=42、无 factory solar → 最该上便携太阳能/锂电」的确定性规则推荐**。这正是 round2 P1-1(Explore↔Upgrades 联动)点名、至今未做的最高杠杆项。
- **D3 · checklist 进度与「我的车」无关。** `maintenance.done` 是全局勾选,不绑定具体某台车;有两台车的用户无法分别跟踪。

---

## 2. 提案(每条:是什么 / 解决哪条摩擦 / 工作量 S·M·L / 依赖 / 铁律风险 / 第一步 / 新 vs 已上线)

> 总主线:**当前站点已从「目录」升级成「一组孤立的好工具」。下一跃迁 = 把工具串成「我的车」中心的连贯旅程。** 这是所有提案的统一逻辑,也是最高杠杆。

---

### 🟢 S 档(低工作量,先做)

**P1 · 修 Explore tag chips(剔除死 chip + 校准)** — 〔解决 A1〕
- **是什么:** 移除/降级 `off-grid`(100%)与 `family`(97%)两个零信息 chip;`couples`(2 台)等极稀疏 tag 改为不单独成 chip 或合并。`exploreTags()` 加一条「命中率 >90% 或 <5% 不进 chip 行」的规则,逻辑集中在 explore.mjs(已是单一来源)。
- **工作量:** S **依赖:** 无 **铁律风险:** 无。
- **第一步:** 在 `exploreTags(trailers)` 内按命中率过滤;同步更新依赖 tag 行的快照测试。
- **状态:** 🆕 NEW(round2 提过、未做)。

**P2 · 修 footer 过期 AI-imagery 免责声明** — 〔credibility / brief KNOWN STALE〕
- **是什么:** render.mjs:92 + motorhome-render.mjs:64 + README:51 仍写「Some imagery is AI-generated and labeled accordingly」,与现行「无 AI 功能图、全真实照片/手绘 SVG」政策**自相矛盾**,对 credibility-first 站点是自毁。改为如实陈述(全部为真实 CC 照片 + 手绘 SVG)。
- **工作量:** S **依赖:** 无 **铁律风险:** 无(反而是修复铁律#3 的文案漂移)。
- **第一步:** 三处文案统一替换,加一条测试断言 footer 不含 "AI-generated"。
- **状态:** 🆕 NEW(brief 已点名,快赢)。

**P3 · Explore 筛选态深链(仿 share.mjs)** — 〔解决 A3〕
- **是什么:** 把 explore 的 `state{q,sort,year,sleeps,tags,tow,type}` 编进 URL hash,完全复刻 campgrounds 的 share.mjs 纯函数 + 往返测试范式。让筛选结果可发送/可收藏。
- **工作量:** M(逻辑 S,但要新建 explore 版 encode/decode + 测试,故偏 M)**依赖:** 无(范式现成)**铁律风险:** 无。
- **第一步:** 新建 `src/lib/explore-share.mjs`,encodeView/decodeView 镜像 share.mjs,app.js explore IIFE 接 hash 读写。
- **状态:** 🆕 NEW(round2 P1-3,未做)。

**P4 · Compare shortlist 改用 localStorage(与 campgrounds 一致)** — 〔解决 A4〕
- **是什么:** `cmpGet/cmpSet` 从 `sessionStorage` 改 `localStorage`(沿用 `Store` 包装),让勾选的车型跨会话持久,与 `cg.saved` 行为统一。
- **工作量:** S **依赖:** 无 **铁律风险:** 无。
- **第一步:** 改 CMP_KEY 存储后端为 `Store`;保留 3 台上限。
- **状态:** 🆕 NEW。

---

### 🟡 M 档(中工作量,高价值)

**P5 · ⭐「我的车」轻量身份(贯穿全站的 anchor)** — 〔解决 B2/B3/C3/D2/D3,是 P6–P9 的基座〕
- **是什么:** 一个 localStorage 的「我的车 = slug + 派生 spec」概念。用户在任意详情页点「设为我的车」,即把该 floorplan 的 `offGridScore/solarW/batteryKwh/gvwr/axle 类型/heater 类型/lengthFt` 存下。随后:
  - Maintenance my-rig 自动预填(B2);
  - Upgrades 显示「针对你这台的推荐」(D2);
  - Campgrounds length-fit 自动用你的车长(C3);
  - 详情工具默认场景以「我的车」为准。
  - **纯客户端、纯本地、不外发** — 不碰任何后端/商业铁律。
- **工作量:** M **依赖:** 统一存储键(可顺带统一 P4)**铁律风险:** 无(本地状态,无 PII 外发、无 commerce)。
- **第一步:** 定义 `Store` 键 `ae:myrig`(slug + 派生字段快照);详情页 head 加「设为我的车」按钮 + 一个全站 mini 横幅显示当前车。
- **状态:** 🆕 NEW(站点目前三套孤立存储的根因)。

**P6 · ⭐ Explore↔Upgrades 确定性联动(round2 P1-1,最高杠杆)** — 〔解决 D2〕
- **是什么:** 用已有 `offGridScore`/`solarW`/`batteryKwh`/`tags` 驱动**规则式、可解释、不编造**的「这台车最该上的升级」。规则示例(全确定性):`solarW==0 → 便携/factory 太阳能`;`offGridScore<50 → 锂电升级`;`fits 匹配 trailer/coach`。在详情页加「Popular mods for this floorplan →」区块,指向 upgrades.html 锚点 + 过滤态。
- **工作量:** M **依赖:** upgrades.json 的 `fits`/`useCases`(已有);最好叠加 P5「我的车」**铁律风险:** 需守住「站内推荐 ≠ 售卖」;不得加 buy 按钮/联盟链;推荐理由必须 spec 派生且可解释,不可出现「我们觉得你会喜欢」式黑箱(brief 铁律#2)。
- **第一步:** 在 explore.mjs/upgrades.mjs 间加纯函数 `mddsForTrailer(t, upgrades)` 返回规则命中清单 + 理由字符串;先写单测锁规则,再渲染。
- **状态:** 🆕 NEW(round2 P1-1 点名,两个最强 tab 至今零联动)。

**P7 · Explore 价格/长度区间 + 车系筛选** — 〔解决 A2〕
- **是什么:** 客户端补 price range、length range 双滑杆 + family(车系)多选,复用 explore 卡片现成 `data-msrp/data-length/data-model` 管线,无新数据。filterExplore 已支持 msrpMax,补 min/length/family 即可。
- **工作量:** M **依赖:** P1(清理 tag 后腾出筛选区空间)**铁律风险:** 无(MSRP 作上下文展示 OK,非购买漏斗)。
- **第一步:** explore.mjs `filterExplore` 加 `msrpMin/lengthMin/lengthMax/families[]`;app.js 加对应控件 + 复用 `apply()`。
- **状态:** 🆕 NEW(round2 P1-2,未做)。

**P8 · ⭐ 跨工具:「我的车」主控页 / detail 内聚合 + 跨链** — 〔解决 B3/D1〕
- **是什么:** 两种落法二选一(建议先做轻量版):
  - **轻量(推荐先做):** 在详情页底部加一条「带着这台车继续 →」横条,链向:Upgrades(已过滤为该车推荐,接 P6)/ Maintenance(my-rig 预填,接 P5)/ Campgrounds(车长预填 length-fit)。把现有四工具从「孤岛」缝成旅程。
  - **重量(可选后续):** 一个 `/my-rig` 聚合页,把 off-grid/payload/tow/fuel/保养/推荐升级 汇总到「我的 Globetrotter 27FB」单页。
- **工作量:** 轻量 M / 重量 L **依赖:** P5(我的车)+ P6(升级推荐)**铁律风险:** 无。
- **第一步:** 详情页 `renderDetail` 末尾加跨链横条(纯静态 href + hash 参数),无需 JS 即可工作。
- **状态:** 🆕 NEW(ux-panel-review P2「detail↔where-it-fits↔mods」点名,未做)。

**P9 · Maintenance↔Upgrades 双向跨链** — 〔解决 D1〕
- **是什么:** 在 maintenance.json task 与 upgrades.json item 间加可选 `relatedUpgrades`/`relatedMaintenance` 引用字段(验证器强制引用必须解析到真实 id,沿用现有 validate 契约)。渲染为卡片内「相关」小链接。
- **工作量:** M **依赖:** 两数据集加交叉引用字段 + 验证器扩展 **铁律风险:** 无(纯内部链接,可溯源不受影响)。
- **第一步:** 先在 validateMaintenance/validateUpgrades 加「relatedX 必须存在」校验,再小批量人工填几条高置信关联(如 propane 检漏 ↔ LP 检漏器)。
- **状态:** 🆕 NEW。

---

### 🔴 L 档(大工作量 / 高风险,需慎评)

**P10 · 引导式「Which Airstream for me」quiz** — 〔解决 A 旅程入口、dreamer 转化〕
- **是什么:** 3–5 题(拖车头能力/睡几人/预算区间/离网 vs 营地公园/全职 vs 周末)→ 用**纯确定性规则**(全部映射到现有 spec 字段)输出 2–3 台推荐 + 解释,落到 explore 过滤态(接 P3 深链)。
- **工作量:** L **依赖:** P3(深链)+ P7(筛选维度)**铁律风险:** ⚠️ 中。必须是**透明、spec 派生、可解释**的规则;一旦做成黑箱「猜你喜欢」或偷偷导向某车 = 触碰 brief 铁律#2(可溯源)与「无购买漏斗」精神。ux-panel-review 也专门警告过「闻起来像 buy-funnel 的 gimmick」。保留前提:每条推荐都摊开「为什么 = 你的 tow 7700lb ≥ 这台 GVWR 6800lb」。
- **第一步:** 先写纯函数 `recommendTrailers(answers, trailers)` + 单测锁定输入→输出,UI 最后做。
- **状态:** 🆕 NEW(brief 候选项;建议作为 P5+P7 之后的「皇冠」,不要先做)。

**P11 · Route / 多点行程可行性规划** — 〔解决 C1/C2〕
- **是什么:** 让用户串联多个已存营地 → 显示总里程、每晚营地是否 fit 我的车长、整程油费(复用 fuel 模型 + campsite-fit)。
- **工作量:** L **依赖:** P5(我的车)+ 路由/距离能力 **铁律风险:** ⚠️ 中-高。**真正的风险在「可行性」而非铁律**:(a)真实路网路由需外部服务,与「防 GFW / 无外部运行时依赖」铁律#5/#6 冲突 —— 若用 OSRM 类需自托管,工程量大;(b)纯 haversine 直线距离会给出**不诚实的里程**,踩铁律#2(准确性)。**建议:除非能自托管路由或明确降级为「直线估算并显式标注」,否则不做。** 这是四个候选里性价比最低、最易踩线的一项。
- **第一步:** 先验证是否有 China-robust 的自托管路由方案;无则降级为「营地序列 + 直线里程(显式标注非驾驶距离)+ 整程油费」的诚实弱版。
- **状态:** 🆕 NEW(brief 候选;**建议暂缓**,优先级最低)。

**P12 · Total-Cost-of-Ownership(TCO)视图** — 〔解决成本信息割裂〕
- **是什么:** 把已有的两块成本(Maintenance 年度预算 rollup + Fuel 单程估算)+ MSRP 上下文,聚合成「拥有这台车一年大概花多少」的诚实视图。**不含**购买/融资/折旧漏斗(那会踩 commerce 铁律)。
- **工作量:** L(诚实地做需新增保险/折旧/营地费均值等数据,每项都要可溯源)**依赖:** maintenance budget(已有)+ fuel(已有)**铁律风险:** ⚠️ 高。**TCO 极易滑向 finance 漏斗**(brief 铁律#1 明确禁 purchase-price funnel)。保险/折旧数字若无权威源 = 踩铁律#2。**建议:仅做「运营成本」窄版**(保养 + 油费 + 营地费均值,全可溯源),**显式不碰购买/折旧/融资**,并改名「Yearly running cost」避免 TCO 的金融暗示。
- **第一步:** 先只缝合现有 maintenance budget + fuel 两个已落地模块到一个「年度运营成本」卡片,营地费用 campgrounds 现有 nightly fee 均值(已是铁律允许的唯一价格)。
- **状态:** 🆕 NEW(brief 候选;建议做**窄版运营成本**,不做金融 TCO)。

---

## 3. 优先级建议(按价值÷工作量 + 依赖链)

**最高杠杆主线:P5「我的车」→ P6 升级联动 → P8 跨链。** 这三条把「孤立工具集」缝成「以我的车为中心的旅程」,直接命中 round2 至今未做的 P1-1,且零铁律风险。

**推荐落地批次:**
1. **批次 1(快赢,纯 S):** P2(修 AI 免责声明)+ P1(修死 tag)+ P4(Compare 持久化)。低风险、修「线上自相矛盾」,先清债。
2. **批次 2(基座 + 最高杠杆):** P5(我的车)→ P6(Explore↔Upgrades 联动)→ P3(Explore 深链)。
3. **批次 3(补齐 + 缝合):** P7(价格/长度/车系筛选)+ P8(跨工具横条)+ P9(Maintenance↔Upgrades 跨链)。
4. **批次 4(慎评,需先验证可行性/铁律):** P12 窄版「年度运营成本」→ P10 quiz(透明规则版)。**P11 route 建议暂缓**,除非自托管路由可行。

## 4. 诚实风险标注(可能踩铁律的项)

| 提案 | 风险铁律 | 说明 / 守线条件 |
|---|---|---|
| **P10 quiz** | #2 准确性 / 无 buy-funnel | 必须透明、spec 派生、每条推荐摊开「为什么」;禁黑箱「猜你喜欢」 |
| **P11 route** | #5 无后端 / #6 防 GFW / #2 准确性 | 真实路由需外部服务(踩 #5/#6);haversine 直线里程不诚实(踩 #2)。**建议暂缓** |
| **P12 TCO** | #1 无 commerce/finance | TCO 极易滑向金融漏斗。**只做「运营成本」窄版**(保养+油费+营地费,全可溯源),禁购买/折旧/融资 |
| P6 升级联动 | #1 无 commerce | 站内推荐 OK,但禁 buy 按钮/联盟链;理由须可解释 |

其余提案(P1–P5、P7–P9)经核对**无铁律风险**:纯客户端本地状态、复用现有可溯源数据、无外发、无 commerce、功能图形仍为 SVG。

## 5. 一句话总结

当前站点的工具质量已经很高(tow/payload/off-grid/fuel/maintenance/upgrades 各自都诚实且完整),**真正的缺口不是「再加一个工具」,而是「把工具串起来」**:① 修掉几处仍在「线上说谎」的小债(死 tag、过期 AI 免责);② 立一个「我的车」本地 anchor;③ 用它驱动 Explore↔Upgrades↔Maintenance↔Campgrounds 的确定性跨链。quiz/route/TCO 三个 brief 候选里,quiz 可做(透明规则)、TCO 只做运营成本窄版、route 建议暂缓。
