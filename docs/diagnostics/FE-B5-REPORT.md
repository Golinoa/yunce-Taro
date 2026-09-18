# FE-B5 前端修复报告（FE-02 / FE-07 / FE-08）

- 范围：仅前端 `D:\Coding\yunce\yunceTaro`；未触碰 `yunce-back`。
- git：**未执行任何 git 写操作**（无 add/commit/tag/push/stash，未触碰 `.git`）。
- 行号说明：任务书行号与实际代码一致（`profile-edit` 517-519、`staff-invite` 286-300 等均对得上），下文括号内标注的是**改动前**的行号。

---

## 1. FE-02：删掉昵称下方那句备注

文件：`src/package-student/pages/profile-edit/index.tsx`

改动前（517-519，位于昵称 `FieldRow` 的 `privacyReady` 分支内）：

```tsx
maxlength={20}
/>
<Text className="text-[22rpx] text-muted-foreground">
  可手改；点输入框可拉取微信昵称
</Text>
</View>
```

改动后：

```tsx
maxlength={20}
/>
</View>
```

- 只删这三行。`Input`（`type="nickname"`、`placeholder="点此选用微信昵称，或直接输入"`）与 `privacyReady ? ... : '请先同意隐私指引'` 分支逻辑保持原样，其它 Hint / 表单未动。
- 外层 `<View className="flex-1 flex flex-col items-end gap-[4rpx]">` 现在只剩一个子节点。`gap` 单子节点时无副作用，`items-end` 仍保证 Input 右对齐，**未改结构**。

## 2. FE-07：复制邀请码，而不是复制"点不开的链接"

### 2.1 工具层：`src/utils/invite-staff-link.ts`

`copyCampusInviteLink`（原 48-63）**重命名为 `copyCampusInviteCode`**，不再把内部相对路径写进剪贴板：

| | 改动前 | 改动后 |
| --- | --- | --- |
| 剪贴板内容 | `buildCampusInvitePath(code)` = `/package-auth/pages/campus-invite-landing/index?code=XXX`（小程序内部路径，粘到微信里是纯文本，必然点不开） | 纯邀请码 `XXX`（trim + 大写规范化） |
| 提示 | `员工邀请链接已复制（24h有效）` | `邀请码已复制（24h有效）` |
| 空码 | 提示 `邀请码异常`，不写剪贴板 | 同左（行为保留） |

最终代码（48-62）：

```ts
export async function copyCampusInviteCode(inviteCode: string): Promise<void> {
  const code = (inviteCode || '').trim().toUpperCase();
  if (!code) {
    Taro.showToast({ title: '邀请码异常', icon: 'none' });
    return;
  }

  /** 只复制纯邀请码：内部相对路径粘到微信里是纯文本，必然点不开 */
  await Taro.setClipboardData({ data: code });
  Taro.showToast({
    title: '邀请码已复制（24h有效）',
    icon: 'none',
    duration: 2500,
  });
}
```

**保留未动**：
- `buildCampusInvitePath`（43-46）—— `campus-invite-landing/index.tsx:94`（登录重定向）与 `auth-onboarding.ts:276` 仍在使用。
- `useShareAppMessage` 的 `path`（`staff-invite/index.tsx:164-169`，`buildCampusInvitePath(...).replace(/^\//,'')`）—— 微信分享卡片的规范写法，去前导斜杠是对的，**未改**。

选择"重命名"而非"保留旧名"的理由：函数已经不再产出链接，留着 `...Link` 的名字会误导下一个人再把内部路径塞回去；全仓 grep 确认 `copyCampusInviteLink` 引用点只有 `staff-invite/index.tsx` 一处 + 单测，重命名成本可控。（`_recover_yunceTaro` / `_probe_*` 等目录是本机历史副本，非本次仓库。）

### 2.2 页面层：`src/package-teacher/pages/staff-invite/index.tsx`

- 导入（23）：`copyCampusInviteLink` → `copyCampusInviteCode`。
- 回调（原 171-173）：`handleCopyLink` → `handleCopyCode`，内部改为 `await copyCampusInviteCode(code)`。
- **合并两个复制按钮**（原 285-301 → 现 277-282）：

  改动前：一个 `flex-1` 的「复制邀请链接」主按钮（调 `handleCopyLink`）+ 一个 `80rpx` **只有图标没有文字**的圆按钮（`mdi-content-copy`，直接 `setClipboardData(displayCode)`）。
  改动后：合并为**同一个**明确的「复制邀请码」主按钮：

  ```tsx
  <View
    className="h-[80rpx] rounded-full bg-primary flex items-center justify-center press-scale"
    onClick={() => void handleCopyCode(displayCode)}
  >
    <Text className="text-[28rpx] text-white font-medium">复制邀请码</Text>
  </View>
  ```

  原来两行按钮的外层 `flex flex-row gap-[16rpx]` 已随之移除（单按钮无需行容器）。
- 「直接分享绑定卡片」`Button openType="share"`（253-259）**保留**；两种方式并存：`分享绑定卡片` + `复制邀请码`。
- 待使用邀请列表里的操作（原 331-336）：`复制链接` → `复制邀请码`，回调同步改成 `handleCopyCode(item.inviteCode)`。理由：它调用的是同一个函数，改函数后标签写"链接"就是错的，属于同一致陷范围。
- `Icon` 组件在本文件已无引用，移除 `import Icon from '@/components/Icon'`（否则 `noUnusedLocals` 会报红）。

## 3. FE-08：邀请员工页文案分级

文件：`src/package-teacher/pages/staff-invite/index.tsx`。原则是"一屏只留必要信息"，只压缩/删除解释性长句，不改布局、不加区块、不引新样式。

| 位置（改动前） | 改动前 | 改动后 | 取舍理由 |
| --- | --- | --- | --- |
| 201-205 副标题 | `员工用微信打开邀请链接后，将绑定到当前已创建的员工资料，不会新建第二份档案。` / `建议从员工详情发起点对点绑定。开放码接受后会新建员工身份。` | `绑定到已创建的员工资料` / `接受后将新建员工身份` | 原句是两段说明性长句；且"打开邀请链接"在 FE-07 之后已经**不准确**（现在分享的是卡片、复制的是码），必须重写而不是照抄。压缩后保留唯一决策信息：点对点=绑定既有资料，开放码=新建身份 |
| 221-223 绑定员工卡片内 | `身份取自已创建的员工资料，无需再次选择` | **整段删除** | 与上面新的副标题「绑定到已创建的员工资料」完全重复；卡片标题「绑定员工」+ 姓名已足以表达"这就是那个人" |
| 256-258 有效期 | `24 小时（统一口径，过期后需重新生成）` | `24 小时，过期后需重新生成` | 「统一口径」是内部话术，不该出现在用户界面；去掉后语义不变 |
| 41-60 `ROLE_OPTIONS.desc` | `校区管理与邀请` / `排课、消课、本人薪资` / `预约签到、开卡续费` | **保留** | 已是短句，且是用户选择角色时唯一的语义依据，不能为了"少字"牺牲角色语义 |
| 197-199 标题、205-208 校区、210-218 绑定员工、219-243 邀请角色（含 label）、246-251 有效期区块、268-284 邀请码、253-266 两种操作、286-328 待使用列表 | — | **全部保留** | 属任务书要求的"一屏必要信息"清单 |

样式：全部沿用原有 UnoCSS 原子类与设计 Token（`bg-card` / `text-muted-foreground` / `rpx` 等），无 SCSS、无内联 style、无 px/rem。

---

## 4. 验证命令与真实输出

全部在 Windows 侧、`cd /d/Coding/yunce/yunceTaro` 下执行（未用 npm run，直调 node_modules）。

### 4.1 Prettier

```
node ./node_modules/prettier/bin/prettier.cjs --check \
  src/package-student/pages/profile-edit/index.tsx \
  src/package-teacher/pages/staff-invite/index.tsx \
  src/utils/invite-staff-link.ts \
  src/utils/invite-staff-link.test.ts
```

真实输出：

```
Checking formatting...
All matched files use Prettier code style!
```

Exit Code: 0

### 4.2 ESLint

```
node ./node_modules/eslint/bin/eslint.js \
  src/package-student/pages/profile-edit/index.tsx \
  src/package-teacher/pages/staff-invite/index.tsx \
  src/utils/invite-staff-link.ts \
  src/utils/invite-staff-link.test.ts
```

真实输出：（空） — Exit Code: 0

### 4.3 TypeScript

```
node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

真实输出：（空） — Exit Code: 0（用时约 9s）

### 4.4 定向单测（vitest，Windows 侧）

```
node ./node_modules/vitest/vitest.mjs run src/utils/invite-staff-link.test.ts src/utils/invite-landing-flow.test.ts
```

真实输出：

```
 RUN  v2.1.9 D:/Coding/yunce/yunceTaro

 ✓ src/utils/invite-staff-link.test.ts (7 tests) 7ms
 ❯ src/utils/invite-landing-flow.test.ts (16 tests | 1 failed) 21ms
   × invite-landing-flow (L1 态机) > resolveTrialInviteBookingClosed：统一「无法预约」判定 > 未到截止时间（开课前 >120min）→ 不关闭 9ms
     → expected { closed: true, …(1) } to deeply equal { closed: false, reason: null }

 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 22 passed (23)
```

- **本批改动的 `invite-staff-link.test.ts`：7/7 全绿**，其中 2 条是本次同步重写的用例：
  - `copyCampusInviteCode 复制纯邀请码，而非点不开的内部路径`：断言 `setClipboardData` 收到 `{ data: 'EABC12345' }`，且内容不含 `/package-auth/`、`?code=`、`redirect=`。
  - `copyCampusInviteCode 空码提示异常`：空串不写剪贴板、提示 `邀请码异常`。
  - 其余 5 条（`buildCampusInvitePath` 直链、编码往返、pending code 存取/消费、缺参、storage 异常）**原样保留**并继续通过。
- `invite-landing-flow.test.ts` 那 1 条红是**既有、与本次改动无关**的用例缺陷（见下节），非本次引入。

---

## 5. 未完成 / 不确定项

1. **`invite-landing-flow.test.ts:146-159` 的既有失败（本次未修，建议上层单独开单）**
   - 现象：`未到截止时间（开课前 >120min）→ 不关闭` 期望 `{closed:false, reason:null}`，实收 `{closed:true, reason:'lesson_started'}`。
   - 根因（已核实，非本项目代码问题，而是**用例自身的 UTC/本地时区混用**）：`:147-149` 用 `new Date(Date.now() + 300*60*1000).toISOString().slice(0,10)` 取 **UTC 日期**，却用 `getHours()/getMinutes()` 取 **本地时间**拼 `start`。在 UTC+8 的晚间跑（本次 22:57），`date` 与本地实际日期差一天，于是被判定为"这门课早已开始"。
   - 与本次改动的隔离证据：`src/utils/invite-landing-flow.ts` **没有任何 import**，`invite-landing-flow.test.ts` 也只 `from './invite-landing-flow'`，与 `invite-staff-link` 无依赖；我只改了后者的 `copyCampusInviteLink → copyCampusInviteCode`，未触碰 `buildCampusInvitePath`。按"只跑定向、不改其它页面/文件"的约束，**未修**。
2. **`Taro.setClipboardData` 自身的系统级 Toast**：微信小程序 `setClipboardData` 成功后会弹官方"内容已复制"提示，本函数随后再弹一条自定义 Toast，可能出现两条提示叠加。改动前 `copyCampusInviteLink` 就是这个模式，本次**沿用既有交互**保持一致，未改动（如需收敛，属产品交互决策）。
3. **只做了静态验证 + 单测，未做真机/开发者工具点击验证**：`复制邀请码` 的实际粘贴效果、分享卡片落地页跳转需要微信环境人工确认。
4. `src/components/lead/InviteQrSection/index.tsx` 内有一个**同名局部函数** `handleCopyLink`，属于「线索二维码分享」组件，与校区员工邀请无关，按"不改其它页面/组件"约束**未动**。

---

## 6. 改动文件完整清单（相对 `D:\Coding\yunce\yunceTaro\`）

```
src/package-student/pages/profile-edit/index.tsx        # FE-02 删除昵称下备注
src/package-teacher/pages/staff-invite/index.tsx        # FE-07 复制邀请码 + FE-08 文案精简
src/utils/invite-staff-link.ts                          # FE-07 copyCampusInviteLink → copyCampusInviteCode
src/utils/invite-staff-link.test.ts                     # FE-07 同步用例
docs/diagnostics/FE-B5-REPORT.md                        # 本报告
```
