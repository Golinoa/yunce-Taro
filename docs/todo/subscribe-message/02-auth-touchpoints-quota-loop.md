# 授权触点 × 模板配置 × 配额最大化闭环

> 状态：**草案 · 待讨论**  
> 背景：[00-research-and-plan.md](./00-research-and-plan.md) · 接口：[01-api-contract.md](./01-api-contract.md)  
> 目标：在「一次授权一条」约束下，把**用户主动操作**变成攒额度的高转化时刻，形成「愿意点 → 能收到 → 还想再开」的闭环。

---

## 1. 核心原则

### 1.1 额度是谁的，就在谁的设备上申请

| 接收人 | 谁要点授权 | 典型误区 |
|--------|------------|----------|
| 教师/顾问自己 | 教师本人点击 | ❌ 校长帮老师攒额度 |
| 家长 | 家长本人点击 | ❌ 前台发卡时替家长弹窗 |
| 协作待办参与人 | **每位参与人**各自点击 | ❌ 创建人授权一次给所有人发 |

发卡、充值、创建待办是**绝佳的申请时机**，但主要给**操作者本人**攒额度；给家长的通知要在**家长链路**（绑定学员、看课表、点名后引导）再申请。

### 1.2 一次点击，尽量打包 ≤5 个「标题不同」的模板

微信限制：同次 `tmplIds` 内**模板标题不能重复**。  
策略：按操作选**互补模板组**（提醒类 + 结果类 + 变更类），单次攒满额度池。

### 1.3 文案不说「订阅消息」，说用户能得到什么

| ❌ 避免 | ✅ 推荐 |
|--------|--------|
| 订阅消息授权 | 到时微信提醒我 |
| 开启通知权限 | 上课前 30 分钟提醒 |
| 允许推送 | 课时不足时通知我 |

### 1.4 三态闭环

```
操作成功（用户刚有「怕被错过」的心理）
  → 轻量引导条 / 成功页 CTA（可跳过，不阻断业务）
  → 用户点击「开启提醒」→ requestSubscribeMessage
  → auth-report 入账 → UI 反馈「已开启，将在 xx 提醒您」
  → 到期由后端 send 消耗 1 次 → 站内待办仍保留作兜底
```

拒绝授权：**业务已完成**，仅降级为页内待办/消息中心，不二次骚扰。

---

## 2. 模板配置（6 组 · 账号级）

> MP 后台选用后，由 `GET /subscribe-message/bootstrap` 下发 `tmplId`。  
> 下列 `keyword` 为公共模板选型参考，以审核通过为准。

| 模板组 | 建议微信模板标题（须互不相同） | 关键词槽位 | 主要消耗场景 | 首期 |
|--------|-------------------------------|------------|--------------|------|
| `class_remind` | **上课提醒** | 课程名称 thing、上课时间 time、温馨提示 thing | 课前 1 天/30min、教师当日课表 | P0 |
| `schedule_change` | **课程安排变更** | 课程名称、变更说明、变更时间 | 调课、停课、解散、试听 | P0 |
| `lesson_result` | **上课情况通知** | 学员姓名、上课结果、剩余课时 | 点名消课、课堂点评 | P0 |
| `todo_remind` | **待办事项提醒** | 待办标题、提醒时间、备注 | 自定义待办、未点名、线索跟进 | P0 |
| `package_alert` | **课时账户提醒** | 学员姓名、剩余/到期信息、温馨提示 | 续费不足、课包到期、发卡/充值跟进 | P1 |
| `approval_result` | **审批结果通知** | 申请事项、审批结果、备注 | 请假审批、跨科目消课 | P1 |

**打包示例（一次授权 3 条，标题各不相同）**

- 点名提交：`lesson_result` + `todo_remind` + `class_remind`
- 创建待办（开提醒）：`todo_remind` + `class_remind` + `schedule_change`（预留其它事项）
- 课包充值成功：`package_alert` + `todo_remind` + `lesson_result`（顾问跟进 + 后续点名通知预期）

---

## 3. 授权触点总表（按业务流）

图例：**操作者** = 谁在该页面点击；**攒额度对象** = 谁的 `remain` +1；**建议模板** = 本次 `tmplIds` 顺序。

### 3.1 待办 · 自定义提醒（P0 — 你提出的重点）

| 触点 ID | 页面/组件 | 用户点击动作 | 操作者 | 攒额度对象 | 条件 | 建议模板（≤5） | 用户文案 |
|---------|-----------|--------------|--------|------------|------|----------------|----------|
| `custom_todo_save` | `AddCustomTodoPopover` 保存 | 点「保存」 | 创建人 | 创建人 | `remindEnabled=true` | `todo_remind` + `class_remind` + `schedule_change` | 保存后引导：**到时微信提醒我** |
| `custom_todo_collab_hint` | 创建成功 Toast 后 | 点「通知参与人」说明 | 创建人 | — | 有 `collaboratorIds` | 不弹窗，展示说明页 | 参与人需各自在待办中开启提醒 |
| `custom_todo_collab_open` | 参与人打开「我的待办」/ 待办详情 | 点横幅「开启提醒」 | 参与人 | 参与人 | 被协作且未授权 | `todo_remind` | **有人@你：开启到时提醒** |
| `custom_todo_edit_remind` | `TodoDetailPopover` 打开提醒 | 点「保存」 | 编辑人 | 编辑人 | 新开启/改了提醒时间 | `todo_remind` | 已更新提醒时间，是否同步微信？ |

**实现要点（`AddCustomTodoPopover`）**

1. `handleSubmit` 校验通过后，若 `remindEnabled`：在 `onSubmit` API **之前**串联 `requestSubscribeByScene('custom_todo_save')`（「保存」即用户点击，合规）。
2. 创建成功后 `POST /todos` 返回 `todoId`，后端建立 `bizKey=custom-todo:{id}:{remindAt}` 与模板的绑定。
3. 到 `remindAt` 由后端 cron 扫描发送；无额度 → 仅页内待办高亮（现有能力）。

**协作闭环**

```
A 创建待办 + 提醒 + @B
  → A 点保存 → A 攒 todo_remind（仅创建人自己）
  → B 下次进小程序：站内 Dialog「你有新待办」→ [查看] 跳转详情（不在此弹微信订阅）
  → B 在详情/列表点横幅「开启到时提醒」→ B 攒自己的 todo_remind
  → 到点：所有参与人都发；某人 remain=0 则仅该人站内兜底
```

---

### 3.2 学员财务 · 发卡 / 课包充值 / 添加学员

| 触点 ID | 页面 | 用户点击 | 操作者 | 建议模板 | 用户文案 |
|---------|------|----------|--------|----------|----------|
| `student_create_success` | 添加学员成功 | 「为跟进提醒屯 1 次」 | 顾问 | `package_alert` + `todo_remind` | 课时变动时提醒我 |
| `member_card_issue_success` | 开卡成功 | 成功页 CTA | 顾问/前台 | `package_alert` + `todo_remind` | 跟进提醒 |
| `package_recharge_success` | 充值成功 | 成功页 CTA | 顾问/教师 | `package_alert` + `todo_remind` | 续费窗口提醒我 |
| `package_recharge_invite_parent` | 充值成功 | 「邀请家长」 | 操作者 | —（分享链路） | 家长自行绑定后订阅 |
| `parent_bind_child_done` | 家长绑定学员 | 「接收孩子上课通知」 | 家长 | `lesson_result` + `class_remind` + `package_alert` | 预囤三类 |
| `post_class_parent` | 家长课后 | 「继续加油」按钮 | 家长 | `lesson_result` + `class_remind` | 这节课很棒，续下次通知 |

> **邀请家长**：与顾问续杯分离；老师点「邀请」时再走分享，家长在己方链路订阅。

---

### 3.3 教学 · 课表 / 点名 / 排课 / 班级

| 触点 ID | 页面 | 用户点击 | 建议模板 | 备注 |
|---------|------|----------|----------|------|
| `class_create_success` | 创建班级保存成功 | 成功 Sheet | `schedule_change` + `todo_remind` | ❌ 非每添加一学员 |
| `schedule_save_success` | 排课/调班保存 | 保存成功 | `schedule_change` + `class_remind` | |
| `schedule_refresh_remind` | 课表页 | 「开启上课提醒」 | `class_remind` + `schedule_change` | 教师未收到通知时引导来此 |
| `checkin_submit` | 点名 | **提交成功后** Sheet | `lesson_result` + `todo_remind` + `class_remind` | ❌ 非点名过程中 |
| `teacher_missed_notify` | 进小程序站内弹窗 | 「查看班级」→ 课表页再点提醒 | 课表页触点 | 补救未点名等未发出站外 |

**教师未收到微信通知时**：站内 Dialog「您有班级待查看」→ 跳转课表 → 用户点击「开启提醒」完成合规订阅（见 [03](./03-quota-pool-gamification.md) §3.3）。

---

### 3.4 招生 · 线索 / 试听

| 触点 ID | 页面 | 用户点击 | 建议模板 | 用户文案 |
|---------|------|----------|----------|----------|
| `lead_create_success` | 创建线索成功 | 续杯 CTA | `todo_remind` | 跟进到期提醒我 |
| `lead_follow_save` | 写跟进保存 | 保存成功 | `todo_remind` | 下次跟进提醒我 |
| `trial_booking_submit` | 试听预约 | 提交 | `schedule_change` + `class_remind` | 试听安排变动通知我 |

---

### 3.5 教师 · 薪资

| 触点 ID | 页面 | 用户点击 | 建议模板 |
|---------|------|----------|----------|
| `teacher_create_success` | 创建教师 | 成功续杯 | `todo_remind` |
| `salary_review_success` | 核对工资 | 核对完成 | `todo_remind` |
| `salary_send_success` | 发送工资单 | 发送成功 | `todo_remind` |

长期不用 → 额度耗尽 → 站内再激活「还要继续工资提醒吗？」（[03](./03-quota-pool-gamification.md) §6）。

---

### 3.6 囤额度页 · 木鱼/铃铛（主动囤）

见 **[03-quota-pool-gamification.md](./03-quota-pool-gamification.md)**：`quota_pool_tap` 每次点击 +1，日历可视化，木鱼/铃铛动画。

---

### 3.7 通用 · 登录 / 设置 / 低额度

| 触点 ID | 时机 | 建议模板 | 说明 |
|---------|------|----------|------|
| `login_opt_in` | 登录成功页可选卡片 | 按角色打包最多 5 个 | 不默认弹窗，用户点卡片才申请 |
| `role_switch` | 切换校长/教师/家长后 | 该角色缺额模板 | `bootstrap.lowQuotaGroups` 驱动 |
| `settings_toggle` | `notifications` 打开某项开关 | 该项对应模板组 | 先授权再 `PUT notify-settings` |
| `reauth_banner` | 任意页顶部横幅 | 缺额的那一组 | 后端返回 `suggestedScenes` |

**按角色默认打包（用户点击「一键开启」时）**

| 角色 | 一次最多申请 |
|------|----------------|
| 家长 | `class_remind` + `lesson_result` + `package_alert` + `schedule_change` + `approval_result` |
| 教师 | `class_remind` + `todo_remind` + `schedule_change` + `lesson_result` + `approval_result` |
| 校长/顾问 | `todo_remind` + `package_alert` + `schedule_change` + `approval_result` + `class_remind` |

---

## 4. 触点 × 模板 × 消耗 对照（后端配置表）

> 供后端 `notification_scene_config` 表或 YAML 使用。

| 触点 scene | 申请模板 groups | 消耗模板 group | 触发发送的业务事件 | bizKey 示例 |
|------------|-----------------|----------------|-------------------|-------------|
| `custom_todo_save` | todo_remind, class_remind, schedule_change | todo_remind | CustomTodoDue | `custom-todo:{id}:{remindAt}` |
| `member_card_issue_success` | package_alert, todo_remind | package_alert / todo_remind | PackageLowHours, PackageExpiring | `pkg-alert:{studentId}` |
| `package_recharge_success` | package_alert, todo_remind, lesson_result | package_alert | PackageExpiring | `pkg-expire:{pkgId}:{date}` |
| `checkin_submit` | lesson_result, todo_remind, class_remind | lesson_result | LessonCheckedIn | `checkin:{recordId}` |
| `schedule_save` | schedule_change, class_remind | schedule_change | ScheduleChanged | `sched-chg:{scheduleId}` |
| `schedule_refresh_remind` | class_remind, schedule_change | class_remind | ClassRemindDue | `class-remind:{schedId}:{date}` |
| `bind_child` | lesson_result, class_remind, package_alert | * | 多种 | — |

---

## 5. 配额最大化策略（产品向）

### 5.1 「高频操作 = 高频攒额度」

教培 SaaS 里顾问/教师**每天**会：点名、排课、充值、记待办。  
每个操作若顺带攒 2~3 个模板，**一周可攒数十次**，比冷启动登录弹窗转化高得多。

| 操作频率（估） | 触点 | 单次可攒 |
|----------------|------|----------|
| 每天多次 | 点名提交 | 3 |
| 每天 1~3 次 | 创建待办（开提醒） | 3 |
| 每周若干 | 充值/发卡 | 2~3 |
| 每周多次 | 看课表点提醒 | 2 |
| 按需 | 家长绑定 | 3 |

### 5.2 不与设置页 11 开关 1:1 申请

设置页开关 = **用户偏好（发不发）**；触点授权 = **额度来源**。  
同一 `class_remind` 可被：课表触点、设置页、登录页多次攒额度，**共享同一配额池**。

### 5.3 低额度预警嵌入业务

| 剩余次数 | UI |
|----------|-----|
| `todo_remind ≥ 3` | 不提示 |
| `1~2` | 创建待办保存前轻条：「微信提醒剩余 1 次，保存时将尝试续期」 |
| `0` | 保存仍成功；引导条「开启提醒可多收一条微信通知」 |

### 5.4 拒绝后的克制

- 同场景 7 天内不重复弹授权（localStorage + 后端 `last_prompt_at`）。
- 「总是保持以上选择」后尊重微信行为，不强行 Modal。

---

## 6. 前端落地优先级

| 批次 | 触点 | 文件 |
|------|------|------|
| **A** | `custom_todo_save` / `custom_todo_collab_open` | `AddCustomTodoPopover`, `TodoDetailPopover`, `my-todos/index` |
| **A** | `checkin_submit` | `lesson-form/index.tsx` |
| **B** | `package_recharge_success` | `package-form/usePackageForm.ts` |
| **B** | `member_card_issue_success` | `member-card-issue/index.tsx` |
| **B** | `schedule_refresh_remind` | `pages/schedule/index.tsx` |
| **C** | `bind_child` / `parent_*` | 家长绑定、学员详情 |
| **C** | `settings_toggle` | `notifications/index.tsx` |
| **D** | `login_opt_in` / `reauth_banner` | 登录、首页 |

共用能力：`subscribeMessageService.requestByScene(scene)` + 成功页 `SubscribeSuccessSheet` 组件。

---

## 7. 待讨论（本专题）

1. ~~协作待办到点~~ → **已定：所有人都发，无额度仅站内**。
2. ~~充值成功主 CTA~~ → **已定：线索/学员/充值均续杯；邀请家长独立按钮**。
3. ~~点名/加学员频率~~ → **已定：班级保存一次、点名提交后 Sheet；不加每学员**。
4. ~~package_alert 分期~~ → **Phase 1 触点+模板；Phase 2 cron send**（见 [03](./03-quota-pool-gamification.md) §2.3）。
5. 囤额度页默认 tab：家长进页默认 `class_remind`，教师默认 `todo_remind`？
6. 木鱼 vs 松果铃铛：默认品牌铃铛，主题里可选木鱼皮肤？

---

## 8. 与 03 文档的衔接

系统规则提醒、额度池检测、日历+木鱼囤额度、再激活弹窗 → **[03-quota-pool-gamification.md](./03-quota-pool-gamification.md)**

---

## 9. 与 00 文档的修正

- ~~自定义待办提醒：走待办 + 可选后期订阅~~ → **创建/编辑待办且开启提醒时，即为 P0 授权触点**（`custom_todo_save`）。
- 发卡、课包充值成功页列为 **P0~P1 授权触点**，区分操作者与家长两条链路。
