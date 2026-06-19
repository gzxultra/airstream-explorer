# Stream 2 — 数据深度 & 领域权威性分析

**Specialist:** Specialist 2 — Data depth & domain authority analyst
**Date:** 2026-06-19
**Workdirःं** ~/workspace/your_files/airstream-explorer
**Brief:** upgrade-2026-06-19-brief.md（NO commerce/booking/affiliate · accuracy-paramount · every-claim-sourced · no-AI-imagery · premium editorial · China-robust · static）

**本 stream 的目标:** 找出哪些数据能加深站点作为 reference 的**价值**与**权威性 (authority)**,且每一条都必须在"accuracy-paramount + every-claim-sourced"铁律下**可干净溯源、零编造**。每个提案附:是什么 · 价值对象 · 工作量 (S/M/L) · 具体来源 · 溯源风险 · 铁律风险 · 第一步。**凡是无法干净溯源的诱人想法,明确写出并拒绝。**

> 方法: 实测了 trailers.json(59)/motorhomes.json(11)/tow-vehicles.json(11) 的字段覆盖与 null 分布;读 data.mjs/tow.mjs/payload.mjs/fuel.mjs/estimate.mjs;复核 round2-audit-data.md + panel-accuracy.md + panel-forum-research.md 的既有结论;并**实时探测**了两个候选权威源 —— NHTSA recalls API 与 airstream.com `__NUXT_DATA__` SSR blob(curl, 无浏览器, 2026-06-19 拉取)。

---

## 0. 先确认: 既有审计的硬伤 S1/S2 都已修复 (不要重做)

round2-audit-data.md 列出的两大准确性硬伤,实测**当前数据已修正**,本 stream 不再重复:

- **S1 (`solarStandard` 标配/选配错误):** 已修复。当前 Bambi/Caravel/Flying Cloud/Globetrotter/International/Basecamp 全部 `false`,只有 Trade Wind(6)+Classic(6)+Basecamp XE(2)+特别版(2)为 `true`,与 upgrades.json 文案一致。✅
- **S2 (2026 MSRP 偏离 + specNote 加错对象):** 已修复。所有 2026 行 MSRP 现与其 2025 双胞胎完全一致(= airstream.com 当前 Starting Price),不再有 International 27FB +$11,245 那类偏离。✅
- **combined waste tank 6 行**(bambi-16rb/basecamp-16x/caravel-16rb 的 25+26):`grayGal:null` + blackGal 存 combined + specNote,处理正确。✅(AGENTS.md 也已记录这点 + FLW 反向纠错教训。)

→ 物理规格(UBW/GVWR/CCC/Hitch/Fresh/Gray/Length/Sleeps)在 round-2 已逐 floorplan 对 airstream.com 核实"全部精确匹配",`cccLb == gvwrLb − weightLb` 全 59 行成立。**核心数值层是干净的**,本 stream 聚焦"深度与权威性"而非"修 bug"。

---

## ⚠️ TOP 发现 (最高杠杆,先看这两条)

### ★★★ 发现 A — 目录核心(70 行 trailers+motorhomes)零 in-data 源 URL,直接踩"every-claim-sourced"铁律

实测: `tow-vehicles.json`(每车 `sources:[2×URL]`)、`upgrades.json`、`maintenance.json`、`campgrounds.json`、`boondocking.json`、`resource-points.json` 等 **8 个数据文件都带 source URL**,唯独**站点的心脏 —— trailers.json(59 行)+ motorhomes.json(11 行)—— 一个 `http` 都没有**(`grep -c http src/data/trailers.json` = 0)。

这是站点**最大的 authority 缺口**: 铁律明写"every factual claim needs a live source URL in data",但占全站数据量最大、用户最常查的 70 条规格记录,其 GVWR/CCC/tank/solar/MSRP 全部**无 in-data 溯源**。当前唯一的溯源是 data.mjs 里 family 级的 `OFFICIAL_URLS`(12 条 model 页链接),粒度太粗 —— 它指向 model 落地页,而非 floorplan 级规格出处。详见 D1。

### ★★★ 发现 B — NHTSA 召回数据是站点尚未利用的最高权威源,且可干净、免费、结构化获取

实测 NHTSA 官方 API `https://api.nhtsa.gov/recalls/recallsByVehicle?make=airstream&model=...&modelYear=...` 返回**干净的结构化 JSON**(Campaign #、Component、Summary、Consequence、Remedy、日期)。这是美国政府权威源,免费、无 key、可 build-time 烘焙(符合 static + 防 GFW)。一个 reference 站点能挂上"官方安全召回"层,是**纯粹的 authority 提升,且零商业/零编造**。详见 D2(含重要的 freshness 警告)。

---

## 【数据提案 — 建议做】(按价值÷风险排序)


### D1 — 给 trailers.json + motorhomes.json 每行加 floorplan 级 `sources[]` (踩铁律的根本性补强)

- **是什么:** 给 70 条目录记录每条加一个 `sources:[...]`(或 `sourceUrl`)字段,指向其规格出处。最权威的来源对绝大多数主流线就是 **airstream.com 各 floorplan 的 explore-products 规格页**,实测仍服务完整规格(`Starting Price` + `TCU/*`tank + `S&T/*`size&towing + `E&P/*`power 键齐全,HTTP 200,679KB)。tank/weight 这类数值已用同一来源核实过,只是 URL 没落进数据。
- **价值对象:** 每一个查规格的用户 + 站点 credibility(这是"reference 站点"的立身之本)。也让未来审计可一键回到出处。
- **工作量:** **M。** 12 主流线的 floorplan 页 URL 可由现成 `OFFICIAL_URLS` + axle 路径规律生成并逐条探活(round-2 已验证该 curl 方法,AGENTS.md 已记录解析法)。特别版(FLW/Stetson/World Traveler)用其专属 landing page。motorhomes 用 airstream.com touring-coaches 各车系页。
- **具体来源:** `airstream.com/explore-products/travel-trailers/{single,dual}-axle/<slug>`(主流线,实测可复现);特别版专属页;motorhome 用 `airstream.com/touring-coaches/<atlas|interstate-...|rangeline>/`。
- **溯源风险:** **低。** 这些就是数值的真实出处,非新增 claim,只是补 URL。唯一注意: airstream.com 只发布**当前 MY**单一规格页,无独立"2025 vs 2026"页 —— 2025/2026 双胞胎共享同一 source URL 是诚实的(规格本就一致),建议在 specNote 或字段注释里点明"airstream.com 只发布当前年款规格页"。
- **铁律风险:** **无。** 纯溯源,不碰商业。
- **第一步:** 写一个脚本: 对 `OFFICIAL_URLS` 12 family 逐一探 single/dual-axle 路径 → 拉 NUXT blob → 确认每个 floorplan 的 `Starting Price`/tank 键存在 → 把该 URL 写入对应行的 `sources[0]`。先做主流 9 线(覆盖 ~50 行),特别版单独处理。

### D2 — NHTSA 官方召回层 (build-time 烘焙的权威安全数据)

- **是什么:** 给每个 model family(或 model+MY)挂上 NHTSA 公布的召回记录: Campaign #、受影响部件、后果、补救措施、日期。实测 API 干净返回,例如 2023-2024 Bambi/Basecamp/Caravel/Flying Cloud/Globetrotter/International 共有的 `23V519000`(SmartPlug 30A inlet D-ring 可能开裂 → 电弧火灾风险 → 经销商免费更换)。
- **价值对象:** 任何认真做选车/保养决策的 owner 与 prospective buyer —— 这是别的爱好者站点很少干净呈现的高权威信息,**owns 一个差异化的 authority 角**。
- **工作量:** **M。** build 时对 ~8 个 model × 相关 MY 调 API 一次,bake 进一个 `recalls.json`,detail 页渲染。无运行时外链(符合防 GFW)。
- **具体来源:** `https://api.nhtsa.gov/recalls/recallsByVehicle?make=airstream&model=<model>&modelYear=<yyyy>`(美国 DOT/NHTSA 官方,免费无 key)。对外可链到 nhtsa.gov 的 recall 查询页作 human-readable 出处。
- **溯源风险:** **低,但有一个必须明示的 freshness 警告。** 实测 **2025/2026 年款目前多数返回 0 召回**(车太新,召回往往滞后发布);2023-2024 才有数据(2023 Bambi 有 3 条)。因此:(a) 站点的目录是 2025/2026,直接按 MY 匹配会几乎全空 —— 应按 **model family 跨年聚合**展示"该车系历史召回",并**标注数据截止日期 + 链到 NHTSA 实时查询**,绝不能让"0 召回"被误读为"绝对安全"。(b) 召回数据会变,必须 bake 时间戳 + 文案声明"以 NHTSA 实时数据为准"。
- **铁律风险:** **无。** 政府数据,非商业。
- **第一步:** 跑一遍 8 model × 2023-2026 的 API,把非空结果 bake 成 `src/data/recalls.json`(含 `fetchedAt`),在 model detail 页加一个克制的"Safety recalls (NHTSA)"块,配 freshness 声明 + 官方链接。**先和 lead 确认是否要把这层纳入范围**(它给站点引入一个需定期 re-bake 的数据维度)。

### D3 — 把"派生但有价值"的安全余量提示补进 tow 计算 (零新数据,纯算法深化)

- **是什么:** 当前 tow.mjs 是严谨的 **3-check**(tow rating / payload / GCWR),已正确把 loaded tongue weight(13% of GVWR)计入 payload —— 这是同类计算器里**做得最对的一档**(很多站点漏算 tongue 吃 payload)。但有两个**已被代码注释自己点名、却未对用户量化**的 edge case 值得补:
  1. **Hitch receiver rating** —— tow.mjs 注释明写"not modeled per-vehicle...disclosed as a caveat instead of guessed"。这是诚实的,但可以更进一步: 加一句确定性提示"WDH 通常是安全合规前提",因为 panel-forum-research 已证实 WDH+anti-sway 是社区/Airstream Club 共识的非可选项。
  2. **GAWR / 后轴超载** —— tongue weight 主要压**后轴**,大 tongue + 满载 bed 可能后轴 GAWR 超限而总 payload 仍合规。这是 tongue weight 之外的第二个"安静杀手"。
- **价值对象:** 认真做 tow 匹配的用户;深化站点在"towing safety"上的权威。
- **工作量:** **S(文案/提示)到 M(若要做 GAWR 需新增车辆轴重数据)。**
- **具体来源:** SAE J2807(已是 fuel.mjs 的基准);各车厂 towing guide(tow-vehicles.json `sources` 已有);GAWR 若要量化需车厂 door-jamb / spec sheet 的前后轴 GAWR —— **这部分溯源较难**(经销商 towing guide 常不列 GAWR 拆分)。
- **溯源风险:** 提示性文案 **低**;GAWR 量化 **中高**(11 车逐一找前后轴 GAWR 可能凑不齐,凑不齐就不要硬上)。
- **铁律风险:** **无。**
- **结论/取舍:** **现 3-check 是完整且正确的**(对 conventional bumper-pull TT 而言,tow/payload/GCWR 是决定性三者)。建议**只做低风险的文案增强**(hitch/WDH caveat 已有,可加 GAWR 的定性提醒 + "tongue 主要压后轴"一句),**不建议**为 GAWR 拆分硬凑数据 —— 凑不齐干净来源就违反铁律。

### D4 — climate / season / off-grid 适配: 用已有数据派生,不要新增不可溯源的"气候评分"

- **是什么:** 用户想知道"这台车适合什么季节/气候/off-grid 强度"。站点已有 `offGridScore`(39-93)、`solarW`、`batteryKwh`、tank 容量、`solarStandard`,off-grid 引擎(estimate.mjs)也已存在。可派生**确定性、可解释**的适配提示(如"X kWh + Y W solar → 夏季 N 晚 / 冬季更少因暖通耗电")。
- **价值对象:** boondocking / 四季使用的用户。
- **工作量:** **S-M(复用现有引擎)。**
- **具体来源:** 全部来自已有的、已溯源的 spec 字段 + estimate.mjs 的透明假设。
- **溯源风险:** **低 —— 只要保持"派生自真实 spec + 透明假设",不引入主观'气候评分'。** ⚠️ **拒绝项:** 不要造一个"四季适居性 1-5 星"主观评分(如保暖/隔热打分)—— Airstream 不发布 R-value/保温系数,owner 体感高度主观,**无干净来源,会沦为编造**。底盘/三季 vs 四季封装(如 Basecamp 的"all-season package")只在 airstream.com 明确列出时才陈述。
- **铁律风险:** **无(派生式);若做主观评分则踩 accuracy 铁律 → 拒绝。**
- **第一步:** 在 detail 页/off-grid 工具加一行派生提示,措辞强调"基于电池/太阳能/水箱 + 可见假设",链回工具。


### D5 — owner-reported 可靠性 / 常见痛点: 只做"可溯源的结构化共识",拒绝伪造的"可靠性评分"

- **是什么:** 用户最想要、也最难干净做的一类数据 —— "这车实际开起来有什么毛病"。panel-forum-research.md 已用**真实读过的 Airforums 线程 + Airstream Club WBCCI 官方清单 + Outside Online owner 长文**建立了**已验证的 mod/痛点共识**(如: MaxxAir 风扇替换、LevelMate Pro、lithium 转换需配 DC-DC + 换 converter profile、portable vs rooftop solar 之争)。可以把这类**有具名来源的"owner 共识痛点/改装"**结构化进数据,挂到对应 model/系统。
- **价值对象:** prospective buyer + 现有 owner(这是爱好者站点最高价值、最难得的内容)。
- **工作量:** **M。** 复用 panel-forum-research 已读源,结构化成 `pain-points` / `owner-consensus` 字段,每条带 source URL + 共识强度(VERY STRONG/MODERATE,如该 doc 的诚实分级)。
- **具体来源(已验证可开):** Airforums 线程 #1443198("top 3-5 mods")、#1448404(lithium/solar 深讨)、Airstream Club International "36 Things" 官方清单、Outside Online owner build。这些是 panel-forum-research 作者**实际打开读完**的源。
- **溯源风险:** **中,但可控。** 关键纪律(直接照搬 panel-forum-research 的诚实做法):
  1. **Reddit 不可用** —— 该环境实测无法加载 r/Airstream,**绝不能伪造投票数/permalink**。只用能打开的源。
  2. owner 体感是"共识信号"不是"客观故障率"。必须**措辞为"owner-reported"/"community consensus"并标共识强度 + source**,绝不能呈现为厂商规格或量化故障率。
  3. **拒绝项: 不做"可靠性评分 / 故障率百分比"。** 没有任何可信的 Airstream per-model 故障率公开数据(NHTSA complaints 可拉但样本与口径不足以算"率"),硬造就是编造 → **明确拒绝**。
- **铁律风险:** **无(若严守"具名来源 + owner-reported 措辞")。**
- **第一步:** 把 panel-forum-research 的 verified 条目转成结构化 `community-consensus.json`(每条: topic, models[], consensus_strength, summary, sources[]),detail 页以"Owner community says"块呈现,**显眼标注来源 + '社区共识非厂商规格'**。

### D6 — NHTSA complaints (投诉) 作为 D2 的可选补充 —— 谨慎,默认不做

- **是什么:** 除召回外,NHTSA 还有 owner **complaints** 数据库(`api.nhtsa.gov/complaints/...`)。
- **取舍结论: 默认不做。** 投诉是**未经核实的单方陈述**,数量受报告倾向影响极大,容易被误读为"故障率"。把它呈现在 accuracy-first 站点上风险高于收益。**若**未来要做,必须: 只显示官方原文摘要 + 强声明"未核实的 owner 投诉,非确认缺陷",且不做任何聚合排名。**当前建议: 跳过,只做 D2 的召回(召回是 NHTSA 已确认的官方行动,权威性远高)。**

---

## 【拒绝 / 谨慎项汇总】(诱人但无法干净溯源)

| 想法 | 为何诱人 | 为何拒绝/谨慎 |
|---|---|---|
| **per-model 可靠性评分 / 故障率 %** | 用户最想要 | 无可信公开故障率数据;NHTSA complaints 样本/口径不足以算"率" → **编造风险,拒绝** |
| **四季适居性主观星级 (保暖/隔热打分)** | 直观好用 | Airstream 不发布 R-value;owner 体感主观无干净源 → **拒绝**(只陈述官方明列的 all-season package) |
| **NHTSA complaints 聚合呈现** | 数据可免费拉 | 未核实单方陈述,易误读为故障率 → **默认跳过**(见 D6) |
| **GAWR 前后轴超载量化** | 是真实 edge case | 11 车前后轴 GAWR 凑不齐干净来源 → **只做定性提醒,不硬凑数据**(见 D3) |
| **Reddit r/Airstream 共识/投票数** | 社区最活跃 | 环境实测无法加载 → **绝不伪造**(见 D5);留给有 browser 的 panelist 复跑 |
| **interactive floorplan 真实尺寸图(可量距)** | 深度高 | 站点已有"floorplan zones 触摸热点"(SVG);但**真实带尺寸的工程图 Airstream 不公开**,自绘会变 AI-生成 diagram 风险(踩 no-AI-imagery / 准确性)→ 维持现有 hand-coded SVG 热点,**不升级为伪精确尺寸图** |
| **real-world towing MPG 实测表** | 用户很想要 | fuel.mjs 已是**派生模型**(SAE J2807 weight-ratio + EPA baseline),透明可溯源。改成"实测 MPG 表"需 per-model owner 实测数据 —— 论坛散点不成体系、口径不一 → **维持现有派生模型**(它诚实且已标注假设),不伪造"实测值表" |

---

## 【spec 覆盖率体检 — 实测结论】

- **trailers.json (59 行):** 23 个字段,除 `specNote`(52 null,设计如此)与 `grayGal`(6 null = combined tank,正确)外**零意外缺失**。物理规格层完整且已核实。**唯一真缺口 = 无 `sources[]`(见 D1)。**
- **motorhomes.json (11 行):** 36 字段**全 100% 填充**(chassis/engine/hp/torque/transmission/drivetrain/fuel/height/NCC/towCap/fuelTank/seats/inverter/shorePower 等齐全),深度甚至超过 trailers。**唯一缺口同样 = 无 `sources[]`(见 D1)。** 另注: 10/11 是 2027 MY、1 个 2026 —— 与 trailers 的 2025/2026 口径不同,值得在 UI 注明年款基准。
- **tow-vehicles.json (11 车):** 每车带 `sources[2×URL]` + `_meta` 方法论文档,`payloadLb==gvwrLb−curbWeightLb` 9/11 精确(2 个微差已 `_meta` 说明)。**这是全站溯源的标杆,trailers/motorhomes 应向它看齐(D1)。**

---

## 【更多年款 / vintage 经典 Airstream 覆盖 — 可行性评估】

- **诉求:** 加更多 model year 或经典/复古 Airstream(老 Bambi、Argosy、经典 Overlander 等),提升 reference 广度与权威。
- **可行性结论: 谨慎,不建议近期做。**
  - **现代多年款 (2024 及更早):** airstream.com **只服务当前 MY 规格页**,历史年款规格官网已下线 → 干净的一手来源缺失。第三方(RV spec 站、经销商存档)口径杂、可信度参差 → **溯源风险中高**。
  - **Vintage (1960s-1990s Airstream):** 规格散落在 owner wiki / Airstream archive / vintage 社区,**数值常互相矛盾、无权威单一出处** → **溯源风险高**。且站点当前定位是"2025/2026 在售目录 + 工具",vintage 是另一个产品方向。
  - **建议:** 若要扩,**优先补在售但缺席的特别版**(round2-audit G1 已点名 **REI Co-op SE Basecamp 20X** 和 **Pottery Barn SE** —— 后者 upgrades.json 文案已提及却无 trailers.json 记录),它们有当前官方 landing page 可溯源,且和已收录的 Stetson/FLW 同级。**Vintage 留作独立的、明确标注来源局限的未来项,不混入主目录。**
  - **工作量:** 补 2 特别版 = S-M(需各自专属页核实,勿照搬主流线模板);vintage = L 且溯源风险高。

---

## 【与 sibling streams 的边界】

- **Stream 3 (market/competitive)** 覆盖 airstream.com/RV Trader/valuation/community 的**竞品与定位**;本 stream 不重复竞品 teardown,只聚焦"**我们该新增/补强哪些可溯源数据**"。
- **camp-panel / round-2 已结论**的 campgrounds 数据问题(maxLengthFt 极值垃圾 S3、reservable 恒 true S4、CloudFront 图片外链 G3)属既有 backlog,本 stream 不重述,仅指出: 它们是**已知 backlog**,与本 stream 的目录-溯源主题正交。

---

## 推荐落地顺序 (价值÷风险)

1. **D1 — trailers/motorhomes 加 `sources[]`(M)** — 踩铁律的根本补强,来源已验证可复现,**最高优先**。
2. **D5 — owner 共识/痛点结构化(M)** — 复用已读 forum 源,差异化 authority,严守 owner-reported 措辞。
3. **D2 — NHTSA 召回层(M)** — 高权威差异化,但需 lead 确认范围 + 处理 freshness(2025/26 多为 0 召回)。
4. **D3 — tow 提示文案增强(S)** — 低风险深化,3-check 本身已完整,只补 GAWR/后轴定性提醒。
5. **D4 — climate/off-grid 派生提示(S-M)** — 零新数据,复用 estimate.mjs。
6. 特别版补齐(REI/Pottery Barn SE,S-M)— 若要扩广度先做这个,vintage 暂缓。

**贯穿全程的铁律纪律:** 每条新数据带 in-data source URL;owner 体感必须标"community consensus, not spec";拒绝任何故障率/可靠性评分/主观气候星级;Reddit 数据在能干净获取前不碰。
