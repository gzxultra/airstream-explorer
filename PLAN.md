# Airstream Explorer — 功能路线图

> 最后更新：2026-07-09 · commit `00765e6` · 795 tests · 99 HTML pages · 1026 images
> 站点：https://airstream-explorer.pages.dev
> 仓库：github.com/gzxultra/airstream-explorer

---

## 项目概况

纯 Node.js 静态站生成器 → Cloudflare Pages。12 个 Airstream 旅行拖挂家族 / 59 个车型详情页（31×2026 + 28×2025），11 个房车详情页。设计风格：cinematic editorial quiet luxury，Fraunces + DM Sans，暗色/亮色双主题。

### 代码规模
| 类别 | 数量 |
|------|------|
| 构建输出 | 65 MB dist/ |
| 测试 | 795 pass / 53 test files |
| app.js | 5,642 行 |
| CSS (4 files) | 4,808 行 |
| 数据/渲染模块 | 27 .mjs |

---

## ✅ 已完成功能（30 轮升级，按类别）

### 核心浏览
- [x] 12 家族 / 59 拖挂 + 11 房车详情页
- [x] 全文搜索 + 排序（价格/重量/长度/睡眠/离网/CCC/牵引重量）
- [x] 多维筛选：年份 / 睡眠人数 / 预算 / 长度 / 重量 / 牵引 / 标签 / 布局特征
- [x] 活跃筛选摘要条（pill 标签可单独移除 + Clear all）
- [x] 网格/列表视图切换（偏好持久化）
- [x] 保存/收藏系统（跨页面，nav badge 实时计数）
- [x] 最近浏览历史（12 条，带缩略图）
- [x] Quick-view 弹窗（不离开列表页查看概要）

### 详情页
- [x] Cinematic 全屏 hero + 视差滚动
- [x] 最多 10 张官方照片 gallery + lightbox（键盘/触控/滑动）
- [x] 规格雷达图 + 百分位排名
- [x] 关键数据仪表板（animated key stats）
- [x] 重量承载条 + 滚动动画
- [x] 可折叠详情区块
- [x] 规格术语悬浮解释（glossary tooltips）
- [x] Standout 徽章（同家族/全车队最佳项）
- [x] 前后翻页导航
- [x] 分享/复制规格/打印
- [x] 阅读进度条
- [x] 面包屑导航 + JSON-LD

### 工具与计算器
- [x] 拖曳匹配计算器（19+ 真实车辆数据）
- [x] 油耗/电费估算器（含 EV/luxury SUV）
- [x] 载荷计算器（水/丙烷/装备逐项）
- [x] 离网天数估算（太阳能 + 用电量）
- [x] 月供融资计算器（首付/利率/期限滑块）
- [x] 持有成本估算器
- [x] 年份间规格对比（Year-over-year diff）
- [x] 英制 ↔ 公制单位切换
- [x] 生活方式问卷推荐

### 营地与旅行
- [x] 2,561 个 Recreation.gov 营地 + 地图
- [x] 营地适配度计算（长度/hookup 匹配）
- [x] 编辑精选 / 国家公园 / 暗夜观星 / 水边 等主题合集
- [x] 营地可用性查询
- [x] 干式露营资源指南
- [x] 暗夜天空评分

### 跨车型对比
- [x] 对比选择栏 + 对比矩阵页
- [x] 家族内规格对比表
- [x] 跨家族推荐（相似车型）
- [x] 卡片规格位置条（fleet 百分比）

### 设计与体验
- [x] 暗色/亮色主题（OS 跟随 + 手动切换 + 持久化）
- [x] Sticky 毛玻璃导航栏
- [x] View transitions + 即时预加载导航
- [x] 图片懒加载 + 铜色骨架闪烁
- [x] 键盘快捷键系统（? 帮助面板）
- [x] 返回顶部浮动按钮
- [x] Section scroll-spy 导航
- [x] Section reveal 入场动画
- [x] Gallery hover zoom
- [x] 触控友好的 tooltip

### SEO & PWA
- [x] sitemap.xml / robots.txt（96 URL）
- [x] PWA manifest + 全套 favicon/icon
- [x] OG + Twitter cards
- [x] JSON-LD Product + BreadcrumbList
- [x] LCP preload hints
- [x] 品牌 404 页
- [x] 社区照片页（Wikimedia CC 授权归属）

### 基础设施
- [x] GitHub Actions CI → Cloudflare Pages 自动部署
- [x] 内容指纹 + 长缓存
- [x] 自托管字体（Google Fonts woff2）
- [x] 本地 MapLibre + 矢量底图
- [x] 同源 CF Functions 瓦片/图片代理
- [x] 官方 airstream.com 照片（669 张，0 AI）

---

## 🔄 进行中

- [ ] 每 2 小时自动升级 cron（持续迭代）

---

## 📋 下一步规划（按优先级）

### P0 — 高价值功能
- [ ] **户型平面图交互** — 可点击的 floorplan SVG/标注图，hover/tap 显示区域尺寸和功能描述。当前 floorplanHotspots 数据为空，需要采集或手绘
- [ ] **真实车主评价聚合** — 从 Airstream Forums / Reddit r/Airstream 抓取真实评价要点，按车型/家族聚合（painPoints / qaSummaries 目前为空）
- [ ] **改装升级指南** — upgrades.html 页面已存在但内容深度不够。按类别（太阳能/锂电池/Wi-Fi/悬挂）提供具体产品推荐 + 安装要点 + 兼容车型
- [ ] **旅行路线规划器** — 输入起点/终点，推荐沿途 Airstream 友好营地，考虑拖挂长度限制和海拔

### P1 — 体验提升
- [ ] **移动端手势导航** — 详情页左右滑动切换车型（当前只有底部按钮）
- [ ] **离线模式** — Service Worker 缓存核心页面 + 已收藏车型，弱网/无网可用
- [ ] **搜索自动补全** — 输入时实时建议车型名 + 家族名
- [ ] **规格对比并排视图** — 选中 2-3 个车型后，规格表逐行高亮差异
- [ ] **详情页锚点深链** — URL hash 直达具体 section（#specs, #tow, #gallery），分享时精确定位

### P2 — 内容扩展
- [ ] **经销商地图** — 集成 Airstream 官方经销商位置，显示距离+联系方式（当前只有外链）
- [ ] **二手车市场行情** — 各车型二手价格范围/保值率参考（需数据源验证）
- [ ] **季节性营地推荐** — 按月份/季节推荐最佳目的地，关联车型适配
- [ ] **装备清单生成器** — 根据选中车型 + 旅行类型生成装备/物资清单
- [ ] **水/电/丙烷用量追踪模板** — 可下载的旅行记录模板

### P3 — 技术优化
- [ ] **增量构建** — 当前全量构建 59+11 页，改为只重建变更的页面
- [ ] **图片 CDN 优化** — srcset + sizes 响应式图片，按设备分辨率加载
- [ ] **构建产物体积优化** — CSS/JS tree-shaking，当前 65MB dist 可瘦身
- [ ] **E2E 测试** — Playwright 关键路径覆盖（首页→筛选→详情→对比→收藏）

---

## 🚫 明确不做

- i18n / 多语言翻译
- 无障碍专项（已有基础 a11y）
- 纯重构无用户可见改善
- 电商/支付/联盟营销
- 编造或猜测规格数据

---

## 升级日志（近 10 轮）

| 轮次 | Commit | 主要改进 | 测试数 |
|------|--------|---------|--------|
| R13 | `00765e6` | 年份规格对比、持有成本估算、可折叠详情区块 | 795 |
| R12 | `9153827` | 月供计算器、CCC/牵引排序、下一步行动卡 | 795 |
| R11 | `3d584e4` | 布局特征筛选、返回顶部、筛选摘要条 | 778 |
| R10 | `88b4116` | 规格位置条、骨架闪烁、hero 视差 | 763 |
| R9 | `754980a` | 网格/列表切换、前后翻页、最近浏览 | 742 |
| R8 | `a49248f` | 拖曳车匹配、长度/重量筛选、兼容车辆面板 | 732 |
| R7 | `78144c3` | 雷达图、跨家族推荐、scroll-spy 导航 | — |
| R6 | `ab367aa` | 面包屑+JSON-LD、editorial footer、lightbox zoom | — |
| R5 | `ef9c4f9` | 生活方式问卷、重量条动画、gallery hover zoom | — |
| R4 | `376b890` | 百分位排名、quick-view 弹窗、animated stats | — |

---

## 决策记录

1. **不用框架** — 纯 Node.js SSG，无 React/Vue/Astro。构建快、产物小、完全可控
2. **规格数据锁定** — 经过多轮对照 airstream.com 校验，refreshCatalog 已禁用，手动更新
3. **官方照片优先** — 669 张 Storyblok 官方照片，0 AI 生成图（hero 除外）
4. **同源代理** — 地图瓦片/营地图片走 CF Pages Functions 代理，中国网络也能用
5. **双年份共存** — 2026 为主，2025 保留且可筛选，年份对比功能已上线
