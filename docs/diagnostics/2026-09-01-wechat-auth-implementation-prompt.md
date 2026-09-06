# 微信授权 + 日历同步 · 实施提示词（已拍板）

> **拍板结论**：`Q1 A1 Q2 B1 Q3 C1 Q4 D1 Q5 E2 Q6 F1`（决策 HTML 已归档删除，以本文件为准）  
> **Git 起点**：FE `1614ee8`（动手前 `git status` 确认是否有未提交改动）

---

## Agent 提示词（复制以下全文）

````
任务：按已拍板方案实现微信官方授权 + 日历权限引导，最小 diff，FE/BE 对齐，CI 全绿。

## 拍板（不可偏离）

Q1 A1  本人头像：chooseAvatar（含相册/拍照/微信头像原生 sheet）
Q2 B1  学员/业务图：继续 chooseMedia，禁止 chooseAvatar
Q3 C1  chooseImageTemp 内统一 ensurePrivacyAuthorized
Q4 D1  日历：拒微信订阅仍写系统日历（保持现状，仅回归）
Q5 E2  系统日历权限被拒：showModal + openSetting 引导
Q6 F1  课表/排课 showModal 说明保留（不改文案/流程）

## 第 0 步：动手前只读确认（必须，未确认不得改代码）

依次 Read 以下文件，在回复里用 3～5 行写「位置 + 问题 + 是否仍待修」：

1. `src/package-auth/pages/profile-setup/index.tsx`
   - 预期：已是 Button openType=chooseAvatar + Input type=nickname
   - 若已达标 → 本文件 **不改**

2. `src/package-student/pages/profile-edit/index.tsx`
   - 预期问题：头像用 chooseImageTemp + showActionSheet；昵称用 FormInput 非 type=nickname
   - 确认个人资料 Tab 头像/昵称行位置

3. `src/utils/image-upload.ts` → `chooseImageTemp`
   - 预期问题：调用 chooseMedia 前 **无** ensurePrivacyAuthorized

4. `src/utils/phone-calendar.ts` + `src/services/calendar-sync.ts` → syncWeekAhead 失败分支
   - 预期问题：addPhoneCalendar 失败仅 log + Toast，无 openSetting

5. FE `src/services/calendar-sync.ts` reportCalendarSync 与 BE `calendar-sync.validator.ts`
   - 确认 POST /calendar-sync/report body `{ action, items[{ scheduleId, title, start, end?, location? }] }` 仍对齐
   - **默认不改 BE**；仅当 Read 发现契约不一致才最小修 BE 并说明

6. `vitest.config.ts` coverage.thresholds.lines ≥ 30

## 第 1 步：实现（白名单内）

### 1A profile-edit（Q1 A1）— 仅「个人资料」Tab

- 头像：参考 profile-setup，用 `<Button plain openType="chooseAvatar" onChooseAvatar={...}>` 包裹 Avatar 预览
- 保留「查看大图 / 删除头像」能力：可用次要入口（小字链接或保留 ActionSheet **仅** 查看/删除，重选走 chooseAvatar）
- 昵称：`Input type="nickname"`（与 profile-setup 一致；此字段不用 FormInput）
- 保存逻辑不变：本地路径 → uploadImage → updateProfile
- 删除 chooseImageTemp 头像路径及重复 ensurePrivacyAuthorized（若 1B 已统一到 chooseImageTemp）

### 1B chooseImageTemp（Q3 C1）

- 在 `chooseImageTemp` 开头（weapp 环境）调用 `ensurePrivacyAuthorized()`
- 用户拒绝隐私 → 抛明确 Error，调用方已有 catch 的保持 Toast
- **不要**改 chooseMedia 的 sourceType，不替用户决定相册/拍照

### 1C 系统日历权限引导（Q5 E2）

- 在 `phone-calendar.ts` 或 `calendar-sync.ts` 抽取最小 helper（参考 `location-authorize.ts` 模式）：
  - addPhoneCalendar 失败且 errMsg 像 auth/deny/permission → showModal「需要日历权限」+ confirm 调 openSetting
  - 用户取消 → 返回 false，不阻断其它业务
- syncWeekAhead：当 added=0 且 failed>0 且非 silent 时，触发引导（避免每次 silent 同步弹窗）
- **Q4 D1**：enableAndSync 订阅失败仍 setCalendarSyncEnabled + syncWeekAhead — **不要改**
- **Q6 F1**：maybePromptOnSchedulePage / maybePromptAfterScheduleSave 的 showModal — **不要删改**

### 1D 明确不改

- student-form / feedback / lesson-form 业务逻辑（C1 经 chooseImageTemp 间接受益即可）
- subscribe-message runFlow / SubscribePromptDialog
- store-entry 位置链路
- 排课/班课/邀请等无关页面

## 第 2 步：测试与 CI（必须全绿才交付）

在 `yunceTaro` 顺序执行，任一失败则修复后重跑：

```bash
npm run check
npm test
npm run coverage    # lines ≥ 30%，禁止下调 vitest.config.ts thresholds
````

新增/更新单测（最小）：

- `phone-calendar.test.ts` 或扩 `calendar-sync.test.ts`：mock addPhoneCalendar fail → 断言 showModal/openSetting 被调
- 若改 chooseImageTemp：mock ensurePrivacyAuthorized + chooseMedia（可新 `image-upload.choose.test.ts` 或扩展现有 test）
- 若动 profile-edit 逻辑：仅在有现成 test 时更新；无则不强造页面 test

**后端**：本任务 **默认不改**。若第 0 步发现 calendar-sync 契约缺口：

- 在 `yunce-back/yunce-backend` 最小修 validator/controller
- 跑 `npm run verify:sop` 全绿
- FE report 字段与 BE schema 一致

## 第 3 步：交付摘要

- 改了哪些文件（列表）
- 第 0 步确认表（每项：已达标 / 已修 / 跳过）
- CI 三门禁结果：check / test / coverage 是否 PASS
- BE 是否改动；若否写「FE-only，calendar-sync 契约已 Read 对齐」
- 真机验证路径（3 条以内）

## 禁止

- 未做第 0 步 Read 确认就改代码
- 扩大 scope 重构、改无关业务、下调 coverage 门槛
- 未跑 CI 就声称完成
- 未经用户要求 git commit

```

---

## 快速对照表

| 拍板 | 文件 | 动作 |
|------|------|------|
| A1 | `profile-setup` | 先 Read；已 chooseAvatar 则跳过 |
| A1 | `profile-edit` | 头像 chooseAvatar + 昵称 type=nickname |
| B1 | student-form 等 | **不碰** |
| C1 | `image-upload.ts` | chooseImageTemp 加隐私 |
| D1 | `calendar-sync.ts` | 仅回归，不改订阅/写入关系 |
| E2 | `phone-calendar.ts` / `calendar-sync.ts` | 失败引导 openSetting |
| F1 | `calendar-sync.ts` | showModal 保留 |

---

## FE/BE 对齐检查点（第 0 步 Read 用）

| 项 | FE | BE | 预期 |
|----|----|----|------|
| 日历上报 | `POST /calendar-sync/report` | `calendar-sync.validator.ts` | action + items 字段一致 |
| 订阅模板 | `calendar_add` / `calendar_change` | `subscribe-message.config.ts` | group 名一致 |
| 用户资料 | `PUT /profile` avatar_url | profile API | 不改 |

---

## 真机 smoke（改完后）

1. 完善资料 / 个人中心改头像 → 原生 sheet 含相册；选相册未授权会弹隐私/权限
2. 学员建档选头像 → 仍走相册（非 chooseAvatar）
3. 设置开启同步日历 → 可拒订阅仍写入；拒系统日历权限 → 出现「去设置」
```
