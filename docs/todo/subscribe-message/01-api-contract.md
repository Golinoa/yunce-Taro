# 订阅消息 API 契约（草案 · 待讨论定稿）

> 状态：**草案**，讨论确认后再开发。  
> 完整背景：[00-research-and-plan.md](./00-research-and-plan.md)  
> 前缀：`/api/app/v1`（与 `request.ts` 一致）  
> 前端建议出口：`subscribeMessageService`（新建 `src/services/subscribe-message.ts`）

---

## 0. 设计原则

1. **额度在后端权威**：前端只上报授权结果，不维护可发送次数（除 UI 缓存展示）。
2. **发送只走后端**：前端禁止直调微信 `subscribeMessage.send`。
3. **业务键幂等**：同一 `bizKey` 只消耗 1 次额度、只发 1 条。
4. **双通道**：站外失败或无额度时，仍写站内 `POST /notifications`（已有契约）。
5. **与待办分离**：`GET /todos` 是页内待办；本文是站外微信服务通知。
6. **开关优先**：用户关闭 `notify-settings` 项时，即使有额度也不发。

---

## 1. 枚举与常量

### 1.1 模板组 `SubscribeTemplateGroup`

| 值 | 说明 | 首期 |
|----|------|------|
| `class_remind` | 上课提醒 | P0 |
| `schedule_change` | 调课/停课/解散/试听变更 | P0 |
| `lesson_result` | 点名/消课/点评 | P0 |
| `package_alert` | 续费/课包到期 | P1 |
| `approval_result` | 请假审批/跨科目 | P1 |
| `todo_remind` | 未点名/线索/发薪等待办类 | P0 |

### 1.2 业务场景 `SubscribeScene`（前端授权触点）

> 完整矩阵见 [02-auth-touchpoints-quota-loop.md](./02-auth-touchpoints-quota-loop.md) · 囤额度玩法见 [03-quota-pool-gamification.md](./03-quota-pool-gamification.md)

| 值 | 说明 | 建议申请模板组 |
|----|------|----------------|
| `login_opt_in` | 登录后用户主动点「开启通知」 | 按角色 ≤5 |
| `role_switch` | 切换身份后补攒缺额模板 | `bootstrap.lowQuotaGroups` |
| `settings_toggle` | 消息通知页打开开关 | 该项映射组 |
| `custom_todo_save` | 创建待办且 `remindEnabled`，点保存 | `todo_remind` + 互补 2 组 |
| `custom_todo_collab_open` | 参与人打开协作待办详情，点横幅 | `todo_remind` |
| `custom_todo_edit_remind` | 编辑待办开启/修改提醒，点保存 | `todo_remind` |
| `member_card_issue_success` | 发卡成功页 CTA | `package_alert` + `todo_remind` |
| `package_recharge_success` | 课包充值成功页 CTA | `package_alert` + `todo_remind` |
| `student_create_success` | 添加学员成功 | `package_alert` + `todo_remind` |
| `lead_create_success` | 创建线索成功 | `todo_remind` |
| `lead_follow_save` | 写跟进记录保存 | `todo_remind` |
| `teacher_create_success` | 创建教师成功 | `todo_remind` |
| `salary_review_success` | 核对工资后续杯 | `todo_remind` |
| `salary_send_success` | 发送工资单后续杯 | `todo_remind` |
| `class_create_success` | 创建班级保存成功（非每学员） | `schedule_change` + `todo_remind` |
| `schedule_save_success` | 排课/调班保存成功 | `schedule_change` + `class_remind` |
| `schedule_refresh_remind` | 课表页点「开启上课提醒」 | `class_remind` + `schedule_change` |
| `checkin_submit` | 点名提交后成功 Sheet | `lesson_result` + `todo_remind` + `class_remind` |
| `bind_child` | 家长绑定学员完成 | `lesson_result` + `class_remind` + `package_alert` |
| `post_class_parent` | 家长课后正向续杯弹窗 | `lesson_result` + `class_remind` |
| `trial_booking_submit` | 试听预约提交 | `schedule_change` + `class_remind` |
| `leave_submit` | 家长提交请假 | `approval_result` + `class_remind` |
| `quota_pool_tap` | 囤额度页木鱼/铃铛每次点击 | 当前 tab 对应组 |
| `quota_reactivate` | 再激活弹窗点「继续提醒」 | 缺额组 |
| `reauth_prompt` | 低额度横幅再授权 | 缺额组 |
| `collab_todo_entry` | 新协作待办进站 Dialog 后查看详情 | 详情页横幅，非 Dialog 内 subscribe |

**配置接口扩展**：`GET /subscribe-message/bootstrap` 的 `suggestedScenes` 可按页面返回子集；每项带 `tmplIds[]` 与 `ctaCopy`。

### 1.3 授权状态（微信回传）

| 值 | 含义 | 后端处理 |
|----|------|----------|
| `accept` | 用户同意 | `remain + 1` |
| `reject` | 用户拒绝 | 不变 |
| `ban` | 模板被封禁 | 记日志，不下发 |
| `filter` | 同标题被过滤 | 记日志 |

### 1.4 设置项 ID（与前端 notifications 页对齐）

沿用现有 `notify-settings` 项 id，例如：`student-class-one-day`、`teacher-unattended` …  
每项映射到 `SubscribeTemplateGroup` + 接收角色（后端配置表）。

---

## 2. DTO

### 2.1 SubscribeTemplateDto（模板配置，下发给前端）

```json
{
  "group": "class_remind",
  "tmplId": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "title": "上课提醒",
  "enabled": true,
  "scenes": ["schedule_view", "settings_toggle"]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `group` | `SubscribeTemplateGroup` | 逻辑模板组 |
| `tmplId` | string | 微信模板 ID |
| `title` | string | 展示用 |
| `enabled` | boolean | 机构/平台是否启用 |
| `scenes` | `SubscribeScene[]` | 建议授权触点 |

### 2.2 SubscribeQuotaDto（用户额度）

```json
{
  "group": "class_remind",
  "tmplId": "xxxxxxxx",
  "remain": 3,
  "lowThreshold": 1
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `remain` | number | 剩余可发送次数 |
| `lowThreshold` | number | 低于此值前端可提示再授权 |

### 2.3 SubscribeAuthReportItem

```json
{
  "tmplId": "xxxxxxxx",
  "group": "class_remind",
  "status": "accept"
}
```

### 2.4 SubscribeSendLogDto（查询用，可选）

```json
{
  "id": "log-001",
  "bizKey": "class-remind:sch-001:2026-08-27",
  "group": "class_remind",
  "status": "sent",
  "channel": "wechat_subscribe",
  "createdAt": "2026-08-26T12:00:00.000Z"
}
```

`status`: `sent` | `skipped_no_quota` | `skipped_disabled` | `failed` | `deduped`

---

## 3. 接口列表

### 3.1 获取模板与额度（进页/登录后）

```
GET /subscribe-message/bootstrap?role=parent|teacher|principal|consultant
```

**Response `data`**

```json
{
  "templates": [ /* SubscribeTemplateDto[]，按角色过滤 */ ],
  "quotas": [ /* SubscribeQuotaDto[] */ ],
  "suggestedScenes": ["schedule_view", "settings_toggle"],
  "lowQuotaGroups": ["class_remind"]
}
```

**职责**

- 前端：登录后、`notifications` 页 `onShow`、课表页拉取
- 后端：按角色返回可用模板；汇总当前用户额度

---

### 3.2 上报授权结果（用户点击授权后）

```
POST /subscribe-message/auth-report
```

**Request**

```json
{
  "scene": "schedule_view",
  "role": "parent",
  "campusId": "campus-001",
  "items": [
    { "tmplId": "xxx", "group": "class_remind", "status": "accept" },
    { "tmplId": "yyy", "group": "lesson_result", "status": "reject" }
  ],
  "clientRequestId": "uuid"
}
```

**Response `data`**

```json
{
  "quotas": [ /* 更新后的 SubscribeQuotaDto[] */ ]
}
```

**规则**

- 仅 `status=accept` 增加额度；幂等：`clientRequestId` 24h 内重复不重复加。
- 前端：每次 `wx.requestSubscribeMessage` 成功后立即上报。
- 后端：记账 + 审计日志。

---

### 3.3 查询额度（轻量）

```
GET /subscribe-message/quotas
```

→ `data`: `{ "quotas": SubscribeQuotaDto[] }`

---

### 3.4 触发发送（内部/调试；业务默认由后端事件自动调）

> 生产环境：**业务 API 不直接调此接口**，由消课/改期/定时任务内部调用通知服务。  
> 保留此接口便于联调与运营补发。

```
POST /subscribe-message/send
```

**Request**

```json
{
  "group": "lesson_result",
  "receiverUserId": "user-parent-001",
  "bizKey": "checkin:record-123",
  "page": "/package-student/pages/student-detail/index?id=stu-001",
  "data": {
    "thing1": "小明",
    "phrase2": "已签到",
    "number3": 12
  },
  "fallbackInApp": true
}
```

| 字段 | 说明 |
|------|------|
| `bizKey` | 幂等键，必填 |
| `data` | 键名与微信模板 keyword 一致，由后端校验 |
| `fallbackInApp` | 无额度或发送失败时是否写站内通知，默认 true |

**Response `data`**

```json
{
  "status": "sent",
  "msgId": "wx-msg-id",
  "channel": "wechat_subscribe",
  "quotaRemain": 2
}
```

或

```json
{
  "status": "skipped_no_quota",
  "channel": "in_app",
  "inAppNotificationId": "notif-456"
}
```

**错误码（业务）**

| code | 说明 |
|------|------|
| `SUBSCRIBE_DISABLED` | 用户关闭了对应 notify-setting |
| `SUBSCRIBE_NO_QUOTA` | 额度不足 |
| `SUBSCRIBE_TMPL_BANNED` | 模板不可用 |
| `SUBSCRIBE_DEDUPED` | bizKey 已发送 |

---

### 3.5 通知设置（扩展现有契约）

现有：

```
GET  /notify-settings
PUT  /notify-settings/:itemId   { "enabled": true }
```

**扩展 Response 项**

```json
{
  "id": "student-class-one-day",
  "label": "上课前一天提醒",
  "enabled": true,
  "templateGroup": "class_remind",
  "requiresSubscribe": true
}
```

**扩展 PUT 行为**

- `enabled: true` 且 `requiresSubscribe: true` 时，Response 可带 `needAuth: true` + `tmplIds: string[]`，提示前端先走授权再保存。
- 或拆成两步：前端先 `auth-report`，再 `PUT` 开关（推荐，简单）。

**职责**

- 前端：`notifications` 页接 `notifyService`；开关联动授权流程
- 后端：持久化开关；发送门禁读取

---

### 3.6 发送记录（可选，P1）

```
GET /subscribe-message/logs?page=1&pageSize=20&group=class_remind
```

→ 运营排查用，前端可不接。

---

## 4. 后端内部事件（非 HTTP，供实现参考）

业务 API 成功后发布事件，由 `NotificationDispatcher` 消费：

| 事件 | 触发 API | 模板组 | 接收人 |
|------|----------|--------|--------|
| `LessonCheckedIn` | 消课/点名 | `lesson_result` | 家长 |
| `ScheduleChanged` | 改期/停课 | `schedule_change` | 家长、任课教师 |
| `ClassDissolved` | 删班 | `schedule_change` | 家长 |
| `LeaveReviewed` | 请假审批 | `approval_result` | 教师/家长 |
| `UnattendedAt20` | 定时任务 | `todo_remind` | 教师 |
| `ClassRemindDue` | 定时任务 | `class_remind` | 家长/教师 |
| `PackageLowHours` | 定时/课时变更 | `package_alert` | 家长、顾问 |
| `PackageExpiring` | 定时任务 | `package_alert` | 家长 |

**Dispatcher 伪代码**

```
on(event):
  if !notifySettingEnabled(event): return skip_disabled
  if !hasQuota(receiver, group): 
      if fallback: createInAppNotification()
      return skipped_no_quota
  if dedup(bizKey): return deduped
  sendWechatSubscribe()
  decrementQuota()
```

---

## 5. 前端联调流程（P0）

```
1. 登录 → GET /subscribe-message/bootstrap
2. 用户点击「开启上课提醒」→ wx.requestSubscribeMessage(tmplIds)
3. POST /subscribe-message/auth-report
4. PUT /notify-settings/student-class-one-day { enabled: true }
5. （后端定时）课前提醒 → 用户收到服务通知
6. 无额度时 → 用户仍可在首页待办/消息中心看到
```

---

## 6. 前端实现清单

- [ ] `src/services/subscribe-message.ts` — bootstrap / authReport / getQuotas
- [ ] 扩展 `src/utils/subscribe-message.ts` — 封装 Taro API + 场景映射
- [ ] `notifications/index.tsx` — 接 notifyService + 授权联动
- [ ] 课表、点名、绑定学员页 — 埋入授权触点
- [ ] 移除 home 页「无授权伪推送」逻辑，改为展示待办或引导授权
- [ ] 类型：`src/types/subscribe-message.ts`

---

## 7. 后端实现清单

- [ ] 表：`subscribe_quota`、`subscribe_send_log`（或合并通知中心）
- [ ] `SubscribeMessageModule`：token、send、quota
- [ ] `POST /subscribe-message/auth-report`
- [ ] `GET /subscribe-message/bootstrap`
- [ ] `NotificationDispatcher` + 各业务事件挂钩
- [ ] Cron：课前提醒、20:00 未点名、续费/到期扫描
- [ ] 配置：模板 ID 映射 `group → tmplId`
- [ ] 监控：发送成功率、skip 原因分布

---

## 8. 与 08 待办契约的关系

| 能力 | 待办 `08-todo-module-api-contract` | 本文订阅消息 |
|------|-----------------------------------|--------------|
| 展示位置 | 首页/我的待办 Tab | 微信「服务通知」 |
| 是否消耗微信额度 | 否 | 是 |
| 开关 | `todo-settings`（本地，待后端化） | `notify-settings` |
| 重叠场景 | 未点名、续费、线索 | 可站外增强，待办仍保留 |

**推荐**：同一业务事件后端**同时**评估：待办必写（或按 todo-settings），订阅按额度可选。

---

## 9. 待定项（讨论后回填）

- [ ] P0 模板组最终列表与 MP 模板 ID
- [ ] `bizKey` 命名规范全文
- [ ] 多校区下配额是否共享
- [ ] `bootstrap` 是否按 `campusId` 过滤模板
- [ ] 失败重试策略（微信 43101 等）
