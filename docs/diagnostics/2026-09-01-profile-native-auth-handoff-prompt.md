# 完善资料页 · 微信官方标准授权 — 修复方案提示词

> **用途**：复制下方「Agent 提示词」整段，交给 Cursor Agent 执行。  
> **Git 备份已完成**（2026-09-01）：  
> - FE `yunceTaro` → `1614ee8`  
> - BE `yunce-backend` → `1a5633d`（本任务 **不改后端**）

---

## 背景与目标

用户反馈：「完善资料」页的头像/昵称选择、位置授权、订阅消息、相册权限等，应使用 **微信官方原生 UI**（见截图：头像 bottom sheet「用微信头像 / 从相册选择 / 拍照 / 取消」；位置授权弹窗含隐私指引勾选）。

**硬性约束**

1. **最小改动**：只改与「官方标准授权 UX」直接相关的代码，**不要**重构业务逻辑、接口、路由、其他页面。
2. **不改后端** API / 数据库 / seed。
3. **不碰**以下页面（除非编译报错被迫改 import）：`student-form`、`feedback`、`lesson-form`、排课/班课/邀请等核心业务流。
4. 保留现有上传 CDN、`updateProfile`、`navigateAfterProfileSetup` 行为不变。
5. **改完后必须满足 FE 门禁 CI**（见下方「CI 门禁与覆盖率」），全部通过后再交付。

---

## 现状审计（已确认）

### 1. 完善资料页 — 非标准 ❌

文件：`src/package-auth/pages/profile-setup/index.tsx`

| 能力 | 现状 | 官方标准 |
|------|------|----------|
| 头像 | `View onClick` → 自定义 `Taro.showActionSheet` → 相册走 `chooseImageTemp`；微信头像走自定义 `BottomSheet` + 内嵌 `Button openType="chooseAvatar"` | **头像区域本身**应为 `<button open-type="chooseAvatar" plain>` 包裹预览图；用户点击后微信弹出原生 sheet（用微信头像 / 从相册选择 / 拍照 / 取消） |
| 昵称 | `Input type="nickname"` ✅ | 保持；仅可微调文案/样式，**不要**改回普通 text input |
| 相册隐私 | `pickFromAlbum` 内 `ensurePrivacyAuthorized()` ✅ | `chooseAvatar` 选相册/拍照时微信会走隐私链路；**删除**本页独立的 `showActionSheet` + `chooseImageTemp` 头像路径后，相册隐私由原生 + App 级 `PrivacyPopup` 兜底 |

需删除/精简：

- `handleAvatarEntry`、`pickFromAlbum`、`wechatAvatarSheetOpen` 状态
- `BottomSheet` 组件及其 import
- `chooseImageTemp`、`ensurePrivacyAuthorized` 在本页的 import（若不再使用）
- 自定义 `showActionSheet` 文案「从相册选择 / 使用微信头像」

需保留/迁移：

- `handleWechatAvatar`（绑定 `bindchooseavatar` / `onChooseAvatar`）
- `handleSubmit` 内 `isLocalWechatFilePath` → `uploadImage` → `updateProfile` 逻辑

**参考实现骨架（示意，样式沿用现有 Tailwind class）：**

```tsx
<button
  className="... 去默认 button 样式 after:border-none ..."
  open-type="chooseAvatar"
  onChooseAvatar={handleWechatAvatar}
>
  <Image src={resolveAvatarSrc(avatarUrl) || BRAND_LOGO} ... />
</button>
```

注意：微信小程序 `button` 需 `plain` 或自定义 class 去掉默认边框；Taro 用 `Button` + `openType="chooseAvatar"`。

官方文档关键词：**头像昵称填写能力**、`open-type="chooseAvatar"`、`type="nickname"`。

### 2. 位置授权 — 基本标准，仅微调 ⚠️

文件：`src/utils/location-authorize.ts`  
调用方（本任务仅确认，**不改** `store-entry` 业务）：`src/package-settings/pages/store-entry/index.tsx` 已按 `ensurePrivacyAuthorized()` → `ensureUserLocationAuthorized()` → `chooseLocation` 顺序调用 ✅

- `Taro.authorize({ scope: 'scope.userLocation' })` 会触发微信原生位置授权弹窗（含隐私指引）✅
- 用户拒绝后的 `showModal` + `openSetting` 是官方推荐的 **二次引导**，可保留
- **不要**在 authorize 之前再弹自定义「申请位置」全屏 Dialog 替代原生

若 profile-setup 未来需要位置：**复用** `ensurePrivacyAuthorized` + `ensureUserLocationAuthorized`，不要新写一套。

### 3. 订阅消息 — 注册链路已标准 ✅ / 业务弹窗不在本任务范围

- `register/role-info.tsx` 已在用户点击内调用 `subscribeMessageService.requestNativeNotifyAuth` → 内部 `Taro.requestSubscribeMessage` ✅
- `subscribe-message.ts` 的 `runFlow` / `SubscribePromptDialog` 是 **业务说明层**（先解释再调原生面板），**本任务不重构**全站订阅流程
- profile-setup **不要**新增自定义订阅弹窗；若要在「完成并继续」后 opt-in，应 **在用户 tap 回调内**直接 `requestNativeNotifyAuth`，与 role-info 一致

### 4. 相册权限 — profile-setup 改完后由 chooseAvatar 原生覆盖 ✅

- App 级：`app.config.ts` 已 `__usePrivacyCheck__: true`；`utils/privacy.ts` + `PrivacyPopup` + `onNeedPrivacyAuthorization` 已就绪 ✅
- `utils/privacy-authorize.ts` 的 `ensurePrivacyAuthorized` 供 **非 chooseAvatar** 的 `chooseMedia/chooseImage` 使用；profile-setup 改原生后本页可不再调用
- **不要**改 `student-form` / `feedback` 等处的 `chooseImage`（超出范围）

---

## 允许修改的文件清单（白名单）

| 文件 | 改动类型 |
|------|----------|
| `src/package-auth/pages/profile-setup/index.tsx` | **主改**：原生 chooseAvatar 按钮化头像区 |
| `src/package-auth/pages/profile-setup/index.scss` 或同目录样式（若有） | 仅 button 重置样式 |
| `src/utils/location-authorize.ts` | 可选：注释/极小调整，禁止改公开 API 签名 |
| 与 profile-setup 直接相关的 snapshot/test（若存在） | 同步期望 |

**禁止修改**：`subscribe-message.ts` 的 runFlow 逻辑、`SubscribePromptDialog`、各 package-course/package-student 业务页、后端任何文件。

---

## CI 门禁与覆盖率

对齐 `docs/diagnostics/2026-08-31-dev-ci-gate.md` 中 FE 层；**交付前本地必须全绿**：

| 步骤 | 命令 | 通过标准 |
|------|------|----------|
| 静态检查 | `npm run check` | typecheck + eslint + prettier 零 error |
| 单测 | `npm test` | 全部用例通过（当前约 132 个，不得 regress） |
| 覆盖率门禁 | `npm run coverage` | **lines ≥ 30%**（`vitest.config.ts` → `coverage.thresholds.lines`） |

**覆盖率说明（`vitest.config.ts`）：**

- 门禁仅统计 `coverage.include` 白名单内的 data/constants/utils 文件（如 `src/data/store-entry.ts`、`src/components/DatePickerSheet/date-picker-utils.ts` 等），**不包含** `profile-setup` 页面本身。
- 本任务通常**不必**把 profile-setup 加入 coverage include；但若改动导致既有单测失败或覆盖率跌破 30%，必须修复或补测直至 `npm run coverage` 通过。
- 若从 profile-setup **抽取可测纯函数**（如 avatar 路径校验）到 `src/utils/`，优先写 `*.test.ts` 放在同目录；**不要**为凑覆盖率而改 `vitest.config.ts` 的 thresholds（禁止下调门槛）。

**相关既有测试（改动后须回归）：**

- `src/utils/auth-onboarding.test.ts`（含跳转 `profile-setup` 断言）
- 其他 auth / image-upload 相关 `*.test.ts`（若 import 或 mock 受影响）

**可选（与全站 CI 对齐，有时间则跑）：**

```bash
npm run build:weapp:dev   # 测环境包，确认编译无报错
```

---

## 验收标准（真机微信小程序）

1. 完善资料页点击头像 → 出现微信 **原生** bottom sheet（用微信头像 / 从相册选择 / 拍照 / 取消），**不出现**项目自定义 ActionSheet 或 BottomSheet。
2. 选微信头像 / 相册 / 拍照后，预览更新；点「完成并继续」能上传并保存。
3. 昵称输入框聚焦 → 键盘上方可出现微信昵称推荐（`type="nickname"`）。
4. 门店入驻选地址（store-entry，回归即可）：先隐私指引 → 原生位置授权 → 地图选点。
5. 注册完成点击订阅（role-info）：直接出现微信订阅消息原生面板，无新增自定义弹层。
6. **CI 门禁全绿**：`npm run check` + `npm test` + `npm run coverage`（lines ≥ 30%）均通过。

---

## Agent 提示词（复制以下全文）

```
任务：将 yunceTaro 完善资料页的头像/昵称与权限交互改为微信官方标准做法，最小 diff，不影响其他业务代码。

仓库路径：d:\Coding\yunce\yunceTaro
Git 备份点：1614ee8（勿 amend，新改动单独 commit）

## 必须做

1. 修改 `src/package-auth/pages/profile-setup/index.tsx`：
   - 删除自定义 `Taro.showActionSheet`、`BottomSheet`、`pickFromAlbum`、`wechatAvatarSheetOpen` 及相册 chooseImageTemp 头像路径。
   - 将头像预览区域改为 `<Button openType="chooseAvatar" onChooseAvatar={handleWechatAvatar}>` 包裹 Image（plain + 去掉默认 button 边框），让用户点击头像直接触发微信原生 sheet（用微信头像/相册/拍照/取消）。
   - 保留 `Input type="nickname"` 与现有 keyboardInset 逻辑。
   - 保留 handleSubmit：本地路径 uploadImage → updateProfile → navigateAfterProfileSetup，行为不变。
   - 更新文件头注释，描述官方做法。

2. 清理无用 import（BottomSheet、chooseImageTemp、ensurePrivacyAuthorized 等若不再使用）。

3. **满足 FE 门禁 CI（交付前必须全绿，按顺序执行并修复直至通过）：**
   ```bash
   npm run check          # typecheck + lint + format:check
   npm test               # vitest 全量，不得有失败用例
   npm run coverage       # 覆盖率门禁：lines ≥ 30%（见 vitest.config.ts thresholds）
   ```
   - 若改动影响 `auth-onboarding.test.ts` 等既有测试，同步更新 mock/断言。
   - 禁止为通过门禁而下调 `vitest.config.ts` 的 coverage thresholds。
   - 若抽取新的纯函数到 utils，补对应 `*.test.ts`，避免覆盖率跌破门槛。

4. （推荐）`npm run build:weapp:dev` 确认编译通过。

## 不要做

- 不改后端、不改 API、不改 auth-onboarding 路由逻辑（除非 profile-setup 编译依赖）。
- 不重构 subscribe-message runFlow / SubscribePromptDialog。
- 不改 student-form、feedback、lesson-form、store-entry 业务逻辑（store-entry 仅作真机回归参考）。
- 不新增 markdown 文档（除非用户要求）。
- 不 commit，除非用户明确要求。

## 参考

- 审计文档：`docs/diagnostics/2026-09-01-profile-native-auth-handoff-prompt.md`
- 位置/隐私基建：`utils/privacy-authorize.ts`、`utils/location-authorize.ts`、`utils/privacy.ts`
- 订阅原生入口：`services/subscribe-message.ts` → `requestNativeNotifyAuth`（register/role-info 已正确使用）

完成后简要说明：改了哪些文件、CI 三门禁命令输出摘要（check / test / coverage 是否全绿）、真机如何验证、是否有意未改动的范围。
```

---

## 真机验证路径

1. 微信开发者工具 / 真机打开 **dev 包**（`npm run build:weapp:dev`）。
2. 新用户或清缓存 → 微信登录 → 进入 **完善资料** → 点头像看原生 sheet。
3. 填昵称 → 完成并继续 → 确认跳转 onboarding 正常。
4. （可选）校长账号 → 门店入驻 → 选地址 → 确认位置原生授权弹窗。

---

## 相关文件索引

```
src/package-auth/pages/profile-setup/index.tsx   ← 主改
src/utils/privacy-authorize.ts
src/utils/location-authorize.ts
src/utils/privacy.ts
src/components/PrivacyPopup/
src/app.config.ts                                ← __usePrivacyCheck__
src/services/subscribe-message.ts                ← requestNativeNotifyAuth（只读参考）
src/package-auth/pages/register/role-info.tsx    ← 订阅标准参考
src/package-settings/pages/store-entry/index.tsx ← 位置标准参考
```
