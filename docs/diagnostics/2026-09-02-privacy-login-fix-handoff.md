# 隐私授权 × 登录流程修复 — 变更记录与比对基准

> **日期**：2026-09-02  
> **基准 commit**：`ad870c4`（`yunceTaro` 仓库 HEAD，修改均为工作区未提交）  
> **问题**：登录页隐私弹窗不出现；图二「用户协议」同意后微信登录无反应、无后端请求  

---

## 1. 问题根因（本次判定）

| 层级 | 问题 | 后果 |
|------|------|------|
| **假同步栈** | 上一轮 `promptPrivacySyncInHandler` 在 `getPrivacySetting.success`（异步）里才调 `requirePrivacyAuthorize` | 真机上 require 被忽略 → 不弹窗、不走 success/fail → 登录挂死 |
| **假同意按钮** | `PrivacyPopup` 无 pending 时用普通 `View` 当「同意」 | 微信侧未记录授权，后续 API 仍 blocked |
| **二次门闩** | `executeWechatLogin` 内再 `await ensurePrivacyBeforeAuth()` | 同步授权成功后仍可能被异步查询掐断 |
| **进页不弹** | 启动逻辑刻意不在冷启动弹隐私；登录页也未主动查 `needAuthorization` | 用户期望「进登录页就弹图一」无法满足 |

**图一 vs 图二**：图一是微信《用户隐私保护指引》（`PrivacyPopup` / 系统框）；图二是业务《用户协议》（`AgreementDialog`）。两套独立，顺序应为：**隐私 → 用户协议 → 登录**。

---

## 2. 本次修改思路

```
┌─────────────────────────────────────────────────────────────┐
│ 进入登录页                                                    │
│   promptPrivacyOnPageEnter()                                │
│   → getPrivacySetting → needAuthorization=true 则展示 PrivacyPopup │
│   → 用户点原生「同意」按钮 → 微信侧记录授权                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 点击「微信一键登录」                                           │
│   未勾协议 → AgreementDialog（图二）                           │
│   点「同意」→ promptPrivacySyncInHandler（同步栈）            │
│     ★ 立刻 requirePrivacyAuthorize（不等 getPrivacySetting） │
│     → 已授权：立即 success → executeWechatLogin              │
│     → 未授权：onNeedPrivacyAuthorization → PrivacyPopup       │
│   executeWechatLogin：直接 Taro.login，不再 await 隐私门闩    │
└─────────────────────────────────────────────────────────────┘
```

**核心约束（微信官方）**：
- `requirePrivacyAuthorize` 必须在用户点击的**同步调用栈**内调用
- `getPrivacySetting` 的 success **一定是异步**，不能在其回调里 require
- 「同意」必须是 `<Button open-type="agreePrivacyAuthorization">`

---

## 3. 改动文件清单（本次隐私登录相关）

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `src/utils/privacy-authorize.ts` | **重写核心** | 新增 `promptPrivacySyncInHandler`（真同步 require）、`promptPrivacyOnPageEnter`；移除「先 get 再 require」 |
| `src/components/PrivacyPopup/index.tsx` | **重写 UI** | 始终用原生 agree 按钮；去掉无 pending 时的假 View 同意 |
| `src/package-auth/pages/login/index.tsx` | **登录链路** | 进页 `promptPrivacyOnPageEnter`；协议确认后同步 require；去掉 execute 内二次门闩 |
| `src/package-auth/pages/register/index.tsx` | 同步 | 去掉 executeRegister 内 `ensurePrivacyBeforeAuth` |
| `src/package-lead/pages/invite-landing/index.tsx` | 同步 | 同上 |
| `src/utils/privacy.ts` | 注释更新 | 文档化监听注册与同步 require 约束 |
| `src/app.tsx` | 已有 | 模块加载即 `registerPrivacyListener()` |
| `src/utils/privacy-authorize.test.ts` | **新增** | 含「getPrivacySetting 永不回调仍须 require」防回归用例 |

**关联但未在本轮改动的文件**（历史迭代已有改动，测试时一并带入）：
- `src/stores/privacy.ts` — pending resolve / showBlockedGate
- `src/utils/app-startup.ts` — 冷启动不弹隐私
- `src/app.config.ts` — `__usePrivacyCheck__: true`

---

## 4. 修改前代码状态（便于 git / 多轮比对）

### 4.1 Git HEAD（`ad870c4`）— 最后一次提交

**登录页**：无任何隐私逻辑，协议同意后直接登录。

```tsx
// src/package-auth/pages/login/index.tsx（HEAD）
const handleWechatLogin = useCallback(() => {
  // ...
  if (!ensureAgreement('wechat')) return;
  void executeWechatLogin();  // 无隐私检查
}, [...]);

const handleAgreementConfirm = useCallback(() => {
  setAgreed(true);
  setShowAgreementDialog(false);
  if (pendingAction === 'wechat') void executeWechatLogin();  // 直接登录
}, [...]);
```

**privacy-authorize.ts（HEAD）**：仅 ~40 行，`ensurePrivacyAuthorized` 给相册选图用，无登录入口。

```tsx
// src/utils/privacy-authorize.ts（HEAD）— 全文逻辑
export async function ensurePrivacyAuthorized(): Promise<void> {
  await new Promise((resolve, reject) => {
    requirePrivacyAuthorize({
      success: () => resolve(),
      fail: (err) => { /* cancel → reject */ },
    });
  });
}
```

**PrivacyPopup（HEAD）**：BottomSheet + 始终原生 agree 按钮（无 blocked gate / 无 pending 分支）。

---

### 4.2 修改前工作区（上一轮错误修复，本次改之前）

**症状对应**：图二同意后无反应 —— 正是此版本行为。

```tsx
// src/utils/privacy-authorize.ts（错误版本 — 已废弃）
export function promptPrivacySyncInHandler(onAuthorized, onDenied) {
  Taro.getPrivacySetting({
    success: (res) => {
      if (!res.needAuthorization) { onAuthorized(); return; }
      // ★ BUG：require 在 getPrivacySetting 异步 success 里
      callRequirePrivacyAuthorizeSync(onAuthorized, onDenied);
    },
  });
}
```

```tsx
// src/components/PrivacyPopup/index.tsx（错误版本 — 已废弃）
{hasPending ? (
  <Button openType="agreePrivacyAuthorization" ...>同意并继续</Button>
) : (
  <View onClick={() => void handleRetry()}>  // ★ 假同意，微信不认
    同意隐私保护指引并继续
  </View>
)}
```

```tsx
// src/package-auth/pages/login/index.tsx（错误版本 — 已废弃）
const executeWechatLogin = async () => {
  const privacyOk = await ensurePrivacyBeforeAuth();  // ★ 二次门闩
  if (!privacyOk) return;
  await Taro.login();
};
```

---

### 4.3 修改后（当前工作区，待你测试）

**`promptPrivacySyncInHandler` 关键段**：

```tsx
// src/utils/privacy-authorize.ts（当前）
export function promptPrivacySyncInHandler(onAuthorized, onDenied) {
  store.setPrompting(true);
  // 旁路刷文案，不参与决策
  Taro.getPrivacySetting({ success: (res) => store.setContractName(res.privacyContractName) });
  // ★ 同步栈立刻 require
  callRequirePrivacyAuthorizeSync(
    () => { store.setStatus('authorized'); onAuthorized(); },
    () => { store.showBlockedGate(); onDenied?.(); },
  );
}
```

**登录页进页 + 协议确认**：

```tsx
// src/package-auth/pages/login/index.tsx（当前）
useEffect(() => { promptPrivacyOnPageEnter(); }, []);

handleAgreementConfirm = () => {
  setAgreed(true);
  setShowAgreementDialog(false);
  promptPrivacySyncInHandler(() => {
    if (pendingAction === 'wechat') void executeWechatLogin();
    // ...
  });
};

executeWechatLogin = async () => {
  // 不再 await ensurePrivacyBeforeAuth
  Taro.showLoading({ title: '登录中...' });
  const { code } = await Taro.login();
  // ...
};
```

**PrivacyPopup 同意按钮**：

```tsx
// src/components/PrivacyPopup/index.tsx（当前）
<Button
  id={PRIVACY_AGREE_BUTTON_ID}
  openType="agreePrivacyAuthorization"
  onAgreePrivacyAuthorization={handleAgreePrivacyAuthorization}
>
  同意
</Button>
// 无 pending 时：handleAgree 直接 setStatus('authorized') + setVisible(false)
```

---

## 5. 测试检查清单

### 预期（修改后）

- [ ] 清缓存 / 新用户：进入登录页 → 底部弹出「用户隐私保护提示」（PrivacyPopup）
- [ ] 点「同意」→ 弹窗关闭 → 可正常操作登录表单
- [ ] 点「微信一键登录」→ 弹出「用户协议」（图二）→ 点「同意」→ 出现 loading → Network 有 `Taro.login` + 后端 signIn 请求
- [ ] 已授权用户：进登录页不弹隐私，直接可登录

### 若仍不弹隐私

在开发者工具 Console 查看（需 dev 构建 + 真机调试）：
1. MP 后台《用户隐私保护指引》是否已发布并勾选头像/相册等接口
2. `wx.getPrivacySetting` 返回的 `needAuthorization` 是否为 `true`
3. 测试号是否已同意过（需清缓存）

### 快速回滚到 HEAD 对比

```powershell
cd d:\Coding\yunce\yunceTaro
git stash push -m "privacy-fix-2026-09-02" -- src/utils/privacy-authorize.ts src/components/PrivacyPopup/index.tsx src/package-auth/pages/login/index.tsx
git checkout HEAD -- src/utils/privacy-authorize.ts src/components/PrivacyPopup/index.tsx src/package-auth/pages/login/index.tsx
npm run build:weapp:dev
# 测完恢复：git stash pop
```

### 只看本次 diff

```powershell
git diff HEAD -- src/utils/privacy-authorize.ts src/components/PrivacyPopup/index.tsx src/package-auth/pages/login/index.tsx src/package-auth/pages/register/index.tsx src/package-lead/pages/invite-landing/index.tsx
```

---

## 6. 构建产物

| 命令 | 用途 | API |
|------|------|-----|
| `npm run build:weapp:dev` | **测环境 dev 包**（本次打包） | `https://dev.chancore.cn/api/app/v1` |
| `npm run dev:weapp:dev` | 增量 watch 开发 | 同上 |

产物目录：`yunceTaro/dist/` → 微信开发者工具导入此目录。

验证点：`dist/common.js` 含 `dev.chancore.cn`；`dist/app.json` 含 `"__usePrivacyCheck__": true`。

---

## 7. 单测

```powershell
cd d:\Coding\yunce\yunceTaro
npx vitest run src/utils/privacy-authorize.test.ts
```

关键用例：`在 getPrivacySetting 异步返回前就同步调用 requirePrivacyAuthorize（防回归）`

---

## 9. 控制台常见报错（2026-09-02 测试反馈）

### `setTabBarStyle:fail custom Tabbar`

| 项 | 说明 |
|----|------|
| **原因** | `app.config.ts` 已 `tabBar.custom: true`，但 `initTheme` → `syncTabBarToTheme` 仍调用了原生 `Taro.setTabBarStyle` |
| **与隐私修复关系** | **无关**，启动时主题初始化就会触发 |
| **修复** | `src/utils/navigation-bar.ts`：`USE_CUSTOM_TAB_BAR=true` 时只走 `syncCustomTabBarColors` |

### `routeDone with a webviewId X is not found`

| 项 | 说明 |
|----|------|
| **原因** | 微信开发者工具 / 基础库已知问题；常见于 `reLaunch`/`redirectTo` 跳转登录页、热重载、基础库 3.x |
| **与隐私修复关系** | **间接**：冷启动 home → route-guard `reLaunch` 登录页，与进页弹隐私可能叠加；通常**不阻断业务** |
| **缓解** | 登录页 `promptPrivacyOnPageEnter` 延后 350ms；清缓存重启 DevTools；基础库可试 3.5.x 稳定版 |
| **判断** | 若页面可点、隐私/登录流程正常 → 可忽略该告警 |

---

## 10. 隐私全链路诊断日志（2026-09-02 新增）

**Console 过滤关键字**：`privacy.trace`

**生效条件**：`npm run build:weapp:dev`（`TARO_ENABLE_LOCAL_DEBUG=true`）

### 关键 trace 节点

| step | 含义 |
|------|------|
| `bootstrap` | App 启动，dump 隐私 API 是否可用 |
| `registerListener.attach` | onNeedPrivacyAuthorization 已注册 |
| `initPrivacy.getPrivacySetting.success` | 冷启动查询微信侧状态 |
| `login.page.show` + `querySetting.*` | 进入登录页主动 dump needAuthorization |
| `login.handleWechatLogin.click` | 点击微信登录 |
| `syncHandler.enter` → `getPrivacySetting.success` | 同步入口；看 **elapsedMs** 是否 >0（异步栈） |
| `require.sync.call/success/fail` | requirePrivacyAuthorize 是否被调用/成功 |
| `onNeedPrivacyAuthorization.fired` | 微信入队 pending（应弹 PrivacyPopup） |
| `store.enqueue` | pending resolve 入栈 |
| `PrivacyPopup.mounted` | 弹窗实际渲染 |
| `login.executeWechatLogin.privacyGate` | 二次门闩结果（false=登录被掐） |

### 典型断点对照

1. **无 `login.page.show`** → 未进入登录页（还在 home）
2. **`querySetting.success needAuthorization:false`** → 微信认为已授权/无需授权
3. **`syncHandler.alreadyAuthorized`** → 跳过 require，直接走登录
4. **有 `syncHandler.willRequire` 但无 `onNeedPrivacyAuthorization.fired`** → require 被微信忽略（异步栈）
5. **有 `require.sync.fail` + `showBlockedGate` 但 `pendingCount:0`** → 假同意按钮路径
6. **`privacyGate:false`** → ensurePrivacyBeforeAuth 二次拦截

### 测试步骤

1. 微信开发者工具 → 清缓存 → **清除授权数据**
2. 重新编译/预览 `dist`（`npm run build:weapp:dev`）
3. Console 输入过滤：`privacy.trace`
4. 进入登录页 → 点「微信一键登录」→ 同意用户协议
5. 复制完整 trace 序列（含 seq / store / elapsedMs）

---

## 8. 相关历史 commit

|--------|------|
| `8a39864` | feat: WeChat native avatar/privacy UX（引入 PrivacyPopup、profile-setup 原生头像） |
| `ad870c4` | HEAD，本次修改基准 |

工作区另有大量未提交改动（优化计划、profile-setup 等），**本次隐私修复仅涉及上表 §3 文件**。
