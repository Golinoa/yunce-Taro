# 微信订阅消息 — 调研与实施方案（草案）

> 状态：**待讨论定稿**  
> 创建：2026-08-26  
> 范围：松果排课小程序（yunceTaro）+ 后端（yunce-backend）  
> 关联契约：[01-api-contract.md](./01-api-contract.md)

---

## 0. 结论先行（给决策用）

| 问题 | 结论 |
|------|------|
| 个人认证**公众号**能发订阅消息吗？ | **不能**。个人主体订阅号不支持模板/订阅消息；仅**企业认证服务号**可用公众号订阅通知。 |
| 我们实际该用哪条通道？ | **微信小程序订阅消息**（`wx.requestSubscribeMessage` + 服务端 `subscribeMessage.send`）。 |
| 一次授权能发几条？ | **每个模板授权一次 = 获得 1 次下发额度**（一次性订阅）。额度可**叠加累计**，发送时消耗 1 次。 |
| 一次弹窗最多订几个模板？ | 官方：**最多 5 个** `tmplId`（且标题不能重复）。社区有「3 个」说法，以真机与当前基础库为准，设计按 **≤5** 预留。 |
| 长期订阅能一劳永逸吗？ | **大概率拿不到**。长期/限频订阅仅对政务民生、医疗、交通、金融、教育等**特定公共服务类目**开放；商业教培 SaaS 通常只能走**一次性订阅**。 |
| 核心设计难题 | 在「授权一次发一条」约束下，用**模板合并 + 配额池 + 关键触点批量授权 + 站内兜底**，尽量降低打扰、提高送达率。 |

---

## 1. 微信平台规则调研摘要

### 1.1 能力模型（小程序）

```
用户点击/支付等行为
    → 前端 wx.requestSubscribeMessage({ tmplIds })
    → 用户 accept（可选「总是保持以上选择」）
    → 后端为该用户该模板 +1 下发额度
    → 业务事件触发
    → 后端 subscribeMessage.send（消耗 1 额度）
    → 微信「服务通知」送达
```

**硬性约束（必须遵守）**

1. **发送只能走后端**：小程序端只能申请授权，不能自行 `send`。
2. **触发时机**：基础库 ≥2.8.2 后，须在**用户点击**或**支付回调**等行为之后才能调起订阅弹窗（禁止页面加载自动弹）。
3. **一次性订阅**：每消耗 1 次授权额度，才能成功下发 1 条；拒绝授权则不应强推业务阻断（须有站内兜底）。
4. **模板去重**：同一次 `tmplIds` 数组里，各模板**标题不能相同**，否则会被 `filter`。
5. **类型不可混用**：一次性模板 ID 与长期模板 ID **不可同次调用**。
6. **账号模板上限**：小程序私有模板库有上限（常见口径约 **25 个**），须精打细算，不能「一业务事件一模板」无限扩张。
7. **日发送上限**：开通支付约 3000 万条/日，未开通约 1000 万条/日（机构体量远不到，非瓶颈）。
8. **用户主开关**：用户可在微信设置关闭订阅消息主开关（`errCode 20004`），需友好降级。

**官方文档**

- [订阅消息概述](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message-overview.html)
- [订阅消息开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message.html)
- [wx.requestSubscribeMessage](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html)
- [服务端 subscribeMessage.send](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/mp-message-management/subscribe-message/sendMessage.html)

### 1.2 与公众号的区别（避免走错路）

| 维度 | 小程序订阅消息 | 公众号订阅通知 |
|------|----------------|----------------|
| 适用账号 | 小程序（个人/企业主体均可申请小程序） | **仅认证服务号**（个人订阅号不行） |
| 授权入口 | 小程序内 `requestSubscribeMessage` | 图文/网页等场景组件 |
| 本次产品 | ✅ **采用** | ❌ 不采用（除非另做服务号矩阵） |

### 1.3 「更少次数、更长期稳定」的可行策略

微信**不会**因为勾选「总是保持以上选择」就变成无限发送；该选项只是**下次不再弹窗**，额度仍按 accept 次数累计。

**推荐组合策略**

| 策略 | 说明 | 负责方 |
|------|------|--------|
| **模板合并（Template Folding）** | 多业务场景映射到少量「泛化模板」，用 `thing/time/phrase` 字段承载差异 | 产品 + 后端 + 前端文案 |
| **配额池（Quota Ledger）** | 后端记录 `userId + tmplId + remainCount`，发送前扣减，无额度则走站内 | 后端 |
| **批量授权（Batch Subscribe）** | 在登录后、点名提交前、打开课表前等触点，一次请求 ≤5 个模板 | 前端 |
| **触点分层** | P0 高频（上课提醒）在「看课表/约课」时攒额度；P2 低频（生日）在设置页说明后授权 | 产品 |
| **站内双通道** | 待办 Tab + `notificationService` 站内信永远保留，订阅消息是**增强**不是唯一 | 前后端 |
| **定时任务 + 额度门禁** | 上课前提醒、20:00 未点名等 cron 任务先查额度，无额度记 `skipped_no_quota` | 后端 |
| **低额度再授权 UX** | 额度 < 阈值时，在相关页面轻提示「开启上课提醒」引导点击授权 | 前端 |
| **开关与合规** | `消息通知` 页开关需落库；关闭后即使有额度也不发 | 前后端 |

**不建议**

- ❌ 把首页 `loadData` 里自动检测未点名并「伪推送」当正式方案（当前 `subscribe-message.ts` 仅 mock；且缺授权触点）。
- ❌ 每个通知类型申请一个模板（很快触达账号模板上限，且用户授权疲劳）。
- ❌ 无额度时静默失败 — 必须落站内待办/消息并可观测。

---

## 2. 项目现状（代码与产品）

### 2.1 已有能力

| 模块 | 现状 | 与订阅消息关系 |
|------|------|----------------|
| `src/utils/subscribe-message.ts` | 未点名提醒骨架；模板 ID 为空；mock 本地去重 | 需扩展为通用授权 SDK |
| `package-settings/pages/notifications` | 11 项开关 UI，**仅本地 state** | 应对接 `notifyService` + 订阅授权 |
| `notifyService` / `campus.ts` | 已有 `GET/PUT /notify-settings` 契约 | 可扩展订阅类开关 |
| `notificationService` | 站内通知 CRUD + `send` | 无额度时的兜底通道 |
| `todo-settings` + 待办模块 | 首页 Tab 内提醒 | 与站外推送**分离**（已在 copy 中说明） |
| `pages/home` | 20:00 后检测 `unattended` 调 `pushUnattendedReminder` | 应改为：先授权、后端定时发 |

### 2.2 角色与触达对象

| 角色 | 主要接收场景 |
|------|----------------|
| 家长 | 上课提醒、点名/剩余课时、点评、调课、续费/到期、生日 |
| 教师 | 上课提醒、未点名、请假审批结果、薪资/周报（可选） |
| 校长/顾问 | 续费预警、线索跟进、跨科目消课、发薪（可选） |

---

## 3. 推送消息清单（自项目模块提取）

> 来源：`notifications` 设置页、`todo` 分类、业务流程中已有 `notificationService.send`、PRD/待办文档。  
> **P0** = 首期建议落地；**P1** = 二期；**P2** = 可选/低频。

### 3.1 家长端 — 通知学员

| ID | 场景 | 触发时机 | 现有代码/文档 | 优先级 | 建议模板组 |
|----|------|----------|---------------|--------|------------|
| `student-class-one-day` | 上课前一天提醒 | 前一日 20:00 | notifications 页 | P0 | **TPL_CLASS_REMIND** |
| `student-class-same-day` | 上课当天提醒 | 课前 30min | notifications 页 | P0 | **TPL_CLASS_REMIND** |
| `student-checkin` | 点名/消课通知 | 点名成功后 | lesson-form 已 `notificationService.send` | P0 | **TPL_LESSON_RESULT** |
| `student-comment` | 课堂点评 | 课后点评提交 | notifications 页 | P1 | **TPL_LESSON_RESULT** 或 **TPL_ACTIVITY** |
| `student-renewal` | 课时不足续费 | 每日 10:00，7 天 1 次 | notifications + todo `studentRecharge` | P0 | **TPL_PACKAGE_ALERT** |
| `student-birthday` | 生日祝福 | 生日当天早晨 | notifications 页 | P2 | **TPL_ACTIVITY** |
| `student-schedule-change` | 调课/停课 | 改期、取消课次 | schedule-form、batch-reschedule、schedule 删课 | P0 | **TPL_SCHEDULE_CHANGE** |

### 3.2 教师端 — 通知老师

| ID | 场景 | 触发时机 | 现有代码/文档 | 优先级 | 建议模板组 |
|----|------|----------|---------------|--------|------------|
| `teacher-class-remind` | 上课提醒 | 当日课前 | notifications 页 | P0 | **TPL_CLASS_REMIND** |
| `teacher-leave-audit` | 请假审批结果 | 审批通过/驳回 | notifications 页；请假流程 | P1 | **TPL_APPROVAL_RESULT** |
| `teacher-unattended` | 未点名补录 | 当日 20:00 仍有未点名 | home + subscribe-message.ts + todo `attendanceCheckin` | P0 | **TPL_TODO_REMIND** |
| `teacher-salary` | 薪资提醒 | 发薪日前/当天 | todo `salaryRemind`；mock 发薪日 | P2 | **TPL_TODO_REMIND** |
| `teacher-weekly` | 周报 | 每周一 | notifications 页 | P2 | **TPL_ACTIVITY** |

### 3.3 校长/顾问 — 运营与风控

| ID | 场景 | 触发时机 | 现有代码/文档 | 优先级 | 建议模板组 |
|----|------|----------|---------------|--------|------------|
| `finance-package-expire` | 课包到期 | 到期前 7/3/1 天 | todo `financePackage`；02-p1 TASK-19 | P1 | **TPL_PACKAGE_ALERT** |
| `lead-follow-up` | 线索跟进 | 超时未跟进 | todo `leadFollowUp`；lead PRD | P1 | **TPL_TODO_REMIND** |
| `cross-subject-deduct` | 跨科目消课 | 点名消课跨科目 | 01-p0 lesson-form | P1 | **TPL_APPROVAL_RESULT** |
| `class-dissolve` | 班级解散 | 批量删班 | schedule 页 | P1 | **TPL_SCHEDULE_CHANGE** |
| `trial-booking` | 试听预约结果 | 预约成功/取消 | lead 分包 | P1 | **TPL_SCHEDULE_CHANGE** |

### 3.4 自定义待办 · 发卡 · 充值（高价值授权触点）

> 详细矩阵见 **[02-auth-touchpoints-quota-loop.md](./02-auth-touchpoints-quota-loop.md)**。

| 场景 | 授权时机 | 攒额度对象 | 模板组 |
|------|----------|------------|--------|
| **自定义待办（开启提醒）** | `AddCustomTodoPopover` 点保存 | 创建人；参与人打开待办时再申请 | `todo_remind` + 可打包 2 个互补模板 |
| **会员发卡成功** | 开卡成功页 CTA「开启跟进提醒」 | 操作顾问/前台 | `package_alert` + `todo_remind` |
| **课包充值成功** | 充值成功页 CTA | 操作教师/顾问 | `package_alert` + `todo_remind` (+ `lesson_result`) |
| **邀请家长** | 分享卡片，家长自行绑定后申请 | 家长 | `lesson_result` + `class_remind` + `package_alert` |

### 3.5 首期可不站外推送

| 场景 | 说明 |
|------|------|
| 群发通知 `notification-send` | 偏运营广播，订阅额度消耗大；建议站内 + 手动触发授权 |
| 会议复盘 `meetingRemind` | 低频，页内待办即可 |

---

## 4. 模板合并方案（目标 ≤6 个私有模板）

> 账号模板数量有限，**按「模板组」映射业务**，不是按设置页 11 个开关各建模板。

| 模板组 ID | 微信公共模板关键词方向（待 MP 后台选用） | 覆盖业务 | 主要接收人 |
|-----------|------------------------------------------|----------|------------|
| **TPL_CLASS_REMIND** | 课程名称、上课时间、温馨提示 | 课前 1 天 / 当天 / 教师上课提醒 | 家长、教师 |
| **TPL_SCHEDULE_CHANGE** | 课程名称、变更类型、变更时间 | 调课、停课、解散、试听变更 | 家长、教师 |
| **TPL_LESSON_RESULT** | 学员姓名、上课结果、剩余课时 | 点名消课、课堂点评（文案区分） | 家长 |
| **TPL_PACKAGE_ALERT** | 学员姓名、剩余课时/到期日、温馨提示 | 续费不足、课包到期 | 家长、顾问 |
| **TPL_APPROVAL_RESULT** | 申请事项、审批结果、备注 | 请假审批、跨科目提醒 | 教师、校长 |
| **TPL_TODO_REMIND** | 待办标题、截止时间、温馨提示 | 未点名、线索跟进、发薪（低频） | 教师、校长 |

**首期申请建议（P0）**：先占 4 个 — `CLASS_REMIND`、`SCHEDULE_CHANGE`、`LESSON_RESULT`、`TODO_REMIND`。  
其余二期再 `addtemplate`，避免占满类目配额。

---

## 5. 授权触点设计（攒额度）

> **逐步链路定稿（弹框/弹窗/每角色）** → [04-event-role-flows.md](./04-event-role-flows.md)  
> 触点矩阵摘要 → [02-auth-touchpoints-quota-loop.md](./02-auth-touchpoints-quota-loop.md)

**摘要 — 高转化触点（按优先级）**

| 批次 | 触点 | 时机 | 建议模板打包 |
|------|------|------|----------------|
| A | `custom_todo_save` | 创建待办且开启提醒，点保存 | `todo_remind` + `class_remind` + `schedule_change` |
| A | `checkin_submit` | 点名提交后成功 Sheet | `lesson_result` + `todo_remind` + `class_remind` |
| B | `package_recharge_success` | 课包充值成功页 CTA | `package_alert` + `todo_remind` |
| B | `member_card_issue_success` | 发卡成功页 CTA | `package_alert` + `todo_remind` |
| B | `schedule_refresh_remind` | 课表页点「开启上课提醒」 | `class_remind` + `schedule_change` |
| C | `bind_child` | 家长绑定学员 | `lesson_result` + `class_remind` + `package_alert` |
| C | `settings_toggle` | 消息通知页打开开关 | 该项对应模板组 |
| D | `login_opt_in` | 登录后用户主动点卡片 | 按角色 ≤5 个 |

**原则**：额度归属接收人本人；顾问发卡/充值给**自己**攒跟进额度，家长需在绑定/课表链路**自行**授权。

---

## 6. 前后端职责划分

### 6.1 前端（yunceTaro）

| 项 | 内容 |
|----|------|
| 订阅 SDK | 扩展 `subscribe-message.ts` → `requestSubscribeByScene(scene, tmplIds)`，统一错误码处理 |
| 场景枚举 | `SubscribeScene`：login / settings_toggle / schedule_view / checkin_submit / bind_child … |
| 授权回传 | 授权结果上报后端（含 `scene`、各 `tmplId` 的 accept/reject/ban） |
| 设置页 | `notifications` 接 `notifyService`；开关联动「先授权再保存」 |
| 业务埋点 | 在 §5 触点调用 SDK，**禁止**无用户点击自动弹窗 |
| 兜底 UI | 额度不足提示、主开关关闭说明、跳转设置页 |
| 配置 | 模板 ID 从后端下发或 `constants/subscribe-templates.ts`（联调后固化） |
| 不包含 | 直接调用微信 `send`、定时任务、额度扣减逻辑 |

### 6.2 后端（yunce-backend）

| 项 | 内容 |
|----|------|
| 微信接入 | 小程序 `access_token` 管理；`subscribeMessage.send` 封装 |
| 配额账本 | 表：`subscribe_quota`（userId, openId, tmplId, remain, updatedAt） |
| 授权入账 | 接口接收前端授权结果，`accept` → `remain + 1` |
| 事件消费 | 消课、改期、定时提醒等发**领域事件** → 通知服务统一决策 |
| 发送门禁 | 检查：用户开关 + 角色 + 校区 scope + **remain > 0** |
| 定时任务 | 课前提醒、20:00 未点名、续费日播、课包到期扫描 |
| 去重幂等 | `bizKey`（如 `class-remind:{scheduleId}:{date}`）防重复发送 |
| 失败处理 | 微信错误码落库；可重试与不可重试分流；无额度转站内 `notification` |
| 模板管理 | MP 后台模板 ID 配置；环境变量/配置中心 |
| 观测 | 发送量、成功率、无额度跳过率、各场景授权转化率 |

### 6.3 分工边界（争议点预设）

| 问题 | 建议 |
|------|------|
| 授权弹窗由谁决定弹不弹？ | **前端**决定触点；**后端**返回 `suggestedScenes` 与 `lowQuotaTmplIds` |
| 开关存在哪？ | **后端权威**（多端一致）；前端缓存 |
| 上课提醒何时发？ | **后端 cron**；前端不参与算时间 |
| 点名后通知家长 | **后端**在消课 API 成功后触发（前端可顺带帮教师申请模板额度） |

---

## 7. 分阶段实施计划

### Phase 0 — 对齐（本周）

- [ ] 确认主体类型：小程序个人/企业？是否另注册服务号？
- [ ] MP 后台选类目、申请 P0 四个模板，拿到 `template_id`
- [ ] 评审本文档 + [01-api-contract.md](./01-api-contract.md)
- [ ] 确定首期 P0 场景范围（建议 6 条以内）

### Phase 1 — 基础设施（1~2 周）

- [ ] 后端：配额表 + 授权上报 + send 封装 + 发送日志
- [ ] 前端：通用 `subscribeMessageService` + 登录/设置页授权
- [ ] 通知设置页接后端开关
- [ ] 站内兜底联调（无额度仍写 `notification`）

### Phase 2 — P0 业务（2~3 周）

- [ ] 课前提醒（前一日 20:00 + 前 30min）定时任务
- [ ] 点名结果通知家长（消课 API 钩子）
- [ ] 调课/停课通知
- [ ] 教师未点名 20:00 提醒（替换当前前端 mock）

### Phase 3 — P1 扩展

- [ ] 续费/课包到期、请假审批、线索跟进、跨科目消课
- [ ] 低额度再授权策略、数据看板

### Phase 4 — 合规与提审

- [ ] 隐私指引与收集项核对（openid、手机号）
- [ ] 拒绝授权可继续使用核心功能
- [ ] 正式环境关闭 mock 推送标记

---

## 8. 待讨论问题（请产品/后端一起拍板）

1. **主体策略**：是否升级企业主体以申请更多模板/长期订阅类目？
2. **家长上课提醒**：每周每节课都要提醒 → 预估每周需授权次数，是否接受「看课表时批量攒 5 次」交互？
3. **教师未点名**：继续 20:00 推送，还是仅次日待办？还是两者都要？
4. **续费提醒**：7 天 1 次站外 + 每日待办是否重复打扰？
5. **模板文案**：公共模板字段有限，哪些信息放 `thing`、哪些跳小程序详情页？
6. **多机构多角色**：同一 openId 在不同校区/角色下，配额与开关是否隔离？
7. **08 文档关系**：待办站外推送是否复用 `TPL_TODO_REMIND`，还是待办仅页内？

---

## 9. 参考 — 项目内已有通知发送点（需后端接管）

| 文件 | 事件 |
|------|------|
| `package-course/pages/lesson-form` | 消课通知家长、跨科目通知 |
| `package-course/pages/lesson-supplement` | 补录通知 |
| `package-course/pages/schedule-form` | 排课变更 |
| `package-course/pages/batch-reschedule-confirm` | 批量改期 |
| `pages/schedule` | 取消开课、班级解散 |
| `package-course/pages/booking-record-detail` | 约课记录 |
| `package-settings/pages/notification-send` | 群发 |

以上今日走 `notificationService.send`（站内）；订阅消息上线后应由**后端通知中心**统一：`站内必达 + 有额度则站外`。
