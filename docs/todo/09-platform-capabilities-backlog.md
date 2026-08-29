# 小程序平台能力 — 待办 backlog

> 创建日期：2026-08-26  
> 原则：与首页体验 backlog（`06-home-ux-backlog.md`）并列；一次只做一个，优先快修。

---

## 总览

| # | 事项 | 车道 | 预估 | 主要文件 |
|---|------|------|------|----------|
| 13 | 门店入驻页支持转发分享（配图 `sgpk.png`） | 🚀 快 | 2–4h | `package-settings/pages/about`、`constants/brand.ts` |
| 14 | 小程序支持「添加到桌面」并从桌面打开 | 🐢 慢 | 0.5–1d | `app.tsx`、`pages/home`、引导组件（新建） |
| 15 | 引入 NutUI React Taro，局部补齐通用组件 | 🐢 慢 | 1–3d（首期） | `package.json`、主题对接、新页优先使用 |

---

## #13 门店入驻页 — 转发分享能力

### 问题描述

- **现状**：`package-settings/pages/about/index`（门店入驻引导页 / 品牌介绍落地页）无小程序转发能力；用户无法将入驻介绍页分享给潜在合作场馆。
- **期望**：支持微信好友/群聊转发；分享卡片配图统一使用品牌 Logo **`sgpk.png`**（`BRAND_LOGO`，见 `src/constants/brand.ts`），与全站头像/封面默认图策略一致。

### 实现方案

1. **页面配置**：`about/index.config.ts` 增加 `enableShareAppMessage: true`（参考 `schedule/index`、`student-detail/index.config.ts`）。
2. **分享钩子**：在 `about/index.tsx` 使用 `useShareAppMessage`，返回：
   - `title`：如「松果排课 — 免费开通门店，5 分钟完成配置」
   - `path`：`/package-settings/pages/about/index`（带分包完整路径，确保被分享者直达落地页）
   - `imageUrl`：`BRAND_LOGO`（即 `/assets/images/sgpk.png`；微信要求网络图或本地包内图，主包 assets 已满足）
3. **分享入口（可选）**：页内 CTA 旁增加「分享给朋友」按钮，点击后 `Taro.showShareMenu({ menus: ['shareAppMessage'] })` 并 Toast 引导点右上角（参考 `child-detail` 的 `handleShareInvite` 模式）。
4. **范围说明**：本次以 **about 引导页** 为主（对外传播场景）；`store-entry` 申请表单页是否开放转发待产品确认（含权限与隐私）。

### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/package-settings/pages/about/index.config.ts` | 修改 | `enableShareAppMessage: true` |
| `src/package-settings/pages/about/index.tsx` | 修改 | `useShareAppMessage` + 可选分享按钮 |
| `src/constants/brand.ts` | 引用 | `BRAND_LOGO` → `sgpk.png` |

### 验收标准

- [ ] 在 about 页点击右上角「···」可转发给好友/群
- [ ] 分享卡片标题、路径正确；被分享者打开进入 about 落地页
- [ ] 分享配图显示为 `sgpk.png` 品牌图（非截屏默认图）
- [ ] `npm run build:weapp:mock` 通过；真机预览分享卡片样式正常

### 依赖

- 无后端依赖；纯前端 + 微信分享能力。

---

## #14 小程序 — 添加到桌面 & 从桌面打开

### 问题描述

- **现状**：用户仅能通过微信内搜索/最近使用进入小程序；缺少「添加到桌面」引导，机构日常高频使用不便。
- **期望**：
  1. 在合适触点引导用户将小程序添加到系统桌面（Android）或「我的小程序」（全平台）；
  2. 从桌面图标冷启动时，小程序能正常进入首页/上次角色上下文，无白屏或登录态丢失。

### 平台说明（微信）

| 能力 | 说明 |
|------|------|
| 添加到我的小程序 | 用户点右上角「···」→「添加到我的小程序」；可用 `wx.checkIsAddedToMyMiniProgram` 查询是否已添加 |
| 添加到桌面（Android） | 部分版本/机型支持「添加到桌面」生成系统快捷方式；**无强制一键 API**，需产品引导 + 可选 `openSetting` |
| 桌面启动场景值 | `scene` **1023**（安卓桌面图标）、**1028**（我的小程序）等；需在 `onLaunch` / `onShow` 识别并走统一启动逻辑 |

### 实现方案

1. **启动场景处理**：在 `app.tsx`（或统一启动 util）记录 `launchOptions.scene`；桌面/我的小程序入口与扫码等入口共用现有登录与角色恢复，必要时 Toast「欢迎回来」一次（可配置关闭）。
2. **引导组件**：新建如 `AddToDesktopTip`（或复用 BottomSheet）：
   - 未添加时：在 **首页** 或 **我的** 页首次展示图文引导（箭头指向右上角菜单）；
   - 调用 `Taro.checkIsAddedToMyMiniProgram`（需基础库版本判断 + `canIUse` 降级）；
   - 已添加则不再打扰（`storage` 记 `yunce:add-to-desktop-dismissed`）。
3. **文案区分**：Android 可写「添加到桌面，下次从桌面打开」；iOS 写「添加到我的小程序，下拉微信首页即可找到」。
4. **图标**：引导示意图/示例可用 `BRAND_LOGO`（`sgpk.png`）保持品牌一致。
5. **配置**：评估是否在 `app.config.ts` 声明相关隐私/权限说明（若后续接官方「添加到桌面」开放能力再补）。

### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/app.tsx` | 修改 | 识别 scene 1023/1028 等桌面入口 |
| `src/pages/home/index.tsx` 或 `src/pages/profile/index.tsx` | 修改 | 挂载引导组件 |
| `src/components/AddToDesktopTip/`（新建） | 新增 | 引导 UI + storage 频控 |
| `src/utils/launch-scene.ts`（可选新建） | 新增 | scene 常量与判断 |

### 验收标准

- [ ] 未添加用户可在首页/我的看到引导，关闭后不再重复弹出（除非清除缓存）
- [ ] `checkIsAddedToMyMiniProgram` 为 true 时不展示引导
- [ ] **正式版**从安卓桌面图标启动（scene 1023）可正常进入并保持登录态
- [ ] 从「我的小程序」启动（scene 1028）行为一致
- [ ] 开发者工具「编译模式 → scene 1023」可复现启动日志 `[App Launch]`
- [ ] 体验版/开发版**不引导**「添加到桌面」（官方不支持，点图标会闪退）

### 已知平台限制（2026-08-26 真机验证）

1. **桌面快捷方式仅正式版稳定支持**（微信 FAQ）。体验版/开发版/真机调试包从桌面打开常「闪一下退出」——这是微信客户端限制，不是业务逻辑可完全修掉的。
2. **桌面图标启动 ≠ 真机调试会话**：桌面打开的是独立小程序进程，**不会**把 `console` 打进当前「真机调试」面板；因此看不到 `[App Launch]` 是正常现象。要用开发者工具「模拟进入场景 1023」才能在控制台看到 scene。
3. **`backgroundfetch privacy fail` errno 101**：多为微信客户端启动时系统级 `private_getBackgroundFetchData` 噪音，**不是我们业务代码调用**；与桌面闪退无直接因果关系。消除噪音需公众平台《用户隐私保护指引》配置并发布后，再将 `__usePrivacyCheck__: true`。
4. 主包体积已逼近 1536KB 上限（约 1503KB），冷启动更敏感；后续需继续瘦主包。

### 依赖

- 无后端依赖；依赖微信基础库版本（需查最低支持版本并在代码中 `canIUse` 降级）。
- **正式验收必须用正式版**真机从桌面打开。

---

## #15 引入 NutUI React Taro — 局部补齐通用组件

> 录入日期：2026-08-29  
> 状态：**后续再做**（不阻塞当前业务）

### 问题描述

- **现状**：小程序端无第三方 UI 组件库；界面依赖 `@tarojs/components` + 自研 `src/components/**` + UnoCSS。课表/点名等业务组件已较完整，但通用件（表单控件、Picker、标准 Dialog/Toast、空态等）仍分散自写，新页重复成本高。
- **期望**：后续引入 **NutUI React Taro**（`@nutui/nutui-react-taro`），**仅局部**用于通用组件补齐；**不**全站替换现有业务组件。

### 推荐理由（已确认）

1. Taro 4 + React 官方生态，与当前 `4.1.9` 契合度最高。
2. 组件覆盖面适合补「通用层」，文档与维护相对稳定。
3. 全量替换成本过高（自研组件上百个 + UnoCSS/主题变量）；局部引入风险可控。

### 实现原则

1. **业务层不动**：课表卡、点名页、左滑操作、约试听等继续用现有自研组件。
2. **新页 / 通用场景优先用库**：表单、日期时间选择、标准弹窗、空态、Loading 等。
3. **主题对接**：NutUI 主题色对齐现有 CSS 变量 / 品牌主色，避免两套视觉打架。
4. **体积门禁**：接入前后对比主包体积；按需引入 + tree-shaking，逼近 1.5MB 时优先砍非必要组件。
5. **禁止一次性大迁移**：旧页不强制改写；有改动需求时再逐步替换通用件。

### 建议首期范围

| 类型 | 示例 | 策略 |
|------|------|------|
| 表单 | Input / Switch / Checkbox / Radio | 新页用 NutUI |
| 选择 | Picker / DatePicker / Cascader | 新页用 NutUI |
| 反馈 | Dialog / Toast / ActionSheet | 与现有 `ConfirmDialog`/`BottomSheet` 并存，新场景优先评估 |
| 展示 | Empty / Skeleton / Tag | 可逐步统一 |

### 验收标准（开工后再勾）

- [ ] 依赖与构建配置接入 Taro 4 weapp，`build:weapp:mock` / `build:weapp:prod` 通过
- [ ] 至少 1 个新业务页（或试点页）使用 NutUI 通用组件且主题色一致
- [ ] 主包体积增幅可接受（有前后对比记录）
- [ ] 课表 / 点名等核心业务页回归无回归问题

### 依赖

- 无后端依赖；需评估与 UnoCSS、现有 `theme` / `app.scss` 的样式隔离。
- 开工前再核对 `@nutui/nutui-react-taro` 与 Taro `4.1.9` 的兼容版本。

---

## 执行顺序建议

```
🚀 #13 门店入驻转发（约半天，可独立上线）
  ↓
🐢 #14 添加到桌面（需真机 + 多 scene 验证）
  ↓
🐢 #15 NutUI 局部补通用组件（后续；不阻塞业务）
```

---

## 代码锚点（便于开工）

| 模块 | 路径 |
|------|------|
| 门店入驻引导页 | `src/package-settings/pages/about/index.tsx` |
| 品牌 Logo（sgpk） | `src/constants/brand.ts` → `BRAND_LOGO` |
| 分享参考（课表页） | `src/pages/schedule/index.tsx` → `useShareAppMessage` |
| 分享参考（学员详情） | `src/package-student/pages/child-detail/index.tsx` → `showShareMenu` |
| 应用入口 | `src/app.tsx` |
| 自研组件目录 | `src/components/` |
| 主题 / Uno | `src/theme.ts`、`uno.config.ts`、`src/app.scss` |
