# Round-2 全站审计 — Campgrounds Tab 视角

**视角:** Campgrounds tab(2561 营地库 + MapLibre 地图 + Collections rail + 实时 Recreation.gov 集成)
**HEAD:** 0e24a8f · **审计日期:** 2026-06-16 · **状态:** 仅方案,未改代码
**读过的代码:** `campgrounds.mjs`, `campgrounds-render.mjs`, `campsite-fit.mjs`, `collections.mjs`,
`availability.mjs`, `share.mjs`, `app.js`(campgrounds IIFE ~L878–2270)
**读过的文档:** `cg-panel-1..5`, `premium-features-research.md`

---

## 0. 现状速览(读代码确认)

**数据(`campgrounds.json`,2561 行,实测覆盖率):**

| 字段 | 覆盖 | 字段 | 覆盖 |
|---|---|---|---|
| lat/lon | 100% | hookups: none | 1905 |
| elevationFt | 100% | hookups: electric | 479 |
| price | 2468 (96%) | hookups: full | 171 |
| trailerLenHistogram | 2110 (82%) | hookups: 缺失 | 6 |
| hasPullThrough | 1108 | dumpStation | 582 |
| ampService | 562 | drinkingWater | 666 |
| accessibleSiteCount>0 | 1003 | showers | 483 |
| reservable=true | **2561 (100%)** | flushToilets | 486 |

**已 ship 且在客户端真正用到的:** 拖挂长度 per-site fit(histogram)、MapLibre GPU 聚合、
localStorage shortlist + 可折叠 Saved tray(对比表)、实时 Recreation.gov `/api/search`(moveend
z≥5,clip 到视口)、可订状态抽屉(month endpoint,per-site fit + hookup)、距离 haversine、
elevation 分带、hookup 匹配、off-grid `nightsHere`(**仅在 detail 页 cgCard**)、Collections
rail(6 镜头)、share hash(`col=`/`len=`/`map=` 等)、深链 `?len=&from=`、静态 fallback。

**关键观察(后面会引用):**
- `functions/` 目录**不存在** → panel-5 力荐的图片代理 **从未实现**。
- 实时层(search + availability)**直连 `www.recreation.gov`**,图片直连 `cdn.recreation.gov`
  (CloudFront)。**无任何 circuit-breaker / 区域降级 / 缓存代理。**
- slim record 已 ship 的 `ds/dw/sh/fl/ac`(dump/water/shower/flush/accessible)**在客户端
  既不渲染成 pill、也不做 filter** —— 白白占 payload。
- `app.js` 的 `card()`(finder 列表)**不显示 off-grid 估算**,只有 detail 页 `cgCard` 显示。

---

## 【真实缺口-建议做】(按价值排序)

### G1. 营地照片 image proxy(Cloudflare Pages Function)—— 中国可达性头号问题
- **问题/机会:** 96%(2460/2561)营地卡片 `<img>` 直连 `cdn.recreation.gov`(实测 = CloudFront +
  S3 us-east-1)。这正是已经两次击穿本项目的那类外部 CDN(CARTO 瓦片、Google Fonts 都因中国被
  墙/限速而改自托管)。panel-5 已把完整方案研究透(Option A:`functions/img/cg/[[path]].js`
  同源代理 + `caches.default` 边缘缓存,免费额度内),**但代码层面一行都没落地**(无 `functions/`)。
- **价值:** 极高。这是中国用户体验里**唯一仍在直连墙外 CDN 的视觉资源**;营地卡片没图 = 整个
  finder 看起来是半成品。研究、licensing(CC-BY,已带 credit)、guardrail 交互(白名单
  `/img/cg/` 或发绝对 origin URL)全部已在 panel-5 拍板,落地风险低。
- **工作量:** M(panel-5 已给出 5 步迁移路径 + sketch;主要是新建 Function + 改两处
  `REC_PHOTO_PREFIX` + guardrail 白名单测试 + dev 302 fallback)。
- **中国可达性影响:** **决定性正向。** 把被墙的 CloudFront hop 移到服务端(CF edge→AWS,不过
  GFW),浏览器只跟已证明可达的同源说话。
- **碰铁律?** 否。无商业/联盟,credit 已在,纯交付层 robustness。

### G2. 实时层(search + availability)也走同源代理 + circuit-breaker —— 纠正 panel-5 的误判
- **问题/机会:** 实时 `/api/search`(moveend)和抽屉 `/api/camps/availability/.../month` 都**直连
  recreation.gov**。在中国大概率每次 moveend 都吊死 9s(search timeout)/ 12s(month timeout)
  才 catch 到 `fallback`,且**没有 circuit-breaker** —— 用户每拖一次地图就再吊死一次,体验崩。
  抽屉则只会反复转圈→报错。
  **重要纠正:** panel-5 PART 2 把"live search"归类为"blocked on a RIDB API key",但 `app.js`
  现在调的 `www.recreation.gov/api/search` 和 availability `month` 端点**都不需要 key**(panel-2/3
  实测无 key 200)。所以一个同源 CF Function 代理这两个 JSON 端点**完全可行**,与图片代理同模式、
  同 origin、同样不引入墙内不可达依赖。panel-5 的"需要 key 故推后"是过时假设,应推翻。
- **价值:** 高。不做代理也至少要做**优雅降级**:(a) 一个会话级 circuit-breaker —— 连续 N 次
  live 失败就停掉 moveend 自动 fetch,改成手动"在此区域刷新实时数据"按钮 + 一句"实时数据来自
  Recreation.gov,你所在网络可能受限,已切换到缓存数据";(b) 抽屉报错文案点名"区域网络可能
  无法访问 Recreation.gov",而非只说"may be busy"。静态 2561 库 + per-site histogram 已经能独立
  支撑绝大部分体验,所以降级不掉关键功能。
- **工作量:** 降级版 S(circuit-breaker + 文案,纯客户端);代理版 M–L(两条 Function 路由 +
  CORS + 缓存策略;availability 不可永久缓存,需短 TTL)。
- **中国可达性影响:** 决定性正向 —— 这是实时功能在中国能不能用的根本。
- **碰铁律?** 否。代理仍只读公共数据、无商业;短 TTL 缓存不引入墙内不可达依赖。
- **细节:** availability 是时效数据,代理缓存 TTL 要短(分钟级),不能像图片那样 immutable。

### G3. 复用已 ship 但闲置的 amenity 字段做 filter + pill(零新数据)
- **问题/机会:** slim record 已经在 ship `ds`(dump)、`dw`(drinking water)、`sh`(showers)、
  `fl`(flush toilets)、`ac`(accessible count),**但客户端既不渲染 pill 也不能筛**。数据已经
  在 payload 里付了带宽,功能却为零。RVer 选营地三大高频问题正是"有没有 dump / 有没有水 /
  有没有冲水厕所"(panel-2 原话)。
- **价值:** 高(价值/工作量比最好的一项)。覆盖率不低:dump 582、water 666、shower 483、
  flush 486、accessible 1003。加几个 checkbox(同 `cg-pullthrough` 模式)+ 卡片 pill。
- **工作量:** S。filter 逻辑、pill 渲染、share hash key、测试都有现成范式可抄。
- **中国可达性影响:** 无(纯静态字段)。
- **碰铁律?** 否。
- **诚实守则:** 字段缺失的营地在勾选该 filter 时应**排除**(同 hookup filter 的"不猜匹配"做法),
  不能默认通过。

### G4. Finder 列表卡片也显示 off-grid「nights here」(boondocker 模式雏形)
- **问题/机会:** `nightsHere`(rig solar/battery/tank × 营地纬度 PSH)只在 **detail 页 cgCard**
  出现;**finder 列表 `card()` 完全没有**。脑暴里点名的"boondocker 模式"其实已经有了引擎
  (`campsite-fit.nightsHere` + hookup gate),只差把它接到 finder。当用户选了 rig 且营地
  `hookups === 'none'`(占 1905/2561!)时,在卡片上显示"~X 晚 off-grid · battery/water-limited"。
- **价值:** 高且**独一无二**(没有通用露营 app 知道你具体 rig 的电池/水箱/太阳能)。1905 个无
  hookup 营地是 boondocking 主战场,这把 dry-camping 从"无 hookup = 没标签"变成"无 hookup =
  你的 25FB 能撑 4 晚"。
- **工作量:** M(逻辑已存在并通过 parity 测试,主要是把 detail 的 offgrid 行搬进 finder
  `card()`,并加一个 finder filter "可 off-grid ≥N 晚")。
- **中国可达性影响:** 无(纯客户端 baked)。
- **碰铁律?** 否。复用现有 estimate 方法学 + 诚实标注 estimate。

### G5. 价格 filter(free / 便宜),org 管理机构 filter
- **问题/机会:** `price`(96% 覆盖)和 `org`(NPS/USFS/BLM/USACE…)字段都在,**都没做 filter**。
  org 目前只有 USACE 通过 collection `lk` 间接可达。价格区间("$0 免费 / <$25 / <$50")和按机构
  筛是 AllStays/Campendium 的常规且高频项。
  **注意:** `reservable` 虽然字段在,但实测 **100% 都是 true**(collect 只收可订营地),所以
  reservable 做 filter **无意义** —— 不要做。
- **价值:** 中。价格 filter 比 org filter 更高频。
- **工作量:** S(价格区间 select + org select,同现有 select 范式)。
- **中国可达性影响:** 无。
- **碰铁律?** 否(只展示已有价格,不涉及预订/交易)。

### G6. 国家公园锚定的编辑 guide 页(深化 `np` collection)
- **问题/机会:** `np` collection(118 营地)已能筛"国家公园内营地",但只是 chip,**没有编辑
  guide 页**。脑暴点名"NP 锚定 guide"。可做少量手工编辑页(Yosemite/Grand Canyon/Acadia…),
  串起园内营地 + rig-fit + dark-sky + off-grid 笔记,用 Fraunces/copper 编辑声线。panel-1 #6
  同向。
- **价值:** 中(品牌/编辑感强,但非核心工具价值)。
- **工作量:** L(手工编辑内容 + 新页模板 + 每条事实 source)。
- **中国可达性影响:** 内容静态无影响;**但若大量用园内营地照片,会放大 G1 的 CloudFront 问题** ——
  必须在 G1(图片代理)之后做。
- **碰铁律?** 否,但⚠️**审美风险高**:用户讨厌"太 AI"/通用感,编辑文案若是模板化生成会反噬。
  建议小批量、高打磨,否则别做。

### G7. 地图 premium 化三连(panel-4 QW,均未 ship,实测确认)
- **问题/机会:** 实测 `app.js` 无 `clusterProperties`、无 `setFeatureState`、无 `fitBounds/flyTo`。
  panel-4 的三个 QW 都还没做:
  - **G7a fit-aware clusters:** 现在 national zoom 所有聚合泡都是同色 copper,对一个"fit 工具"
    信息量为零。用 `clusterProperties` 聚合 fits/tight/no 计数 → 分色环。**工作量 M。**
  - **G7b list↔map hover/选中联动:** 现在列表和地图是单向冷关系。`setFeatureState` + `state.activeId`
    做悬停高亮 pin + 点 pin 滚动到卡片(Airbnb/Zillow 级交互)。**工作量 M。**
  - **G7c fly-to-state:** state select 代码注释自承"keeps map, filters list" —— 选州不动地图。
    build 时算每州 centroid/bbox(已有 lat/lon),选州/collection 时 `fitBounds`。**工作量 S–M。**
- **价值:** 中(premium 手感,非功能缺口)。三者都纯客户端、China-safe、降级干净。
- **中国可达性影响:** 无。
- **碰铁律?** 否。

### G8. 把 Saved shortlist 变成可分享(`saved=` param)
- **问题/机会:** Saved tray 已存在(对比表 + remove + clear),**但只能清不能发**。`share.mjs`
  无 `saved=` key。可仿 `compare()` 模块的 `?ids=` 模式,把 saved id 编进 URL,朋友打开即预填
  (panel-4 QW3)。
- **价值:** 中("发给我对象看"的社交时刻)。
- **工作量:** S(复用 compare 的 `?ids=` + 现成 clipboard `fallbackCopy`)。
- **中国可达性影响:** 无(纯 URL,无后端)。
- **碰铁律?** 否。

---

## 【数据问题-需校准】

### D1. activities 大小写重复 + slim 只 ship top-4 → 任何 activity filter 都会漏
- **问题:** 实测 activities 同时存在 `CAMPING`(1246)和 `Camping`(1059)、`FISHING`/`Fishing`
  等大小写双版本,**未归一**。且 slim record 的 `.a` 只 ship 前 4 个 activity(`campgrounds.mjs`
  `toClientRecord` 里 `slice(0,4)`)—— 这正是 collection 为何要 **build 时 bake `.cl`** 的原因
  (dark-sky 在客户端重算会漏)。
- **影响/校准:** 若要做"按 activity 筛"(G5 的延伸),**绝不能在客户端用 `.a` 重算**,必须像
  collection 一样 build 时 bake 成员;同时 build 端先把 activities 大小写归一,否则计数会重复。
- **碰铁律?** 否,纯数据卫生。

### D2. sort by "length" 与 live 行 fit 仍用 legacy 全设备 `maxLengthFt`(.m)
- **问题:** `campsite-fit` 已用 per-site histogram 算诚实拖挂 fit,**但** finder 的 sort
  `case 'length'` 仍排 `.m`(全设备 max,motorhome 主导,panel-3 §0.4 证明系统性高估);live API
  行(无 `.th`)的 fit 也回退到 `.m`。所以"按最大长度排序"会把 Gunter Hill(.m=138,实为公交
  数字)排到顶。
- **影响/校准:** 建议 sort `length` 改用 `trailerMaxFt`(`.tm`,已 ship)优先,`.m` 仅在缺
  `.tm` 时回退;或在 UI 标注该排序是"posted all-equipment max"。live 行无 per-site 数据这点本身
  诚实(已带 unverified),不强求。
- **碰铁律?** 否(反而更贴近"数据准确"铁律)。

### D3. 451 营地无 trailerLenHistogram(2110/2561 有)
- **问题:** 18% 营地 enrich pass 没拿到 per-site 拖挂数据,fit 显示 "unverified"。
- **影响/校准:** 这是**诚实的缺失**(代码已正确回退 unverified、不造假),不是 bug。可作为
  增量 enrich 的 backlog(补齐这 451 个的 `/campsites` 拉取),但优先级低,不影响铁律。
- **碰铁律?** 否。

### D4. full-hookup 仅 171,且联邦地以 electric-only 为主
- **问题:** `hookups: 'full'` 只 171/2561。collection `fh`(Full Hookups)label 171 是诚实的,
  但用户若期待"很多全 hookup"会落差 —— 这是联邦地数据本质(panel-2 已警告别承诺 full-hookup),
  非错误。
- **影响/校准:** 无需改;若 G3 加 hookup 相关文案,沿用 panel-2 的诚实框架("electric + dump"
  而非"full hookup")。
- **碰铁律?** 否。

---

## 【已上线-跳过】(确认已 ship,勿当新点子重复提)

- 拖挂长度 per-site fit(`trailerLenHistogram` % of sites)、`nationalFit` detail 头条 —— **已上线**
- MapLibre GPU 聚合(clustering)+ fit 配色点层 `cg-pts` —— **已上线**(但聚合泡未按 fit 分色 → 见 G7a)
- localStorage shortlist + 可折叠 Saved tray 对比表 —— **已上线**(但不能分享 → 见 G8)
- 实时 `/api/search`(moveend z≥5,clip 视口)+ live/fallback/static 来源标 —— **已上线**(但无
  China 降级/代理 → 见 G2)
- 可订状态抽屉(this/next weekend + next 30 days,per-site fit + hookup)—— **已上线**(同 G2)
- 距离 haversine、elevation 分带 filter、hookup filter、pull-through filter —— **已上线**
- Collections rail(6 镜头:ed 487 / np 118 / ds 78 / al 509 / lk 551 / fh 171)+ `col=` 深链 —— **已上线**
- off-grid `nightsHere`(纬度 PSH 精修)—— **已上线但仅 detail 页**(finder 列表没有 → 见 G4)
- share view hash(len/st/col/sort/q/hu/fo/map)+ 客户端 mirror + parity —— **已上线**
- 静态 fallback、`mapStub`、`showMapUnavailable`、WebGL 降级 —— **已上线**
- 自托管 MapLibre basemap + glyphs(无 CARTO/外部瓦片)—— **已上线**(China-safe 核心)

---

## 本视角 Top-2 发现

**① G1 —— 营地照片 image proxy(Cloudflare Function)从未落地。** panel-5 把完整方案
(同源代理 + edge 缓存、licensing、guardrail 交互、5 步迁移)研究得滴水不漏,但 `functions/`
目录根本不存在 —— 这是 round-1 研究里**唯一一个已拍板却零落地**的 China-critical 项。96% 营地卡片
仍直连被墙的 CloudFront,对中国用户而言整个 finder 视觉是残的。**最高优先级,低风险,不碰铁律。**

**② G2 —— 实时层在中国会吊死且无降级,且 panel-5 "需要 API key" 的判断是错的。** live search 和
availability 都直连 recreation.gov、无 circuit-breaker,在中国每次 moveend 吊死 9–12s 再 fallback。
关键纠正:这两个公共端点**都不需要 RIDB key**(app.js 现在就在无 key 调用),所以它们可以和图片
走**同一个同源 CF Function 代理**,panel-5 把 live search 推后到"需 key 的未来里程碑"是过时假设,
应推翻。退一步,哪怕不做代理,也必须加会话级 circuit-breaker + 区域降级文案,否则实时功能在中国
是净负体验。

**额外彩蛋(价值/工作量比最高):** G3 —— `ds/dw/sh/fl/ac` 五个 amenity 字段**已经在 ship 的
payload 里**却既不渲染也不能筛,加几个 checkbox(S 工作量)就能解锁 RVer 最高频的 dump/水/厕所
筛选,零新数据、零铁律风险。
