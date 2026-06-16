# Round-2 Audit — 视角1: 数据完整性 & 准确性

**审计员:** 数据视角专家 (round-2 全站审计)
**日期:** 2026-06-16
**范围:** `src/data/{trailers,campgrounds,upgrades,tow-vehicles}.json`
**仓库:** HEAD=0e24a8f · 280 测试全过
**方法:** 4 文件自洽性脚本 (Node 18, `fs.readFileSync`+`JSON.parse`) + airstream.com `__NUXT_DATA__` SSR blob 实时核对 (curl, 无浏览器, 2026-06-16 拉取)。仅列出已验证或有明确怀疑理由的项。本轮**只产出方案文档,未改任何代码/数据**。

---

## 本视角 TOP-2 发现

1. **`solarStandard` 与官方"标配/选配"语义系统性矛盾(12 行)。** trailers.json 把 **Bambi(全 3 floorplan)、Caravel(全 3)** 标成 `solarStandard:true`,但 airstream.com 当前规格页对这两条线的太阳能和锂电都明确标 **"(Optional) (Only Available with Solar Options)"**。更糟的是**同仓库内自相矛盾**:upgrades.json 的 `power` 分类正文已正确写明"factory lithium...optional on Globetrotter, International, Flying Cloud, **Caravel, Bambi** and Basecamp"。Flying Cloud 同样官方标 Optional 但仓库为 true(见下表)。这是一个会直接误导 off-grid 选车判断的准确性问题,且两个数据文件对同一事实给出相反答案。

2. **`campgrounds.json` 的 `maxLengthFt`/`trailerMaxFt` 含大量 RIDB 垃圾极值,且 `reservable` 字段已退化为常量。** 152 个营地 `maxLengthFt>100ft`,极端到 500ft(CANADIAN, OK)、255ft、227ft——这些是 Recreation.gov 原始数据里"无限制/未知"被错填成超大数,直接破坏"我的 25ft Airstream 装得下吗"这一核心用例的可信度。同时 `reservable` 在全部 2561 条里**恒为 true**(采集只保留了可预订营地),作为筛选维度零信息量。

---

## 【数据问题 - 需校准】(按严重度排序)

### S1 — `solarStandard` 标配/选配错误(trailers.json)— 准确性 + 自洽性
**严重度: 高。** 违反"任何 claim 可溯源"铁律,且站内两文件冲突。

| model | floorplan | repo `solarStandard` | 官方 (airstream.com 2026-06-16) | 建议 |
|---|---|---|---|---|
| Bambi | 16RB/20FB/22FB | `true` | Solar **(Optional)**, 锂电 (Optional, 仅随 solar) | 改 `false` |
| Caravel | 16RB/20FB/22FB | `true` | Solar **(Optional)** | 改 `false` |
| Flying Cloud | 23/25/27FB,28RB,30FB Bunk | `true` | Solar **(Optional)** | 改 `false` |

- **来源:**
  - Bambi: `https://www.airstream.com/explore-products/travel-trailers/single-axle/bambi` — 三个 floorplan 全部 `"E&P/Solar Charging System":"... (Optional)"`, `"E&P/Battery Capacity":"2.5 kWh ... (Optional) (Only Available with Solar Options)"`
  - Caravel: `.../single-axle/caravel` — 同上(100W/200W 均 Optional)
  - Flying Cloud: `.../dual-axle/flying-cloud` — `"300 W Solar Charging System with Interior Monitor (Optional)"`, 电池 `"2.5 kWh ... (Optional)"`
- **站内交叉证据:** `upgrades.json` → `categories[power].items[0].why` 已写 "optional on Globetrotter, International, Flying Cloud, Caravel, Bambi and Basecamp",与 trailers.json 直接打架。
- **正确标配名单(官方核实):** **标配** = Trade Wind(600W/810Ah*)、Classic(300W/2.5kWh)。**选配** = Bambi、Caravel、Flying Cloud、Globetrotter、International、Basecamp。
- **建议动作:** 把上述 12 行 `solarStandard` 改为 `false`,并与 upgrades.json 文案对齐。Globetrotter/International 仓库已是 `false`(正确)。
- *(注: upgrades 文案说 Trade Wind 810Ah,但 trailers.json 用 batteryKwh=10.3/18.5;两者是 Ah vs kWh 不同单位表达,见 S5,非冲突。)*

### S2 — 2026 MSRP 仍是未溯源的"占位价",且仅 4 行有免责 specNote(trailers.json)— 准确性
**严重度: 高。** round-1 (research-thread2-data.md) 已确认:Airstream 每个 floorplan 只发布**一个**当前"Starting at"价,不存在独立的"2026 MY 价"。本轮我用 curl 重新核对 airstream.com **当前价**,确认 8 个 2026 行的 `msrp` 仍与官方当前价不符:

| model | floorplan (2026) | repo msrp | 官方当前价 (2026-06-16) | 差额 |
|---|---|---|---|---|
| Bambi | 16RB | 70000 | **68900** | +1100 |
| Caravel | 20FB | 85000 | **90400** | −5400 |
| Classic | 28RB | 186800 | **190400** | −3600 |
| International | 23FB | 118000 | **121400** | −3400 |
| International | 25FB | 135000 | **133900** | +1100 |
| International | 27FB | 153645 | **142400** | +11245 |
| International | 28RB | 145000 | **142400** | +2600 |
| International | 30RB | 160000 | **149900** | +10100 |

- **来源:** 各车型 airstream.com 页 `__NUXT_DATA__` 的 `Starting Price` 字段(均为整数美元),例如 International 页同时含 23FB=121400 / 25FB=133900 / 27FB=142400 / 28RB=142400 / 30RB=149900。
- **关键不一致:** 仓库里只有 4 个 2026 行带 "2026 MSRP not yet published; shown is latest verified base (2025)" 的 specNote(caravel-22fb, classic-30rb, classic-33fb, caravel-16rb)——而这 4 个的 msrp **恰好**等于 2025 价(即未编造);真正编造/过期的上面这 8 个**反而没有任何 specNote**。逻辑反了。
- **建议动作:** 最干净的修复 = 把所有 2026 行 `msrp` 设为 airstream.com 当前 Starting Price(对这些 floorplan 而言 == 仓库 2025 行的值),并移除/统一 MSRP-disclaimer specNote。`International 27FB` 的 153645 偏离最大(+11245,且数字精度异常像凭空生成),优先级最高。

### S3 — `maxLengthFt` / `trailerMaxFt` 含 RIDB 极值垃圾(campgrounds.json)— 准确性
**严重度: 中高。** 直接影响"装得下吗"核心 fit 用例。

- **现状(脚本统计):** `maxLengthFt`: >65ft=657 条, >80ft=423, >100ft=152。`trailerMaxFt`: >100ft=155。极端值:
  - `CANADIAN` (OK) maxLengthFt=**500**(trailerMaxFt=77)
  - `BIG SPRINGS WARMING HUT` (ID) =500
  - `BOULDER LAKE` (WI)=255, `BLUFF VIEW`=210, `SMOKEMONT` trailerMaxFt=**227** 而 maxLengthFt=40
- **怀疑理由:** Recreation.gov 把"无长度限制/未知"经常编码为超大数;真实 federal 营地 site 极少 >65ft。这些值若直接喂 fit 筛选,会把不适合的营地误判为"超大房车也能进"。
- **127 条 `trailerMaxFt > maxLengthFt`**(如 SMOKEMONT 40→227),两字段口径不一(`maxLengthFt`=facility 级 posted,`trailerMaxFt`=per-site rollup 的 max),rollup 取 max 会被单个异常 site 拉高。
- **建议动作:**
  1. 建一个合理上限(如 cap 在 ~65–70ft,或对 >100ft 视为"未知"置 null),保留原始值到单独字段供调试。
  2. fit 计算优先用 `trailerLenHistogram`(已验证 histogram sum ≤ rvSiteCount,自洽)而非单点 max——能答"有几个 site 容得下 X ft"而非二元判断。
  3. 文案明确 `maxLengthFt`(facility posted)vs `trailerMaxFt`(per-site 最大)的区别,避免用户误读。

### S4 — `reservable` 字段恒为 true,作为筛选维度无效(campgrounds.json)— 完整性
**严重度: 中。**

- **现状:** 全部 2561 条 `reservable===true`(采集阶段只保留了可预订营地)。
- **影响:** 任何"可预订/先到先得"筛选都会返回全集,误导用户以为所有营地都接受预订(实际 Recreation.gov 上很多是 first-come)。
- **建议动作:** 要么移除该字段(避免假信号),要么在采集层放开 `reservable=false` 的营地并真实标注。鉴于纯爱好者参考定位,至少在 UI/数据注释里说明"本数据集仅含可预订营地"。

### S5 — `batteryKwh` 单位/口径需在 UI 标注(trailers.json)— 表述清晰度
**严重度: 低(非错误,易误读)。**

- Trade Wind 27FB `batteryKwh=18.5`,其余 TW=10.3,主流线=2.5。**airstream.com 已核实**:TW 大 floorplan 确为 "18.5 kWh ... with Built in Heating and Cooling",10.3 kWh / 2.5 kWh 也都精确匹配官方文字。**数值正确,无需改。**
- 唯一风险:upgrades.json 用 "810Ah/200Ah" (Ah) 描述同一电池,trailers.json 用 kWh。两者都对(810Ah×12V≈10.3kWh,200Ah×12V≈2.5kWh),但全站混用单位可能让用户困惑。建议:在 UI 注脚统一换算说明(12V 体系),不改数据。

---

## 【真实缺口 - 建议做】

### G1 — 缺 2 个在售特别版车型(trailers.json)
round-1 已指出 **REI Co-op SE Basecamp 20X** 和 **Pottery Barn SE** 仍在 airstream.com lineup nav 但缺席。本轮补充:upgrades.json 文案甚至已经把 "Pottery Barn" 列为锂电标配车型("standard on Classic and **Pottery Barn**"),却没有对应 trailers.json 记录——数据集内部已经"提到却没有"该车。建议补齐这 2 个(与已收录的 Stetson 6666 / FLW 同级)。注:本轮这两款及 basecamp-xe / world-traveler / stetson / frank-lloyd-wright 的独立 explore-products URL 均 404(只有主流 9 线有单页),特别版规格需从各自专属 landing page 或官方 press 核实后再加,不要照搬。

### G2 — campgrounds 富数据字段覆盖率偏低,但这是真实федеral 数据稀疏所致(非错误)
覆盖率(脚本实测,2561 条):
- `hasPullThrough` 43.3%(1108 true / 1453 未知)、`dumpStation` 22.7%(582)、`flushToilets` 19.0%(486)、`accessibleSiteCount` 39.2% —— 这些是布尔/计数,**未知=字段缺失(undefined)而非 false**,是诚实做法 ✅。
- `maxLengthFt` 88.1%、`trailerMaxFt`/`trailerLenHistogram` 82.4%、`rating` 95.0%、`photo` 96.1%、`price` 96.4%。
- **建议:** 不要把 undefined 当 false 渲染(否则会谎报"无 dump station")。cg-panel-2-data.md 已规划从 `/api/camps/campgrounds/{id}` + `/campsites` 补 hookups/amp/accessible——值得做,且全 build-time bake、无运行时外链,符合防 GFW 铁律。这些 enrichment 字段(hookups/dumpStation/flushToilets/hasPullThrough/accessibleSiteCount/rvSiteCount/trailerMaxFt/elevationFt)看起来已部分落地(`enrichedAt:2026-06-16`),建议把覆盖率缺口当作"继续 backfill"而非"修 bug"。

### G3 — 营地照片 100% 依赖 cdn.recreation.gov(CloudFront)— 防 GFW 待解项
- **实测:** 2460 张照片**全部** `cdn.recreation.gov`,营地 `url` 全部 `www.recreation.gov`。这正是任务点名的"中国可能被限速/墙"的 CloudFront 资源。
- **建议:** (a) build-time 把营地缩略图镜像到与站点同源/Cloudflare(Pages 自带,中国可达性优于 CloudFront)的静态资源;(b) 给 `<img>` 加 `loading="lazy"` + 占位,墙掉时不破版;(c) 这是**基础设施视角**与本视角的交集项,数据侧能做的是把 photo 字段改为指向自托管镜像路径。

---

## 【已上线 - 跳过】(本轮正面确认,无需动)

- **trailers.json 物理规格(UBW/GVWR/NCC/Hitch/Fresh/Gray/Length/Sleeps)**:对 9 条主流线(Bambi/Caravel/Classic/Globetrotter/International/Trade Wind + Basecamp/Flying Cloud 抽查)逐 floorplan 比对 airstream.com `__NUXT_DATA__`,**全部精确匹配**。特别复核:International **27FB(UBW6000/NCC1600/Hitch850/Gray39)与 28RB(UBW5900/NCC1700/Hitch860/Gray37)未互换**——按官方"Floor Plan"命名字段确认仓库映射正确。
- **`cccLb == gvwrLb − weightLb`**:全 59 行精确成立 ✅。
- **Combined waste tank 6 行**(bambi-16rb / basecamp-16x / caravel-16rb 的 2025+2026):`grayGal:null` + blackGal 存 combined 容量 + specNote 说明。airstream.com 核实 Bambi 16RB fresh23/无独立 gray、Caravel 16RB fresh23/无独立 gray、Basecamp 16X fresh21/combo24 —— 处理正确 ✅。
- **太阳能瓦数/电池 kWh 数值**:Trade Wind 500W/600W + 10.3/18.5kWh、Classic 300W/2.5kWh、主流线 100–300W/2.5kWh —— 数值经 airstream.com 文字核实**正确**(仅 `solarStandard` 布尔标错,见 S1)。
- **tow-vehicles.json(11 车)**:
  - `payloadLb == gvwrLb − curbWeightLb` 9/11 精确成立;Tahoe(Δ−93)、Tacoma(Δ−5)为厂商发布值与 SAE 恒等式的正常微差,`_meta.method` 已说明用厂商发布 payload。
  - `gcwr` 普遍 = curb+maxTow+300(SAE J2807 占员配重),`_meta` 已显式文档化此方法,**内部完全自洽**。
  - `sources` 字段每车 2 条真实 URL(厂商/经销商/媒体),非编造。F-150 13500lb / Tundra 11170 / Silverado 11000 等数量级与 2025 厂商规格一致。
  - `_meta.purpose` 明确"绝不混用不同 config 的 max-tow 与 max-payload",方法论严谨,**保持不动**。
- **upgrades.json 价格区间**:本轮逐条核对 priceText,**round-1 panel-accuracy.md 标的 needs-fix 项已基本修复**——AirSkirts 已不再出现错误的"$1000–1600",WDH 现为 "$500(Equal-i-zer)–$3,695(ProPride 3P)"、ProPride 上限已含 3695、TPMS "$250–450"、Soft start "$270–350"、第二空调 $2200(官方核实)、Composting OGO$785/Nature's Head$1030 均合理且具名。整体 priceText 现为区间+具名品牌+sources URL,溯源充分 ✅。(*遗留小项:budget 锂电仍写 "$230–280 per 100Ah",panel-accuracy 认为实际 ~$170–230;非硬错,可软化下限。*)
- **campgrounds 结构完整性**:0 重复 id;rating 全在 1–5;0 个 maxLengthFt≤0;histogram sum ≤ rvSiteCount(全部自洽);47 州覆盖;Furnace Creek elevation=−200ft 是死亡谷真实低于海平面,**正确非异常**。

---

## 附:本轮验证用的实时官方数据(airstream.com `__NUXT_DATA__`, 2026-06-16)
可复现命令:`curl -sL -A 'Mozilla/5.0 ...' 'https://www.airstream.com/explore-products/travel-trailers/{single,dual}-axle/<slug>'` → 解析 `<script id="__NUXT_DATA__">` 扁平索引数组,floorplan dict 含 `Starting Price` + `S&T/*` + `TCU/*` + `E&P/*` 键。已成功拉取并解析:bambi, caravel, classic, globetrotter, international, trade-wind, flying-cloud。(basecamp/特别版无单页,404。)
