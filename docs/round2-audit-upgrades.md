# Round-2 全站审计 — 视角 4/5：Upgrades tab

**审计人:** Upgrades tab 视角专家
**日期:** 2026-06-16 · HEAD `0e24a8f` · 280 测试全过
**范围:** `src/data/upgrades.json`(5 section / 26 items + 1 power table)、`src/lib/upgrades.mjs`、`src/assets/js/app.js` 的 `upgradesFilter()`、`src/lib/render.mjs` 的页面装配。

---

## 现状速写(读代码确认)

- **数据结构:** `{ intro, useCaseLegend, categories[] }`。5 个 section:`power`(6)、`climate`(3)、`towing`(6)、`water`(4)、`interior`(7)= **26 items**。任务里"26 个升级项"= 全 section items 总数,已核实。
- **每个 item 字段:** `name / type(Factory|Aftermarket|Both) / consensus(4 档枚举) / consensusNote / useCases[] / priceText / why / popular / sources[] / image`。所有 26 项字段齐全且一致(无缺字段),`validateUpgrades()` 强制 type/consensus 枚举、useCase 词表、≥1 个 http(s) 源、图片路径格式 — build 会因脏数据硬失败。这是很扎实的数据契约。
- **consensus tier(已上线):** `Near-universal`(7)→`Frequently recommended`(14)→`Enthusiast favorite`(1)→`Niche`(4),由 `TIER_META` 单一来源驱动 pip 表(●●●○)、legend、filter 三处,不会互相矛盾。legend 里有一段诚实声明:"信号只反映我们打开读过的来源(两条 Airforums 长帖、Airstream Club 携带清单、一篇 owner build),是 owner 情绪的判读而非投票计数"。
- **filter lens(已上线):** 三维度 chips(Signal/Source/Best-for),维度内 OR、维度间 AND、use-case 多选要求全满足;`localStorage` 持久化;渐进增强(无 JS 也能读全页,lens 服务端渲染为 hidden);空态 + 计数 + 清除。
- **source 透明度:** 45 条源链接、17 个唯一域,主力 airforums.com(19)、airstream.com(6)、blog.airstreamclub.org(5)。每个 item 的 `<details>` 折叠源列表,`rel="noopener nofollow"`。
- **铁律合规现状:** 无 buy/affiliate 链接(源链接是 click-through 参考,非购买入口);价格统一标注"reference, not a quote";页脚 + intro 双重免责"not affiliated with Airstream"。✅

---

## 【已上线-跳过】(不重复提的已有功能)

- **consensus tier 社区共识分级** — 4 档枚举 + pip 表 + evidence note + legend 诚实声明。已是本 tab 的灵魂功能。
- **filter lens** — Signal/Source/Best-for 三维过滤,渐进增强 + 持久化。
- **编辑级排版** — feature card、copper pip、typed citation 框架(见 upgrades-redesign-proposal.md C 节)。
- **source 折叠 + 类型标注** — 每项 ≥1 真实链接、Factory/Aftermarket/Both badge。
- **per-model 工厂太阳能/锂电表** — power section 的 `table`(7 行,按车系列出工厂 solar/lithium 档位与售卖方式),已是车型维度信息的雏形。
- **价格"reference, not quote"约定 + 免责** — 已全站统一,勿当新点子。
- **grow 19→26 items** — round-1 已完成(LED、MaxxFan、LevelMate、mattress、brake controller、shunt、composting toilet 等已加)。勿再当"缺失项"重复。

---

## 【真实缺口-建议做】(按价值排序)

### G1. Explore 车型 ↔ Upgrades 联动:"这台车最该上的改装" — 价值★★★★★ · 工作量 M · 不碰铁律
**机会:** 目前 upgrades 与 trailers 完全无联动。但 `trailers.json` 已有可直接驱动的字段:`solarW`、`batteryKwh`、`offGridScore`(39–93)、`solarStandard`(43/59 有值)、`tags`(family/off-grid/solo/national_parks…)。
**具体做法(纯静态、规则式,不编造):** 在每个 floorplan 的 detail 页加一条"Popular mods for this model"小条,用**确定性规则**从现有 26 项里选 3–5 个,规则透明可解释:
- `offGridScore` 低 / 无 `solarStandard` → 高亮 power section 的 lithium + solar + DC-DC;
- 所有车 → brake controller + WDH/anti-sway + TPMS(Near-universal 通用项,本就该人手一份);
- `tags` 含 `off-grid`/`boondocking` → MaxxFan + soft start + composting toilet;
- 大车(`weightLb`/`gvwrLb` 高)→ ProPride 而非入门 WDH(item popular 文案已有此区分)。
**为何高价值:** 这是 round-1 多个 panel(ux-panel-review.md L106 明确点名"popular mods for this model"作为 cohesion cross-link)都想要但**从未实现**的联动;把站内两个最强 tab 缝起来,是"工具感"而非"目录感"的关键。规则式可溯源,不触碰"严禁编造"。
**铁律检查:** 是推荐而非售卖,链接仍指向站内 upgrades 卡;不加 affiliate。✅ 注意文案别写成"buy this for your X"。

### G2. 新增 `tradeoff` / 反方观点字段 — 价值★★★★☆ · 工作量 M · 不碰铁律
**缺口:** 抽查 26 项,只有 4 项(lithium、2nd A/C、WDH、composting toilet、hinges)在 `why`/`popular` 里隐含 tradeoff 语言;其余 22 项几乎是单向"为什么好"。一个"用户审美极高、讨厌通用感"的受众,最想要的恰是**诚实的反方**:rooftop-vs-portable solar 的真实争论(panel-forum-research.md L35 明确记录这是"未定的持续争论")、composting toilet 的清洁/异味/转售争议、inverter 重度玩家爱/休闲玩家跳过、tint 的法规与可视性。
**做法:** 加可选字段 `tradeoff`(string)+ validator 选择性校验;render 里作为 `.up-tradeoff`("The honest downside")渲染在 `why` 之后。优先给 8–10 个有真实争论的项补上,源自已读论坛帖。
**为何高价值:** 把页面从"推荐清单"升级成"owner 会信任的判断",正面回应"讨厌太 AI / 模板化"。consensus tier 给了"多少人推",tradeoff 给"什么情况下别上",两者互补。
**铁律检查:** 必须可溯源(从已读论坛/owner build 引),不可凭空写 con。✅

### G3. 安装难度 / DIY-vs-shop 维度 — 价值★★★★☆ · 工作量 M · 不碰铁律
**缺口:** 26 项里只有 3 项文字里偶提 install。受众做改装决策时,第一个分叉就是"我能自己装吗,还是要进店"。LED/topper/水过滤是 5 分钟 DIY,锂电+逆变器+DC-DC 是要拆电路的大工程,soft start 要拆 A/C 接线,composting toilet 要改管路。现在这些全埋在散文里,无法扫读也无法过滤。
**做法:** 加可选枚举字段 `install`(`DIY` / `DIY or shop` / `Pro install`),render 成第三类小 badge,并接入 filter lens 作为第 4 个维度(lens 已是三维,加一维是同构扩展,app.js 的 `state` 加一个 key 即可)。
**为何高价值:** 这是 filter lens 之外**最自然的新维度**(任务点名问"filter lens 之外还能加什么"),且数据已隐含在 popular 文案里,补字段成本低。比"按预算分级"更刚需(预算已由 priceText 表达)。
**铁律检查:** 纯信息标注,无商业。✅ 难度判断需保守、可由源佐证。

### G4. climate section 偏薄(仅 3 项)+ 缺真实高共识项 — 价值★★★☆☆ · 工作量 S–M · 不碰铁律
**缺口:** climate 只有 soft start / MaxxFan / 2nd A/C(后者是 `Niche` 工厂选项,非社区 mod)。论坛里高频出现但缺席的 climate 项:**车窗反射隔热罩 / Reflectix 窗帘**(boondocking + four-season 通用,owner build 明确提到)、**dehumidifier / 防潮**(four-season 痛点)、**车顶/腹部隔热升级**。这些有真实 owner 来源可引。
**做法:** 补 1–2 个有源项进 climate;或把"window film / tint"(现在 interior)与隔热罩归为一组叙事。
**为何价值中等:** 充实最薄的 section,但不如 G1–G3 杠杆高;且要先确认论坛来源强度避免凑数(round-1 已警惕"凑项")。
**铁律检查:** 需可溯源。✅

### G5. consensus 来源透明度可再进一步:把"读过 N 个源"做成可见徽记 — 价值★★★☆☆ · 工作量 S · 不碰铁律
**机会:** legend 已诚实声明"只基于读过的 4 个源"。但单卡层面,读者要展开 `<details>` 才知道某项是 1 个源还是 4 个源支撑。consensus pip 给"多强",但**没显示"基于几个可溯源"**。Reddit 至今未纳入(panel-forum-research.md L200:环境内无法访问,真实 gap)。
**做法:**(a)卡片头部把源数量做成可见小字"4 sources read"而非埋在 summary;(b)对 `src=1` 的项,consensusNote 里显式说明"signal 较弱,仅单源"(目前 4 个 Niche/单源项的 note 强度参差)。**不要**假装有 Reddit 数据。
**为何价值:** 强化"可信度信号来源透明",正面回应受众对"凭据"的高要求。
**铁律检查:** 纯透明度提升。✅

---

## 【数据问题-需校准】(accuracy 审计遗留 + round-2 复核)

> 已用 browser_search 核对当下市价(2026-06)。round-1 的 `panel-accuracy.md` 列出 4 处错价要修,但 **upgrades.json 当前数据里仍有未修项**。

### D1. Weight-distribution hitch 入门价仍偏低 — 需校准
- **现状:** priceText `"$500 (Equal-i-zer) – $3,695 (ProPride 3P)"`;popular `"Equal-i-zer 4-point (整合防摆,~$500–700) 是价值标杆"`。
- **核对(etrailer 2026-06):** Equal-i-zer 无 shank 入门款实价 **$590–667**(10K 款 $666.62,零售 $725);**含 shank 的 14K/16K 款 $875–1,012**。$500 低端在当前市场已**找不到对应在售型号**。
- **建议:** 入门改为 **~$600(无 shank)– 950(含 shank)**,popular 文案同步;ProPride 上限 $3,695 仍准确。round-1 accuracy 审计(claim 7)早已点名此项,但数据未落实修复。

### D2. 预算锂电"$230–280/100Ah"偏高 — 需校准
- **现状:** lithium item popular 与 priceText:budget drop-ins(Power Queen / LiTime)`"~$230–280 per 100Ah"`,priceText 锂电下限 `$230`。
- **核对(2026-06):** Power Queen 100Ah 在 Amazon **$199.99**、Walmart 同类 **$169.99–207**、eBay(含官店)**$149–199**。当前预算 100Ah 真实区间约 **$150–230**。
- **建议:** 改为 **~$170–250 per 100Ah**,priceText 下限随之下调。round-1 accuracy(claim 1c)已标记"actual ~$170–230",仍未落实。

### D3. round-1 未落实修复项需统一过一遍
panel-accuracy.md 明确列出但需在 upgrades.json 里确认是否已改:
- **AirSkirts** — round-1 建议**整项删除**(零论坛来源 + 价格 $1,000–1,600 实为 $1,958–2,768)。✅ 已确认:当前 26 项里**已无 AirSkirts**,删除已落实。
- **Equal-i-zer / ProPride** — 见 D1,**部分未落实**。
- **预算锂电** — 见 D2,**未落实**。
- **tint / skylight / hinges** 等不可溯源数字 — round-1 建议软化。当前 priceText 仍给具体区间(tint `$200–600`、skylight `$300–700`、hinges `$10–40`)。建议加"varies widely / shop-dependent"措辞或在 note 标注为粗略参考。
- **建议:** 做一次"accuracy 落实复核",逐条对 panel-accuracy.md 勾兑,确保审计结论真的进了数据(目前至少 2 项 number-fix 漏了)。工作量 S,但**直接关乎"数据准确性是底线"铁律**。

### D4. priceText 缺统一时间戳锚点 — 轻微
- 各项 priceText 隐含"2025–2026 街价",但单卡不显年份,只有页脚说明。对一个会随时间漂移的价格列表,建议在 legend 或卡片加一处"prices checked: 2026"可见锚点,便于未来复核与建立用户信任。工作量 S。

---

## 本视角 Top-2 发现

1. **【缺口 G1】Explore 车型 ↔ Upgrades 联动(detail 页"这台车最该上的改装")** — 价值★★★★★ / M。两个最强 tab 至今零联动,而 `trailers.json` 的 `offGridScore / solarW / batteryKwh / tags` 已足以驱动**确定性、可解释、不编造**的规则式推荐;round-1 ux panel 早点名却从未做。这是把站点从"目录"升级成"工具"的最高杠杆,且天然不碰商业铁律(站内推荐,非售卖)。

2. **【数据问题 D1–D3】accuracy 审计结论未完全落实,2+ 处错价仍在线上** — 价值★★★★☆ / S。Equal-i-zer 入门价($500,实为 $600–950)和预算锂电($230–280,实为 $170–250)在 round-1 已被 panel-accuracy.md 点名,但当前 upgrades.json 仍是旧数字 — 直接踩"规格/价格必须可溯源"的底线铁律。需一次逐条勾兑的落实复核,成本低、紧迫度高。

*(仅方案,未改任何代码/数据。)*
