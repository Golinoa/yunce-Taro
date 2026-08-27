# 订阅消息模块 — 定稿（前后端契约 + 完整链路 + 验收）

> **状态：定稿**（开发按本文执行，不得偏离）  
> 前缀：`/api/app/v1`  
> **后端实现定稿**：[`yunce-backend/docs/subscribe-message-api-contract.md`](../../yunce-back/yunce-backend/docs/subscribe-message-api-contract.md)  
> **开发计划（排期/验收）**：[`10-subscribe-message-dev-plan.md`](./10-subscribe-message-dev-plan.md)  
> 前端唯一出口：`subscribeMessageService`（`src/services/subscribe-message.ts`）  
> 待办模块契约（独立）：[`08-todo-module-api-contract.md`](./08-todo-module-api-contract.md)  
> 历史草案目录：`subscribe-message/00~04`（本文 supersede）

---

## 0. 文档用途与硬性要求

### 0.1 开发硬性要求

| # | 要求 |
|---|------|
| R1 | **禁止**在业务页面散落写订阅弹框 JSX；一律走 `subscribeMessageService` + 全局组件 |
| R2 | **禁止**使用违规文案：「囤额度」「去囤额度」「屯额度」「攒额度」等；统一用 **「补充订阅消息授权」** / **「增加可发送次数」** |
| R3 | **禁止**页面 `onLoad` / `onShow` 自动调 `requestSubscribeMessage`；必须用户点击按钮 |
| R4 | **禁止**用微信订阅消息发送「次数不足」类通知 |
| R5 | 弹框（正中）只用 `SubscribePromptDialog`；弹窗（自下而上）只用 `SubscribeRenewSheet` |
| R6 | 业务 API **必须先成功**，再出现订阅引导 |
| R7 | TypeScript 严格模式；Props 导出；组件 JSDoc；`npm run check` 通过 |

### 0.2 UI 术语（全文统一）

| 术语 | 组件 | 说明 |
|------|------|------|
| **弹框** | `SubscribePromptDialog`（基于 `Dialog`） | 屏幕正中 |
| **弹窗** | `SubscribeRenewSheet`（基于 `BottomSheet`） | 自下而上 |
| **微信订阅面板** | `Taro.requestSubscribeMessage` | 微信系统 UI |
| **横幅** | `SubscribeQuotaBanner` | 页面内条，无遮罩 |
| **消息授权管理页** | `package-settings/pages/message-auth` | 日历 + 铃铛/松果点击补充授权 |

### 0.3 合规用词表

| ❌ 禁用 | ✅ 使用 |
|--------|--------|
| 囤额度 / 去囤额度 / 屯一次 | 补充订阅消息授权 / 补充 1 次可发送次数 |
| 额度池 | 消息授权余额 / 可发送次数 |
| 攒额度 | 增加订阅消息授权次数 |

---

## 1. 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│ 业务页（学员/班级/点名/充值…）                                  │
│   业务 API 成功 → subscribeMessageService.runFlow(eventId)   │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
 SubscribePromptDialog  SubscribeRenewSheet  SubscribeQuotaBanner
        │                   │                   │
        └─────────┬─────────┴───────────────────┘
                  ▼
     Taro.requestSubscribeMessage (用户点击后)
                  ▼
     POST /subscribe-message/auth-report
                  ▼
     后端 subscribe_quota.remain ±1
                  ▼
     业务事件 → NotificationDispatcher → subscribeMessage.send
                  │ (remain=0)
                  ▼
     站内 notification + pending_prompt + E18 弹框
```

---

## 2. 数据模型

### 2.1 库表 `subscribe_quota`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid | PK |
| `user_id` | string | 用户 |
| `open_id` | string | 微信 openId |
| `template_group` | enum | 见 §3.1 |
| `tmpl_id` | string | 微信模板 ID |
| `remain` | int | 剩余可发送次数，≥0 |
| `campus_id` | string? | 可选，多校区隔离时用 |
| `updated_at` | timestamptz | |

唯一索引：`(user_id, template_group, campus_id)`。

### 2.2 库表 `subscribe_send_log`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid | |
| `user_id` | string | 接收人 |
| `template_group` | enum | |
| `biz_key` | string | 幂等键 |
| `status` | enum | `sent` \| `skipped_no_quota` \| `skipped_disabled` \| `failed` \| `deduped` |
| `wx_msg_id` | string? | |
| `wx_err_code` | int? | |
| `created_at` | timestamptz | |

唯一索引：`(user_id, biz_key)`。

### 2.3 库表 `subscribe_pending_prompt`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid | |
| `user_id` | string | |
| `event_code` | string | 如 `class_assign_teacher` |
| `dedupe_key` | string | 24h 去重 |
| `payload` | jsonb | 文案变量 |
| `template_groups` | string[] | |
| `scene` | string | auth-report scene |
| `priority` | int | 见 §6 优先级 |
| `consumed_at` | timestamptz? | |
| `dismissed_at` | timestamptz? | |
| `expires_at` | timestamptz | |

### 2.4 库表 `subscribe_auth_log`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid | |
| `user_id` | string | |
| `scene` | string | |
| `client_request_id` | string | 24h 幂等 |
| `items` | jsonb | `[{tmplId, group, status}]` |
| `created_at` | timestamptz | |

---

## 3. 枚举与 DTO

### 3.1 `SubscribeTemplateGroup`

| 值 | 微信模板标题方向 | 首期 |
|----|------------------|------|
| `class_remind` | 上课提醒 | P0 |
| `schedule_change` | 课程安排变更 | P0 |
| `lesson_result` | 上课情况通知 | P0 |
| `todo_remind` | 待办事项提醒 | P0 |
| `package_alert` | 课时账户提醒 | P1 |
| `approval_pending` | 待审批通知 | P1 |
| `approval_result` | 审批结果通知 | P1 |
| `calendar_add` | 日历日程添加提醒 | P0（日历同步） |
| `calendar_change` | 日历日程变更提醒 | P0（日历同步） |
| `org_membership_alert` | 机构会员到期提醒 | P1 |
| `org_membership_renew_result` | 机构续费结果通知 | P1 |

> **预约成功不占用独立 group。** 团课/私教/场地/班课试听：成功 → 站内；课前 → `class_remind`；机构变更 → `schedule_change`。见 [`08-booking-subscribe-plan.md`](./subscribe-message/08-booking-subscribe-plan.md)。

### 3.2 `SubscribeScene`（auth-report.scene）

`student_create_success` · … · `settings_toggle` · `calendar_sync_enable` · `calendar_sync_batch_done` · `calendar_event_updated` · `group_booking_success` · `private_booking_success` · `venue_booking_success` · `trial_booking_success` · `booking_cancel_local`

### 3.3 `SubscribePromptDialogPreset`（弹框文案预设 ID）

由 `subscribeMessageService` 内置，**业务页只传 presetId + variables**，禁止手写文案。

| presetId | 标题 | 正文模板 | 主按钮 | 次按钮 | 主按钮动作 |
|----------|------|----------|--------|--------|------------|
| `student_created` | 跟进提醒 | 已为 **{studentName}** 建档。是否开启跟进提醒？课时不足或到期时将通过微信服务通知您。 | 开启提醒 | 暂不需要 | `requestAuth` groups: todo_remind, package_alert |
| `student_join_class_op` | 班级变动 | 学员已加入 **{className}**。是否订阅班级变动提醒？ | 订阅提醒 | 稍后 | `requestAuth` schedule_change, class_remind |
| `student_join_class_teacher` | 任课提醒 | 学员 **{studentName}** 已加入您任课的 **{className}**。是否订阅任课提醒？ | 订阅提醒 | 稍后 | `requestAuth` class_remind, schedule_change, todo_remind |
| `student_join_class_parent` | 上课提醒 | **{childName}** 已进入班级 **{className}**。是否订阅上课提醒？ | 订阅提醒 | 稍后 | `requestAuth` class_remind, schedule_change, lesson_result |
| `bind_child` | 孩子通知 | 是否接收 **{childName}** 的上课与课时通知？ | 订阅提醒 | 稍后 | `requestAuth` lesson_result, class_remind, package_alert |
| `post_class_parent` | 课程完成 | **{childName}** 本节课程已完成。是否订阅点名结果通知？ | 订阅提醒 | 稍后 | `requestAuth` lesson_result, class_remind |
| `recharge_success` | 续费跟进 | 是否为 **{studentName}** 开启续费跟进提醒？ | 开启提醒 | 稍后 | `requestAuth` package_alert, todo_remind |
| `card_issue_success` | 开卡跟进 | 是否为 **{studentName}** 开启开卡跟进提醒？ | 开启提醒 | 稍后 | `requestAuth` package_alert, todo_remind |
| `class_created` | 班级提醒 | 是否订阅班级课表与变动提醒？ | 订阅提醒 | 稍后 | `requestAuth` schedule_change, todo_remind |
| `lead_created` | 跟进提醒 | 是否订阅线索跟进到期提醒？ | 订阅提醒 | 稍后 | `requestAuth` todo_remind |
| `collab_todo_new` | 新待办 | 你有新的待办：**{title}** | 查看待办 | 稍后 | `navigate` only，**不调 subscribe** |
| `teacher_missed_wechat` | 任课通知 | 您有任课班级事项未通过微信发出（可发送次数不足）。 | 查看班级 | 稍后 | `navigate` |
| `quota_depleted` | 次数已用完 | **{groupLabel}** 的微信服务通知次数为 0。上课、点名、待办等重要事项仍会在小程序内通知您。是否补充订阅消息授权？ | 去补充授权 | 知道了 | `navigate` message-auth 或 dismiss |
| `quota_reactivate` | 继续提醒 | 还要继续收到 **{groupLabel}** 的微信提醒吗？ | 继续提醒 | 关闭这类提醒 | `navigate` message-auth / `disableNotify` |
| `booking_success_remind_auth` | 预约成功 | **{bookingLabel}** 已预约成功。是否开启开始前提醒？ | 开启提醒 | 暂不需要 | `requestAuth` groups: **class_remind**（不立刻 send） |

### 3.4 `SubscribeRenewSheetPreset`（弹窗）

| presetId | 文案 | 主按钮 | groups |
|----------|------|--------|--------|
| `checkin_renew` | 是否为下次上课与点名提醒补充 1 次可发送次数？ | 补充 1 次 | todo_remind, class_remind, lesson_result |
| `schedule_renew` | 课表已更新，是否为下次变动提醒补充 1 次？ | 补充 1 次 | schedule_change, class_remind |
| `class_view_renew` | 是否为上课提醒补充 1 次可发送次数？ | 补充 1 次 | class_remind |
| `post_class_renew` | 是否为下次上课提醒补充 1 次可发送次数？ | 补充 1 次 | class_remind |
| `lead_follow_renew` | 是否为下次跟进提醒补充 1 次？ | 补充 1 次 | todo_remind |

### 3.5 API Response 类型（TypeScript）

```typescript
// src/types/subscribe-message.ts

export type SubscribeTemplateGroup =
  | 'class_remind'
  | 'schedule_change'
  | 'lesson_result'
  | 'todo_remind'
  | 'package_alert'
  | 'approval_pending'
  | 'approval_result'
  | 'calendar_add'
  | 'calendar_change'
  | 'org_membership_alert'
  | 'org_membership_renew_result';

export type SubscribeAuthStatus = 'accept' | 'reject' | 'ban' | 'filter';

export interface SubscribeQuotaDto {
  group: SubscribeTemplateGroup;
  tmplId: string;
  remain: number;
  lowThreshold: number;
  notifyEnabled: boolean;
  displayCoveredUntil?: string; // YYYY-MM-DD，消息授权管理页日历用
  needsReactivate?: boolean;
}

export interface SubscribePendingPromptDto {
  id: string;
  presetId: string;
  eventCode: string;
  payload: Record<string, string>;
  templateGroups: SubscribeTemplateGroup[];
  scene: string;
  priority: number;
}

export interface SubscribeBootstrapDto {
  templates: Array<{
    group: SubscribeTemplateGroup;
    tmplId: string;
    title: string;
    enabled: boolean;
  }>;
  quotas: SubscribeQuotaDto[];
  pendingPrompts: SubscribePendingPromptDto[];
  lowQuotaGroups: SubscribeTemplateGroup[];
}
```

---

## 4. HTTP 接口契约

### 4.1 `GET /subscribe-message/bootstrap`

**Query**：`role` · `campusId?`

**Response `data`**：`SubscribeBootstrapDto`

**调用时机**：登录后、首页 `useDidShow`（冷启动）、消息通知页 `onShow`。

---

### 4.2 `GET /subscribe-message/quotas`

**Response**

```json
{ "quotas": [ /* SubscribeQuotaDto[] */ ] }
```

---

### 4.3 `POST /subscribe-message/auth-report`

**Request**

```json
{
  "scene": "student_create_success",
  "role": "consultant",
  "campusId": "campus-001",
  "items": [
    { "tmplId": "T1", "group": "todo_remind", "status": "accept" },
    { "tmplId": "T2", "group": "package_alert", "status": "reject" }
  ],
  "clientRequestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response**

```json
{ "quotas": [ /* 更新后 */ ] }
```

**规则**：仅 `accept` → `remain + 1`；`clientRequestId` 24h 幂等。

---

### 4.4 `GET /subscribe-message/pending-prompts`

返回按 `priority` 排序的未消费列表；前端 **onShow 只展示最高优先级 1 条**。

---

### 4.5 `POST /subscribe-message/prompts/:id/consume`

弹框展示后调用（记录已展示）。

---

### 4.6 `POST /subscribe-message/prompts/:id/dismiss`

用户点 [稍后] / [知道了]；写 `dismissed_at`；频控见 §6。

---

### 4.7 `POST /subscribe-message/send`（内部/联调）

见 §5.4；生产由 `NotificationDispatcher` 调用，业务 API 不直接调。

---

### 4.8 扩展 `GET/PUT /notify-settings`

Response 项增加：

```json
{
  "id": "student-class-one-day",
  "label": "上课前一天提醒",
  "enabled": true,
  "templateGroup": "class_remind",
  "requiresSubscribe": true
}
```

`PUT` 开启且 `requiresSubscribe` 且 `remain===0` → 前端先走 `quota_depleted` 弹框，再 PUT。

---

## 5. 后端发送与 bizKey

### 5.1 Dispatcher 伪代码

```typescript
async function dispatchSubscribe(event: NotifyEvent) {
  if (!await isNotifyEnabled(event.receiverId, event.group)) {
    return log('skipped_disabled');
  }
  const quota = await getQuota(event.receiverId, event.group);
  if (quota.remain <= 0) {
    await createInAppNotification(event);
    await enqueuePendingPrompt(event.receiverId, 'quota_depleted', event.group);
    return log('skipped_no_quota');
  }
  if (await isDeduped(event.receiverId, event.bizKey)) {
    return log('deduped');
  }
  const res = await wechatSubscribeSend(event);
  if (res.ok) {
    await decrementQuota(event.receiverId, event.group);
    return log('sent', res.msgId);
  }
  await createInAppNotification(event);
  return log('failed', res.errCode);
}
```

### 5.2 bizKey 规范

| 场景 | bizKey |
|------|--------|
| 课前提醒 | `class-remind:{scheduleId}:{YYYY-MM-DD}` |
| 点名结果 | `lesson-result:{lessonRecordId}` |
| 自定义待办 | `custom-todo:{todoId}:{remindAtIso}` |
| 课表变更 | `schedule-change:{scheduleId}:{version}` |
| 未点名 20:00 | `unattended:{scheduleId}:{YYYY-MM-DD}` |
| 续费不足 | `package-low:{studentId}:{YYYY-MM-DD}` |
| 日历批量添加 | `calendar-add:{userId}:{YYYY-MM-DD}:batch` |
| 日历单条添加 | `calendar-add:{scheduleId}:{occurrenceDate}` |
| 日历条目变更 | `calendar-change:{scheduleId}:{version}` |
| 团课课前 | `group-booking-remind:{slotId}:{date}` → **`class_remind`** |
| 私教课前 | `private-booking-remind:{slotId}:{date}` → **`class_remind`** |
| 场地开始前 | `venue-booking-remind:{bookingId}:{date}` → **`class_remind`** |
| 试听课前 | `trial-booking-remind:{bookingId}:{date}` → **`class_remind`** |
| 机构改/取消预约 | `booking-change:{recordId}:{version}` → **`schedule_change`** |

> `calendar-change` 与 `schedule-change` 同 `{scheduleId}:{version}` 去重，只发 1 条（用户已开日历同步时优先 `calendar_change`）。  
> **预约成功 / 用户自助取消不写 bizKey、不微信 send。**

---

## 6. onShow 弹框优先级（只展示 1 条）

```
priority 10: class_assign_teacher / class_assign_parent / teacher_missed_wechat
priority 20: collab_todo_new
priority 30: post_class_parent
priority 40: quota_depleted (E18)
priority 50: quota_reactivate (E15)
priority 60: 横幅 E16（非弹框）
```

消费入口：`src/utils/subscribe-on-show.ts` → `subscribeMessageService.consumePendingPrompts()`

---

## 7. 完整事件链路（逐步编号）

> 格式：**步骤** | 从 → 到 | 触发 | UI | 文案/按钮 | 接口 | 备注

---

### E01 · 添加学员

| 步骤 | 从 → 到 | 触发 | UI | 内容 | 接口 |
|------|---------|------|-----|------|------|
| E01-1 | 表单提交 → Toast | `POST /students` 200 | Toast | 「学员已添加」 | `studentService.create` |
| E01-2 | Toast → 弹框 | E01-1 完成 | **弹框** `student_created` | 见 §3.3 | — |
| E01-3 | 弹框 → 微信面板 | 用户点 [开启提醒] | 微信订阅面板 | tmplIds: todo_remind, package_alert | `requestSubscribeMessage` |
| E01-4 | 微信 → 后端 | E01-3 返回 | — | — | `POST /auth-report` scene=`student_create_success` |
| E01-5 | — → Toast | E01-4 成功 | Toast | 「已开启跟进提醒」 | — |
| E01-6 | 用户点 [暂不需要] | — | — | — | `POST /prompts/:id/dismiss` 若来自 pending |

**验收**：失败不出现弹框；拒绝后仍可继续分班。

---

### E02 · 学员入班

#### E02-A 操作者 OP（当场）

| 步骤 | 从 → 到 | 触发 | UI | 接口 |
|------|---------|------|-----|------|
| E02-A-1 | API → Toast | `addStudents` 200 | Toast「已加入班级」 | |
| E02-A-2 | → 弹框 | E02-A-1 | `student_join_class_op` | |
| E02-A-3 | [订阅提醒] | 用户点击 | 微信 + `auth-report` scene=`class_assign_op` | |
| E02-A-4 | 弹框第三按钮 | [查看班级] | `navigateTo` 班级页 → **E02-D** | |

#### E02-B 任课教师 HT（HT≠OP）

| 步骤 | 从 → 到 | 触发 | UI | 接口 |
|------|---------|------|-----|------|
| E02-B-1 | 入班 API | 成功瞬间 | 后端写 pending | `INSERT subscribe_pending_prompt` |
| E02-B-2 | 首页 onShow | `consumePendingPrompts` | **弹框** `student_join_class_teacher` | `GET pending-prompts` |
| E02-B-3 | [订阅提醒] | 用户点击 | 微信 + scene=`class_assign_teacher` | |
| E02-B-4 | [查看班级] | | → E02-D | |

#### E02-C 助教 AT：同 E02-B，独立 pending。

#### E02-D 查看班级二次补充

| 步骤 | 从 → 到 | 触发 | UI | 接口 |
|------|---------|------|-----|------|
| E02-D-1 | 班级页 onShow | 5 分钟内消费过入班 prompt | **弹窗** `class_view_renew` | |
| E02-D-2 | [补充 1 次] | 用户点击 | 微信 class_remind + auth-report | |

频控：同 classId+userId 每天 1 次自动弹窗。

#### E02-E 家长 PA

| 步骤 | 从 → 到 | 触发 | UI | 接口 |
|------|---------|------|-----|------|
| E02-E-1 | 入班 | 有 parentBinding | pending | |
| E02-E-2 | onShow | | **弹框** `student_join_class_parent` | |
| E02-E-3 | [订阅提醒] | | scene=`class_assign_parent` | |

---

### E03 · 家长绑定学员

| 步骤 | UI preset | groups | scene |
|------|-----------|--------|-------|
| E03-1 Toast 绑定成功 | | | |
| E03-2 弹框 `bind_child` | lesson_result, class_remind, package_alert | `bind_child` |

已在班：不重复 E02-E。

---

### E04 · 家长课后

| 步骤 | 说明 |
|------|------|
| E04-1 | 点名成功 → 站内通知 + pending `post_class_parent` |
| E04-2 | 家长 onShow → 弹框 `post_class_parent` |
| E04-3 | [订阅提醒] → auth-report |
| E04-4 | 同会话 → 弹窗 `post_class_renew` |

dedupe: `post_class:{recordId}`

---

### E05 · 点名提交（教师）

| 步骤 | UI | scene |
|------|-----|-------|
| E05-1 | Toast 点名已提交 | |
| E05-2 | **弹窗** `checkin_renew` | `checkin_submit` |
| E05-3 | 后端向家长 dispatch `lesson_result` | |

---

### E06 · 创建班级

弹框 `class_created` → schedule_change, todo_remind。带学员列表则走 E02，不每学员弹框。

---

### E07 · 排课/调班

OP：弹窗 `schedule_renew`。HT/AT≠OP：pending 弹框 `student_join_class_teacher` 变体（课表调整文案）。

---

### E08/E09 · 充值/发卡

弹框 `recharge_success` / `card_issue_success` → [开启提醒] + [邀请家长]（分享，不调 subscribe）。

---

### E10 · 线索

创建：弹框 `lead_created`。写跟进：弹窗 `lead_follow_renew`。

---

### E11 · 薪资

创建教师弹框 todo_remind；核对工资弹窗；发送工资单弹框。

---

### E12 · 自定义待办

| 步骤 | 说明 |
|------|------|
| E12-1 | 用户点保存（`remindEnabled`） |
| E12-2 | **先** `requestSubscribeMessage` todo_remind, class_remind |
| E12-3 | **再** `POST /todos` |
| E12-4 | 参与人走 E13 |

---

### E13 · 协作待办参与人

| 步骤 | UI | subscribe |
|------|-----|-----------|
| E13-1 | 站内 + 待办列表 | |
| E13-2 | onShow 弹框 `collab_todo_new` [查看待办] | **否** |
| E13-3 | 详情横幅 [开启到时提醒] | **是** scene=`collab_todo_entry` |
| E13-4 | 到点所有人发；无次数仅站内 | |

---

### E14 · 教师未收到微信

pending → 弹框 `teacher_missed_wechat` → [查看班级] → E02-D

---

### E15 · 再激活（14 天）

弹框 `quota_reactivate` → [继续提醒] → 消息授权管理页

---

### E16 · 次数偏低（1~3）

横幅：`{groupLabel} 还可微信提醒 {remain} 次` → [补充授权] → message-auth 页。24h/组 1 次。

---

### E18 · 次数为 0

弹框 `quota_depleted` → [去补充授权] → message-auth；[知道了] dismiss 7 天。  
**禁止**用微信 send 发此提醒。

---

### E17 · 消息授权管理页

路由：`/package-settings/pages/message-auth/index`  
每次点击松果/铃铛 → `message_auth_tap` → 单组 +1。会话最多 20 次，间隔 ≥800ms。

---

### E19 · 同步手机日历（首次）

| 步骤 | 说明 |
|------|------|
| E19-1 | 用户点「同步到手机日历」 |
| E19-2 | **先** `requestSubscribeMessage` → `calendar_add`, `calendar_change` |
| E19-3 | **再** 调 `addPhoneCalendar` 批量写入 |
| E19-4 | 成功后 `POST /calendar-sync/report` → 后端 dispatch `calendar_add`（N 节合并 1 条） |

scene=`calendar_sync_enable` · 详见 [`07-calendar-sync-plan.md`](./subscribe-message/07-calendar-sync-plan.md)

---

### E20 · 更新手机日历条目

| 步骤 | 说明 |
|------|------|
| E20-1 | 排课/调课保存且用户已开日历同步 |
| E20-2 | 更新系统日历对应 event |
| E20-3 | 后端 dispatch `calendar_change`（与 `schedule_change` 同版本去重） |

scene=`calendar_event_updated`

---

### E21 · 团课预约成功（站内 + 可选授权）

book 成功 → **不**微信 send；站内成功反馈 + 可选 `booking_success_remind_auth`（只 auth `class_remind`）。  
scene=`group_booking_success`

### E22 · 私教预约成功

同上。scene=`private_booking_success`

### E23 · 场地预约成功

同上。scene=`venue_booking_success`

### E24 · 班课试听预约成功

同上。scene=`trial_booking_success`

### E25 · 用户自助取消预约

cancel 成功 → **仅站内** Toast/弹框；不 auth、不 send。  
scene=`booking_cancel_local`

**课前微信：** 后端 cron 对四种预约 `dispatch(class_remind)`。  
**机构改/取消：** `dispatch(schedule_change)`。  

详见 [`08-booking-subscribe-plan.md`](./subscribe-message/08-booking-subscribe-plan.md)

---
## 8. 前端实现（全局封装，禁止散落）

### 8.1 目录结构

```
src/
├── types/subscribe-message.ts
├── services/subscribe-message.ts          # 唯一 HTTP 出口
├── utils/subscribe-message.ts             # requestSubscribeMessage 薄封装
├── utils/subscribe-on-show.ts             # onShow 队列消费
├── constants/subscribe-presets.ts         # presetId → 文案/groups/scene
├── components/subscribe/
│   ├── SubscribePromptDialog/index.tsx    # 全局弹框 ★
│   ├── SubscribeRenewSheet/index.tsx      # 全局弹窗 ★
│   ├── SubscribeQuotaBanner/index.tsx
│   └── SubscribeAuthHost/index.tsx        # 挂 app 根，统一 visible 状态
└── package-settings/pages/message-auth/   # 消息授权管理页
```

### 8.2 `SubscribePromptDialog`（硬性：全局唯一弹框）

```tsx
/**
 * SubscribePromptDialog - 订阅消息授权引导弹框（屏幕正中）
 *
 * 使用场景：所有业务订阅引导、待办通知、次数不足提示。
 * 禁止在业务页手写 Dialog 文案；通过 subscribeMessageService.openPrompt(presetId) 调用。
 */
export interface SubscribePromptDialogProps {
  visible: boolean;
  presetId: SubscribePromptPresetId;
  variables?: Record<string, string>;
  /** 主按钮：requestAuth | navigate | dismissOnly */
  onPrimary: () => void;
  onSecondary: () => void;
  onTertiary?: () => void; // 如 [查看班级]
  loading?: boolean;
}
```

**样式规范**（UnoCSS + rpx）：

- 容器：`w-[620rpx] rounded-[28rpx] bg-card px-[40rpx] py-[36rpx]`
- 标题：`text-[34rpx] font-semibold text-foreground text-center`
- 正文：`text-[28rpx] text-muted-foreground mt-[16rpx] leading-relaxed`
- 主按钮：`btn-primary w-full mt-[32rpx]`
- 次按钮：`text-[28rpx] text-muted-foreground mt-[24rpx] text-center`
- 遮罩：复用 `Dialog`，`maskClosable={false}`

### 8.3 `subscribeMessageService` 核心 API

```typescript
// src/services/subscribe-message.ts

export const subscribeMessageService = {
  bootstrap(role: string, campusId?: string): Promise<SubscribeBootstrapDto>,
  getQuotas(): Promise<SubscribeQuotaDto[]>,

  /** 业务页唯一入口：按事件跑完整链路 */
  runFlow(flow: SubscribeFlowId, ctx: SubscribeFlowContext): Promise<void>,

  /** 打开弹框（内部挂 SubscribeAuthHost） */
  openPrompt(input: OpenPromptInput): Promise<PromptResult>,

  /** 打开弹窗 */
  openRenewSheet(input: OpenRenewSheetInput): Promise<SheetResult>,

  /** 用户点击 [订阅/补充] 后调用 */
  requestAuth(scene: string, groups: SubscribeTemplateGroup[]): Promise<AuthReportResult>,

  consumePendingPrompts(): Promise<void>,

  dismissPrompt(promptId: string): Promise<void>,
};
```

### 8.4 业务页调用示例（添加学员）

```typescript
// package-student/pages/student-form/useStudentForm.ts（示例）

import { subscribeMessageService } from '@/services';

const handleCreateSuccess = async (student: Student) => {
  Taro.showToast({ title: '学员已添加', icon: 'success' });
  await subscribeMessageService.runFlow('E01', {
    studentId: student.id,
    studentName: student.name,
    campusId: currentCampusId,
    role: currentRole,
  });
};
```

```typescript
// subscribeMessageService 内部 runFlow('E01') 伪代码

async function runFlowE01(ctx) {
  const result = await openPrompt({
    presetId: 'student_created',
    variables: { studentName: ctx.studentName },
    scene: 'student_create_success',
    groups: ['todo_remind', 'package_alert'],
  });
  if (result.action === 'primary') {
    await requestAuth('student_create_success', ['todo_remind', 'package_alert']);
    Taro.showToast({ title: '已开启跟进提醒', icon: 'success' });
  }
}
```

### 8.5 `SubscribeAuthHost` 挂载

```tsx
// src/app.tsx 或 layouts
<SubscribeAuthHost />
```

全局单例管理 `SubscribePromptDialog` + `SubscribeRenewSheet` visible 状态，**业务页不得再 import Dialog 写订阅文案**。

---

## 9. 测试用例

### 9.1 前端单测 `subscribe-message.service.test.ts`

| # | 用例 | 断言 |
|---|------|------|
| T-F-01 | `runFlow('E01')` 用户点暂不需要 | 不调 `requestSubscribeMessage` |
| T-F-02 | `runFlow('E01')` 用户点开启提醒 accept | 调 auth-report，groups 含 todo_remind |
| T-F-03 | `openPrompt` presetId 未知 | throw 明确错误 |
| T-F-04 | `consumePendingPrompts` 空队列 | 不展示弹框 |
| T-F-05 | 优先级：collab 与 class_assign 同时存在 | 只展示 class_assign |
| T-F-06 | 文案快照不含「囤额度」 | grep presets |

### 9.2 前端组件测试 `SubscribePromptDialog.test.tsx`

| # | 用例 | 断言 |
|---|------|------|
| T-C-01 | 渲染 preset student_created | 标题/按钮文案正确 |
| T-C-02 | 点遮罩 | 不关闭（maskClosable false） |
| T-C-03 | loading 时主按钮禁用 | |

### 9.3 后端单测 `subscribe-dispatcher.spec.ts`

| # | 用例 | 断言 |
|---|------|------|
| T-B-01 | remain=0 | status=skipped_no_quota，写站内通知 |
| T-B-02 | 同 bizKey 二次 | deduped |
| T-B-03 | notify disabled | skipped_disabled |
| T-B-04 | send 成功 | remain-1 |
| T-B-05 | auth-report accept | remain+1，clientRequestId 幂等 |

### 9.4 E2E 验收清单（真机微信）

| # | 场景 | 步骤 | 预期 |
|---|------|------|------|
| A-01 | E01 | 添加学员 → 弹框 → 开启提醒 | 微信面板出现；auth-report 200；remain+1 |
| A-02 | E02-B | 顾问入班，任课教师另设备登录 | 教师见任课弹框 |
| A-03 | E05 | 点名提交 | 仅弹窗，非弹框；家长收到站内或微信 |
| A-04 | E18 | remain=0 进首页 | 弹框次数已用完；无微信 send |
| A-05 | E13 | 协作待办 | 参与人弹框仅查看；详情再授权 |
| A-06 | 拒绝授权 | 任意弹框点稍后 | 业务已完成；24h 不重复 |
| A-07 | message-auth | 点击松果 3 次 | remain+3（若用户 always accept） |

---

## 10. 验收边界（Done Definition）

### 10.1 必须完成（P0）

- [ ] 全局 `SubscribePromptDialog` + `SubscribeRenewSheet` + `SubscribeAuthHost`
- [ ] `subscribeMessageService` 实现 bootstrap / auth-report / runFlow E01~E07, E12~E13, E16~E18
- [ ] 后端四表 + bootstrap + auth-report + pending-prompts + Dispatcher 骨架
- [ ] 文案合规扫描：无「囤额度」类词汇
- [ ] `npm run check` + `npm run build:weapp:mock` 通过

### 10.2 二期（P1）

- [ ] package_alert cron send
- [ ] approval_result 全链路
- [ ] message-auth 日历动画

### 10.3 明确不做

- 替他人设备授权
- 每添加一名学员弹一次订阅
- 点名过程中阻断式订阅
- 用 subscribe.send 发次数不足

---

## 11. 与待办模块关系

| 维度 | 待办 [08](./08-todo-module-api-contract.md) | 本文订阅消息 |
|------|---------------------------------------------|--------------|
| 展示 | 小程序内 Tab | 微信服务通知 |
| 消耗次数 | 否 | 是 |
| 自定义待办到点 | GET /todos | 有授权则 send，否则站内 |
| 协作 | 所有人待办可见 | 所有人 send；无次数仅站内 |

同一业务事件后端：**待办必写（按 todo-settings）+ 订阅按 remain 可选**。

---

## 12. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-08-26 | 定稿：完整链路、API、组件封装、测试、禁用囤额度文案 |
| 2026-08-26 | 日历 E19–E20；预约 E21–E25：**成功站内、课前并入 class_remind**（废弃独立预约成功/取消模板） |
