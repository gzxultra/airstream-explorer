# Round-2 Audit — Explore tab (车型浏览/筛选/排序/对比体验)

**视角 2/5** · 审计对象: Explore hub (`index.html` 的 "By family" + "All floorplans" 两视图)、`compare.html`、59 个详情页。
**HEAD:** 0e24a8f · 280 tests green · 纯 ESM / 零运行时依赖 / Cloudflare Pages。
**只产出方案,不改代码。** 标注三类:【已上线-跳过】【真实缺口-建议做】【数据问题-需校准】。
工作量 S(<半天)/ M(1-2天)/ L(3天+)。所有建议均为纯静态/客户端、GFW 安全、不触碰"无商业/联盟/预订"铁律(逐条已核)。

---

## 现状核对(读码确认)

- **All-floorplans 视图**(`renderExploreSections`, render.mjs L632)提供:搜索框(model+floorplan 子串)、排序下拉(`SORT_KEYS` 7 项)、年份(2026/2025/Both)、Sleeps≥(2/4/5/6/8)、use-case tag chips、tow matcher(单输入,GVWR vs 额定拖重,over 者**变暗不隐藏**)、Reset、空状态(`x-empty`+reset)、compare 勾选 tray。默认仅显示 2026(31 台),2025 的 28 台 `hidden`。
- **筛选/排序状态:仅存 localStorage(`explore.prefs`),不进 URL。** 对比之下 campgrounds 有完整的 `share.mjs` hash 编解码(len/st/col/sort/q/map…)。Explore 的 hash 只有 `#families`/`#all` 两个视图开关(app.js L46 exploreHub),**筛选结果无法分享/深链/回退**。
- **Compare**(`renderCompare` + app.js L470):最多 3 台,12 行规格,逐行高亮 best(`cmp-best`,betterDir),`?ids=` 可分享,3 组 starter 套餐,搜索增量添加,移动端 `overflow-x:auto`(min-width 480px 横滚)。**无 sticky 表头/标签列,无 copy-link 按钮,best 高亮仅靠绿色✦(色彩单通道)。**
- **详情页**(`renderDetail`):规格表、tow callout、tow 计算器、off-grid 估算器、官方 floorplan 图、décor、campground fit、pros/cons、gallery。**无"同级/相似车型"推荐,无家族内 上一个/下一个,无 detail 页直接加入 compare/shortlist 的按钮**(只有一句 "Match it to your vehicle →" 跳回 explore)。
- **tag 数据分布**(关键):`off-grid`=**59/59**、`family`=**57/59**、`full-time`=26、national_parks=16、solo=15、luxury=14、`couples`=**仅 2**(都是 Basecamp 16X)。平均 3.2 tag/台。

---

## 【数据问题-需校准】

### D1. tag 筛选器作为"区分维度"基本失效 —— 价值高 / 工作量 S(数据)+S(UI) / 不触铁律
- **问题:** 渲染成筛选 chip 的 7 个 tag 里,**"Off-grid" 命中全部 59 台(纯 no-op),"Family" 命中 57/59(几乎 no-op),"Couples" 只命中 2 台**(Basecamp 16X 两个年款)。用户点 "Off-grid" 期望收窄,结果一台不少;点 "Couples" 又窄到只剩一款。这是"看起来能筛、实际不能筛"的信任杀手,正是用户讨厌的"模板化/通用感"。
- **根因:** tag 是内容标注,不是正交分面。`off-grid` 对一个"每台都标 off-grid"的目录没有区分力;`couples` 标注覆盖不全(Caravel 16RB/Bambi 16RB 这类双人小拖也该算 couples 却没标)。
- **校准建议(二选一或并行):**
  1. **从筛选 chip 中移除区分力≈0 的 tag**(off-grid、family),只保留真正能分群的(solo / full-time / national_parks / luxury),把 off-grid 留给"排序: Best off-grid"+off-grid score(已上线)承担。
  2. **重新审定 couples 标注**:按真实定位补齐(凡 sleeps≤2 或主打双人布局的应一致标注),否则删掉这个只命中 1 款的 chip。
- **价值:** 直接修复浏览器最核心的"筛"动作,且零铁律风险;是把"参数表"变回"可用工具"的最低成本动作。

---

## 【真实缺口-建议做】(按价值排序)

### G1. Explore 的筛选/排序/tow 状态无法进 URL —— 价值高 / 工作量 M / 不触铁律
- **问题:** 配置好一套筛选(如"sleeps≥6、luxury、tow 7700、按 off-grid 排序")后**无法生成链接分享或加书签**,刷新/返回也丢失到 localStorage 的全局态。campgrounds 已有成熟的 `share.mjs` hash 方案,Explore 却只有 `#families/#all`。
- **价值:** (a) 用户在中国,把一个"已筛好的候选视图"发给同好/家人是高频真实需求;(b) 与已上线的 campgrounds deep-link 体验拉平,消除"为何那个能分享这个不能"的割裂感;(c) 回退键/刷新保持上下文,体验更"产品级"。
- **做法:** 仿 `share.mjs` 写一个 explore-view 编解码(q/sort/year/sleeps/tags/tow → hash),app.js explore 模块在 `apply()` 后写 hash、初始化时读 hash(hash 优先于 localStorage);保持纯函数 + 单测(项目惯例)。注意与 `#all` 视图 hash 共存(用 `#all?...` 或 query 段)。
- **工作量:** M(编解码 + 双向同步 + 测试;复用 campgrounds 已验证的模式)。

### G2. 缺价格 / 长度 / 家族 三个核心筛选维度 —— 价值高 / 工作量 M / 不触铁律
- **问题:** 当前只能按 Sleeps≥ 和 tag 收窄。**价格(MSRP $54.9k–$222.9k 跨度 4 倍)是买家第一筛选轴,却完全没有价格筛选;长度(16'–33')、家族(12 个 model line)也没有筛选。** 想"只看 $80k 以下、25 尺以内"做不到;想在 All-floorplans 里"只看 Flying Cloud"也做不到——只能退回 By-family 网格,从而丢掉全部规格控件(见 G3)。
- **价值:** 价格区间 + 长度区间是把 59 台快速收敛到候选短名单的两把主刀;family 下拉让"我已锁定某系、想在规格视图里比该系所有布局"成为可能。卡片已带 `data-msrp/data-length/data-model`,客户端筛选零新数据。
- **做法:** 加价格上限/区间(可复用 tow 的 number-input 模式或双滑块)、长度上限、family 多选下拉;全部走现有 `data-*` + `hidden` 客户端管线,并入 G1 的 URL 态。
- **工作量:** M(3 个控件 + apply() 分支 + 测试)。

### G3. "All floorplans"卡片偏"参数表",缺编辑性挂钩 —— 价值中 / 工作量 M / 不触铁律
- **问题:** All-floorplans 卡片只展示 Length / Dry weight / Sleeps / MSRP 四行干数据(见 hub-all-floorplans 截图),**不显示 tag、定位短语、或一句 pros 摘要**。"By family"很电影感,切到"All floorplans"瞬间塌成数据库——正是 ux-panel-review 里 Designer 担忧的"editorial 入口被压成 database"。用户审美高,会觉得这一屏"太 AI/通用"。
- **价值:** 一行编辑性文案(如 use-case chip 或 specNote 摘要)就能让网格"有人味",维持品牌调性,且帮助快速分群,不增加滚动负担。
- **做法:** 在 `renderExploreCard` body 里补一行轻量 tag chip(复用 tagLabel,排除 D1 的无效 tag)或 heroFamily 定位短语;CSS 控制为静音副文本,移动端可隐。
- **工作量:** M(渲染 + 样式 + 防"太满"克制)。⚠️ 注意:UX 视角(视角4)可能也覆盖卡片视觉,**避免与其重复**——本条聚焦"浏览可读性/分群挂钩",非纯视觉。

### G4. Compare 缺三类买家最关心的派生行 + 无场景挂钩 —— 价值中 / 工作量 M / 不触铁律
- **问题:** 对比表 12 行都是原始规格,**没有:off-grid 续航夜数(estimate.mjs 已能算)、每尺价格($/ft,衡量"贵不贵"的常用换算)、与所选 tow 额定的 fit 判定**。三台并排时,用户仍要自己心算"哪台更划算/更经得住野营/我的车拖得动哪台"。
- **价值:** 把已有的 off-grid 数学(estimate.mjs)和 tow 逻辑(explore.mjs `towFit`)复用到 compare,让对比从"看数字"升级到"看结论",是真正的差异化且零编造(全部基于真实规格推导)。
- **做法:** compare 数据岛已含 battery/solar/tank/gvwr 字段;在 ROWS 里加派生行(默认场景的 off-grid 夜数、$/ft);可选:页面顶部加一个 tow-rating 输入,给每列打 comfortable/within/over 标记(复用 `towFit`)。
- **工作量:** M(派生行 + 可选 tow 输入 + 测试;逻辑已存在,主要是接线)。

### G5. 详情页无"同级/相似车型"与家族内导航 —— 价值中 / 工作量 M / 不触铁律
- **问题:** 详情页是浏览的终点,却**没有"相似布局/同尺寸级/同价位"推荐,也没有家族内 上一/下一 布局切换**。看完 Flying Cloud 25FB 想跳到同级的 Globetrotter 25FB / Trade Wind 25FB(starter 套餐里都已承认它们是同级),只能手动返回重搜。
- **价值:** "看完一台→自然跳到 2-3 台可比的"是高端目录/配置器的标配,延长有意义的浏览、强化"工具懂行"的感觉;数据完全可从 trailers.json 派生(同 floorplan 代号 / 长度±2尺 / 价位带),零编造。
- **做法:** 详情页底部加"Similar floorplans"3 卡条(规则:同 floorplan suffix 或 |Δlength|≤2 且 |Δmsrp| 最近的 3 台,排除自身),复用 `renderExploreCard` 或精简卡;另可加家族内 prev/next。注意图片走 guardrail(用已有 thumb)。
- **工作量:** M(选取规则 + 渲染 + 测试)。⚠️ 与"视角1/概览"或交叉链接提案可能重叠,**若它处已提则降级或合并**。

### G6. 详情页/家族页无法直接加入 compare 或 shortlist —— 价值中 / 工作量 S / 不触铁律
- **问题:** compare 勾选框**只在 All-floorplans 卡片上**有;详情页和家族页看到心仪车型时,没有"加入对比"或"加入 shortlist"的按钮,必须回 explore 网格找到同一台再勾。shortlist(localStorage)已实现但入口窄。
- **价值:** "随看随收"是 ux-panel-review P1 明确要的"Compare-as-tray accrues as you browse";补齐入口让已有的 tray/shortlist 机制真正贯穿浏览动线。
- **做法:** 详情页 header 或 tow callout 旁加一个 compare/shortlist 切换按钮,复用现有 `CMP_KEY` localStorage 协议 + sync 逻辑(app.js 已有 `cmpGet/cmpSet`)。
- **工作量:** S(按钮 + 接现有协议)。

### G7. Compare 表移动端无 sticky 表头/标签列 + best 高亮单靠颜色 —— 价值中低 / 工作量 S / 不触铁律
- **问题:** (a) 移动端 compare 表横滚(min-width 480px)时,**spec 标签列和车型表头会滚走**,看到一个数字不知是哪台哪项;ux-panel-review §3.4 已点名要 `position:sticky` 表头+标签列。(b) best 值仅用绿色✦标记(compare 截图),**色盲/单色不可达**(WCAG 1.4.1 仅靠颜色传达信息)。
- **价值:** 移动端是中国用户主场;sticky + 非颜色冗余(如加粗/下划线/"best"小标)是低成本的可达性与体验补丁。
- **做法:** 纯 CSS:`position:sticky` 给 `.cmp-table thead th` 和 `tbody th`;`.cmp-best` 除颜色外加 `font-weight`/底纹/小角标。
- **工作量:** S(纯 CSS)。⚠️ 视角4(UX)若覆盖 spec-table craft,**归并避免重复**;此处仅作"对比器专项"登记。

### G8. 排序选项有缺口 —— 价值低 / 工作量 S / 不触铁律
- **问题:** `SORT_KEYS` 有 7 项,但缺常用的 **Price 之外的"重量从重到轻 / 长度无、年份、cargo(CCC)"** 等;尤其 tow matcher 激活后**不能按"拖重余量/fit"排序**,只能靠变暗区分。off-grid 已有排序,价格双向有,但买家也常想"按 cargo 容量"或"先看最适配我车的"。
- **价值:** 小幅补全;tow-fit 排序与已上线 tow matcher 自然咬合。
- **做法:** 给 `SORT_KEYS` 增项(ccc-desc 等);tow 激活时插入"按 GVWR 余量"排序。
- **工作量:** S。

---

## 不建议做 / 出界(避免重复 already-shipped 与铁律)

- ❌ 不重做 tow matcher 单输入逻辑、off-grid score、deep-link 视图开关、官方链接、自托管字体、shortlist/compare 存储、histogram(均【已上线】或属其他视角)。
- ❌ 不引入价格/库存/经销商/预订/联盟(铁律)。compare 的 $/ft 是参考换算,非报价,安全。
- ⚠️ 卡片视觉、spec-table 排版美学、view-transition 卡片→详情 morph 属"视角4 UX/视觉",本视角只在 G3/G7 轻点交叉,正式方案让 UX 视角主导,防重复。

---

## 本视角 TOP-2 发现

1. **【数据问题 D1 + 缺口 G2 合流】筛选维度名不副实,是浏览体验最大短板。**
   现有 tag 筛选里 "Off-grid" 命中全部 59 台、"Family" 命中 57 台——点了等于没点;而买家真正要的**价格区间、长度、家族筛选三轴全缺**。结果是 59 台只能靠 Sleeps≥ 和搜索勉强收窄,"筛选器"沦为摆设。**先做 D1(剔除/校准无效 tag,S)+ G2(补价格/长度/家族筛选,M)**,直接修复浏览器的核心"筛"动作,且零铁律风险、复用现有 `data-*` 客户端管线。

2. **【缺口 G1】Explore 筛选结果无法分享/深链,与已上线的 campgrounds 体验割裂。**
   campgrounds 有完整 hash 分享(`share.mjs`),Explore 的筛选/排序/tow 却只落 localStorage,配好的候选视图发不出去、刷新即丢。对身处中国、爱把"已筛好清单"发给同好的用户是高频痛点。**仿 `share.mjs` 把 explore 视图态编进 URL hash(M)**,既补功能又拉平产品一致性,是性价比最高的体验升级。
