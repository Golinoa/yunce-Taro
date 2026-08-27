# 事件 × 角色 × 授权链路（定稿级推演）

> 状态：**链路定稿**（每事件仅一条最佳路径，无需产品二选一）  
> 术语：本文严格区分 **弹框 / 弹窗 / 微信订阅面板**  
> 关联：[03-quota-pool-gamification.md](./03-quota-pool-gamification.md) · [01-api-contract.md](./01-api-contract.md)

---

## 0. UI 术语（禁止混用）

| 术语 | 组件 | 视觉 | 典型用途 |
|------|------|------|----------|
| **弹框** | `Dialog` / `ConfirmDialog` | **屏幕正中**浮层 + 遮罩 | 是否订阅、新待办、再激活询问 |
| **弹窗** | `BottomSheet` | **自下而上**滑出 | 点名后续杯、成功页屯额度、表单选择器 |
| **微信订阅面板** | `wx.requestSubscribeMessage` | **微信系统 UI**（非我们画的） | 用户点我们按钮后由微信弹出 |
| **横幅** | 页面内 `View` | 顶部/底部条，无遮罩 | 额度偏低轻提示 |
| **Toast** | `Taro.showToast` | 短暂文字 | 操作成功，**不能**接订阅 API |

**写作约定**：后文出现「弹框」= 正中 Dialog；「弹窗」= BottomSheet。

---

## 1. 合规铁律（每条链路都遵守）

1. **订阅 API 只能接在用户点击之后**：`requestSubscribeMessage` 必须在 `onClick` / `onConfirm` 回调同步链路里调用，禁止 `setTimeout` 延迟、禁止页面 `onLoad` 自动调。
2. **可以先弹我们的弹框，再在「确定」里调微信**：弹框展示不算订阅；用户点 **[开启提醒] / [订阅提醒] / [屯一次]** 才是合规点击。
3. **业务必须先成功**：添加学员、点名、充值等 API 成功后才出现弹框/弹窗；失败不出现订阅引导。
4. **拒绝可继续用产品**：弹框必有 **[暂不需要] / [稍后]**；拒绝不阻断业务、不反复 Modal（同事件 24h 内不重复弹同一弹框）。
5. **额度归属接收人本人**：顾问的操作只给顾问攒额度；任课教师须在自己设备上点自己的弹框。
6. **到点发送只走后端**；前端只负责攒额度 + 站内兜底。
7. **「额度不足」只能站内提醒，禁止用微信订阅消息去提醒额度不足**（见 §1.7）。

**标准点击链**

```
用户点击我们的按钮（弹框/弹窗内）
  → wx.requestSubscribeMessage({ tmplIds })
  → 微信订阅面板（可能不出现，若用户曾选「总是保持」）
  → POST /subscribe-message/auth-report
  → 更新本地 quotas → UI 反馈（Toast / 动画）
```

### 1.7 「额度不足提醒」合规结论（必读）

| 方式 | 是否合规 | 说明 |
|------|----------|------|
| **站内弹框**「微信提醒次数不足，去囤额度」 | ✅ **推荐** | 我们自己的 Dialog；[去囤额度] 跳转囤额度页，用户点击木鱼才调微信 API |
| **站内横幅**「上课提醒余额偏低」 | ✅ | E16，无遮罩、可关闭 |
| **消息中心**站内信「您有提醒因额度不足未通过微信发出」 | ✅ | 走 `notificationService`，非 subscribe.send |
| **待办 Tab / 红点** | ✅ | 页内兜底，不消耗微信额度 |
| **用 `subscribeMessage.send` 发「您的额度不足」** | ❌ **禁止** | 额度为 0 时发不出去；有 1 次额度却用来提醒「额度不足」属于浪费且不符合「服务通知」场景 |
| **冷启动自动弹微信订阅面板** | ❌ | 无用户点击 |
| **额度不足时阻断业务**（必须先订阅才能点名） | ❌ | 违反「拒绝授权仍可正常使用」 |

**结论**：可以增加「额度不足提醒」，但必须走 **E16 横幅 + E18 弹框 + 站内消息 + E14 补救**，不能走微信服务通知通道。

---

## 2. 后端配合：`pending_subscribe_prompt` 队列

任课教师「不在操作现场」时，不能当场弹框，由后端排队、下次进站消费：

```json
{
  "id": "psp-uuid",
  "userId": "teacher-001",
  "event": "student_added_to_class",
  "payload": { "studentId", "studentName", "classId", "className" },
  "templateGroups": ["class_remind", "schedule_change", "todo_remind"],
  "scene": "class_assign_teacher_prompt",
  "createdAt": "...",
  "consumedAt": null
}
```

- `GET /app/on-show` 或 `GET /subscribe-message/bootstrap` 返回 `pendingPrompts[]`（按优先级一条）。
- 前端消费后 `POST /subscribe-message/prompts/:id/consume`。
- **同用户同事件 24h 内 dedupe**（如多名学员同日入班，合并为一条「今日有 N 名学员入班」）。

---

## 3. 角色一览

| 角色代码 | 说明 |
|----------|------|
| `OP` | 当前操作者（添加学员的顾问/教师） |
| `HT` | 班级任课教师（`teachingTeacherId`） |
| `AT` | 班级助教（`assistantTeacherIds`） |
| `PA` | 学员绑定家长 |
| `MG` | 校长/管理层（本人设备攒自己的额度） |

---

## 4. 事件链路（逐条定稿）

---

### E01 · 添加学员（建档成功）

**触发**：`studentService.create` 成功。  
**操作者**：`OP`（顾问/教师）。

| 步骤 | UI | 角色 | 动作 | 模板组 | 额度 |
|------|-----|------|------|--------|------|
| 1 | Toast | OP | 「学员已添加」 | — | — |
| 2 | **弹框** | OP | 文案：「已为 **{学员名}** 建档。是否开启跟进提醒？课时不足或到期时微信通知您。」<br>按钮：[暂不需要] [开启提醒] | — | — |
| 3 | 用户点 **[开启提醒]** | OP | `requestSubscribeMessage` | `todo_remind` + `package_alert` | OP 每组 accept +1 |
| 4 | Toast | OP | 「已开启跟进提醒」 | — | — |
| 5 | （可选）**弹框** 第二屏 | OP | 若 `student-form` 引导分班且用户选「立即分班」，跳转分班页，**不重复** E01 弹框 | — | — |

**不走**：添加学员失败弹框；冷启动自动弹框。

**若 OP 同时是 HT/AT**：E01 只攒跟进类额度；任课类额度在 **E02 入班** 再攒，不合并跳过。

---

### E02 · 学员入班（分班 / 创建班级时加入学员）

**触发**：`classService.addStudents` 或创建班级保存时带学员列表成功。  
**涉及**：`OP`、`HT`、`AT`、`PA`（四条子链路，互不影响）。

#### E02-A · 操作者 `OP`

| 步骤 | UI | 动作 | 模板组 |
|------|-----|------|--------|
| 1 | Toast | 「已加入班级 **{班名}**」 | — |
| 2 | **弹框** | 「学员已进班。是否订阅 **班级变动提醒**？」[稍后] [订阅提醒] | `schedule_change` + `class_remind` |
| 3 | 点 [订阅提醒] | 微信订阅 + auth-report | OP +1/组 |
| 4 | **弹框** 按钮区 | [查看班级] [完成] | — |
| 5 | 点 [查看班级] | `navigateTo` 班级详情/课表（见 E02-D） | — |

**若 `OP ∈ {HT, AT}`**：仍走 E02-A（操作者视角）；E02-B/C 对同一人 **24h 内跳过**（dedupe key: `class_assign:{classId}:{userId}`）。

#### E02-B · 任课教师 `HT`（且 `HT ≠ OP`）

| 步骤 | UI | 时机 | 动作 |
|------|-----|------|------|
| 1 | 后端 | 入班成功瞬间 | 写入 `pending_subscribe_prompt` → `HT` |
| 2 | **弹框** | `HT` 下次 `home` `useDidShow` 且无更高优先级弹框 | 「学员 **{名}** 已加入您任课的 **{班名}**。是否订阅 **任课提醒**？（上课、点名、调课微信通知您）」[稍后] [订阅提醒] |
| 3 | 点 [订阅提醒] | `class_remind` + `schedule_change` + `todo_remind`（≤3 组） |
| 4 | **弹框** 同屏变体 | [查看班级] [完成] | |
| 5 | 点 [查看班级] | 跳转班级 → E02-D | |

#### E02-C · 助教 `AT`（且 `AT ≠ OP`，且 `AT ≠ HT`）

与 **E02-B 完全相同**，每人独立一条 `pending_prompt`，各自设备各自弹框、各自攒额度。

#### E02-D · 查看班级页（二次囤额度）

**触发**：从 E02-A/B/C 点 [查看班级] 进入，或教师主动打开班级详情。  
**角色**：当前页用户 `U`。

| 步骤 | UI | 条件 | 动作 |
|------|-----|------|------|
| 1 | 页面 `useDidShow` | `U` 为 HT/AT/OP 且 刚消费入班 prompt 后 **5 分钟内** | 自动弹出 **弹窗**（BottomSheet，非弹框） |
| 2 | **弹窗**文案 | 「多囤几次，上课提醒更安心」[下次再说] [屯 1 次] | |
| 3 | 点 [屯 1 次] | `class_remind` 单模板 auth-report | U +1 |
| 4 | Toast | 「已囤 1 次上课提醒」 | |

**频率**：同一 `classId` + `userId` 每天最多自动弹此弹窗 **1 次**；其余靠囤额度页。

#### E02-E · 家长 `PA`（学员已被家长绑定）

| 步骤 | UI | 时机 | 动作 |
|------|-----|------|------|
| 1 | 后端 | 入班成功且 `student.parentBindings` 非空 | 为每个 `PA` 写 `pending_prompt`：`child_class_assigned` |
| 2 | **弹框** | `PA` 下次进小程序 `onShow` | 「**{孩子名}** 已进入班级 **{班名}**。是否订阅上课提醒？」[稍后] [订阅提醒] |
| 3 | 点 [订阅提醒] | `class_remind` + `schedule_change` + `lesson_result` | PA +1/组 |
| 4 | Toast | 「已开启上课提醒」 | |

**若孩子尚未绑定家长**：不发 `PA` prompt；待 **E03 绑定** 后再靠 **E04 检测课表** 补囤（见下）。

---

### E03 · 家长首次绑定学员

**触发**：家长绑定孩子 API 成功。  
**角色**：`PA`。

| 步骤 | UI | 动作 | 模板组 |
|------|-----|------|--------|
| 1 | Toast | 「绑定成功」 | — |
| 2 | **弹框** | 「是否接收 **{孩子名}** 的上课与课时通知？」[稍后] [订阅提醒] | `lesson_result` + `class_remind` + `package_alert` |
| 3 | 点 [订阅提醒] | 微信订阅 + auth-report | PA +1/组 |
| 4 | 若孩子已在班 | 后端返回 `alreadyInClass` → 紧接 **E02-E 弹框** **不重复**（合并文案已在 E03 覆盖 class_remind） | — |
| 5 | 若孩子不在班 | 仅 E03；入班后走 E02-E | — |

---

### E04 · 家长课后（点名结果已产生）

**触发**：后端点名成功且存在该学员 `LessonCheckedIn`；家长 `PA` 有绑定。  
**不在点名现场弹家长设备**（家长可能不在小程序）。

| 步骤 | UI | 时机 | 动作 |
|------|-----|------|------|
| 1 | 后端 | 点名成功 | 站内通知必达；写 `pending_prompt`：`post_class_parent` |
| 2 | **弹框** | `PA` 下次 `home` onShow | 「**{孩子名}** 本节课程已完成，表现很棒！是否订阅 **点名结果通知**？」[稍后] [订阅提醒] |
| 3 | 点 [订阅提醒] | `lesson_result` + `class_remind` | PA +1/组 |
| 4 | **弹窗** | 点 [订阅提醒] 且 accept 后 **同会话** 内 | 「再屯 1 次，下次上课继续提醒您」[屯 1 次] — 仅 `class_remind` |

每节课每个孩子 **1 次** E04 弹框（dedupe: `post_class:{recordId}`）。

---

### E05 · 点名提交（教师）

**触发**：`lesson-form` 点名 `submit` API 全部成功。  
**角色**：提交点名的 `OP`（通常为 HT/AT）。

| 步骤 | UI | 动作 | 模板组 |
|------|-----|------|--------|
| 1 | Toast | 「点名已提交」 | — |
| 2 | **弹窗**（BottomSheet） | 「为 **下次上课提醒** 屯 1 次？」[下次再说] [屯 1 次] | — |
| 3 | 点 [屯 1 次] | `todo_remind` + `class_remind` + `lesson_result` | OP +1/组 |
| 4 | 后端并行 | 向家长发 `lesson_result`（有额度则微信，无则站内）；触发 **E04** | — |

**不走**：点名表单填写过程中弹框；每名学生单独弹一次。

---

### E06 · 创建班级（保存成功）

**触发**：`course-form` / `classService.create` 保存成功。  
**角色**：`OP`。

| 步骤 | UI | 动作 | 模板组 |
|------|-----|------|--------|
| 1 | Toast | 「班级已创建」 | — |
| 2 | **弹框** | 「是否订阅 **班级课表与变动提醒**？」[稍后] [订阅提醒] | `schedule_change` + `todo_remind` |
| 3 | 点 [订阅提醒] | auth-report | OP +1/组 |
| 4 | 若保存时带学员列表 | 每个学员触发 **E02**（入班子链路），**不**在创建页每学员弹框 | — |

---

### E07 · 排课 / 调班 / 停课保存

**触发**：`schedule-form` / `batch-reschedule-confirm` 保存成功。  
**角色**：`OP`；`HT`/`AT` 若 `≠ OP` 走 pending（同 E02-B 模式，事件 `schedule_changed`）。

| 步骤 | UI | 角色 | 模板组 |
|------|-----|------|--------|
| 1 | Toast | OP | 保存成功 | — |
| 2 | **弹窗** | OP | 「课表已更新，为 **下次变动提醒** 屯 1 次？」 | `schedule_change` + `class_remind` |
| 3 | pending **弹框** | HT/AT ≠ OP | 下次 onShow：「**{班名}** 课表有调整，是否订阅提醒？」 | 同上 |
| 4 | 后端 | — | 向家长 `PA` 发 `schedule_change`（有额度）或站内 | — |

---

### E08 · 课包充值成功

**触发**：`packageService.createRecharge` 成功。  
**角色**：`OP`（顾问/教师）；**不**替家长弹。

| 步骤 | UI | 动作 | 模板组 |
|------|-----|------|--------|
| 1 | Toast | 「充值成功，到期日 {date}」 | — |
| 2 | **弹框** | 「是否开启 **{学员名}** 续费跟进提醒？」[稍后] [开启提醒] | `package_alert` + `todo_remind` |
| 3 | 点 [开启提醒] | auth-report | OP +1/组 |
| 4 | **弹框** 次要 | [邀请家长开启通知] [完成] | |
| 5 | 点 [邀请家长] | 调分享/二维码页，**不调 subscribe** | 家长走 E03/E02-E |

---

### E09 · 会员发卡（开卡）成功

与 **E08 完全相同**（弹框文案改为「开卡跟进提醒」），模板组相同。  
若次卡同步建课包，后端一并标记 `package_alert` 发送计划。

---

### E10 · 创建线索

**触发**：线索 create 成功。  
**角色**：`OP`（顾问）。

| 步骤 | UI | 模板组 |
|------|-----|--------|
| 1 | Toast + **弹框** | `todo_remind` | 「是否订阅 **跟进到期提醒**？」 |

每次 **写跟进记录** 保存成功 → **弹窗**「为下次跟进屯 1 次？」→ `todo_remind` 单组。

---

### E11 · 创建教师 / 核对工资 / 发送工资单

| 事件 | UI | 角色 | 模板组 |
|------|-----|------|--------|
| 创建教师成功 | **弹框** | `MG` 操作者 | `todo_remind` |
| 核对工资完成 | **弹窗** | 该教师本人 `HT` | `todo_remind` |
| 发送工资单成功 | **弹框** | 该教师本人 | `todo_remind` |

教师长期不用 → **E15 再激活**。

---

### E12 · 自定义待办（开启提醒）

**触发**：`AddCustomTodoPopover` 点 **保存**（合规点击）。

| 步骤 | UI | 角色 | 说明 |
|------|-----|------|------|
| 1 | 校验通过 | 创建人 | — |
| 2 | **同步**在 `onSubmit` 前 | 创建人 | `remindEnabled` → `requestSubscribeMessage`：`todo_remind` + `class_remind` |
| 3 | API `POST /todos` | — | 创建成功 |
| 4 | Toast | 「待办已创建」 | — |
| 5 | 若有参与人 | — | 不参与创建人代授权；走 **E13** |

---

### E13 · 协作待办 · 参与人进站

**触发**：后端分配协作待办给 `U`（非创建人）。

| 步骤 | UI | 动作 |
|------|-----|------|
| 1 | 站内通知 + 待办列表 | 必达 | — |
| 2 | **弹框** | `U` 下次 onShow（pending: `collab_todo_new`） | 「你有新的待办：**{标题}**」[稍后] [查看待办] |
| 3 | 点 [查看待办] | 跳转详情；**本次不调 subscribe** | — |
| 4 | 详情顶 **横幅** 或点 [开启到时提醒] | `todo_remind` | U 自己攒额度 |
| 5 | 到点 | 所有人发；`U` 无额度 → 仅站内 | — |

---

### E14 · 教师未收到微信任课通知（补救）

**触发**：后端 send 日志 `skipped_no_quota` 且事件为 `class_remind` / `todo_unattended`。

| 步骤 | UI | 角色 |
|------|-----|------|
| 1 | pending `teacher_missed_wechat` | HT/AT |
| 2 | **弹框** | 下次 onShow | 「您有 **任课班级** 事项未通过微信提醒（可能额度不足）」[稍后] [查看班级] |
| 3 | 点 [查看班级] | 跳转 → **E02-D 弹窗** 屯额度 |

---

### E15 · 额度流失再激活

**触发**：`notifyEnabled && remain=0 && 14d 无成功 send`。

| 步骤 | UI |
|------|-----|
| 1 | **弹框** | 「还要继续收到 **{类别名}** 吗？」[关闭提醒] [继续提醒] |
| 2 | [继续提醒] | 跳转囤额度页（日历+木鱼） |

14 天同组最多 1 次。

---

### E16 · 额度偏低（预警，非弹框）

**触发**：`home` `useDidShow`，无更高优先级 pending；`remain` 在 `1 ~ lowThreshold`（默认 3）。

| 条件 | UI |
|------|-----|
| 任一组 `remain ∈ [1, lowThreshold]` 且该组 `notifyEnabled` | **横幅**：「**{组名}** 还可微信提醒 **{remain}** 次，去囤几次」→ 囤额度页 |
| 频率 | 同组 **24h 1 次** |

---

### E18 · 额度不足提醒（定稿）

**触发**（满足任一）：

1. `bootstrap` / `quotas` 返回：某已开启组 `remain === 0` 且 `notifyEnabled === true`。
2. 后端 `send` 产生 `skipped_no_quota`（可写 `pending_prompt: quota_depleted`）。
3. 用户在 **消息通知页** 打开开关时检测到该组 `remain === 0`。

**与 E15 区别**：E18 = 「次数用完了，去囤」；E15 = 「14 天没发过，还要这类提醒吗」。可先后出现，频率独立。

| 步骤 | UI | 说明 |
|------|-----|------|
| 1 | **弹框**（onShow 或当场） | 标题：**微信提醒次数已用完**<br>正文：「**{组名}** 的微信服务通知次数为 0。**上课、点名、待办等重要事项仍会在小程序内通知您**，不会遗漏。是否去囤几次额度？」 |
| 2 | 按钮 | [知道了] [去囤额度] |
| 3 | [知道了] | 关闭；`POST prompts/dismiss`；**7 天内**同组不再弹 E18 |
| 4 | [去囤额度] | `navigateTo` 囤额度页并定位到该模板组 tab；用户在页内点击木鱼/「+1」→ 合规 `requestSubscribeMessage` |
| 5 | 并行 | 写一条 **站内消息**（可选）：「您有提醒因微信次数不足未发出，已改为小程序内通知」→ 消息中心可点进囤额度页 |

**当场触发示例**（消息通知页打开开关）：

```
用户打开「上课前一天提醒」开关
  → GET quotas：class_remind.remain === 0
  → 【弹框】E18（当场，不进 onShow 队列）
  → 用户点 [去囤额度] → 囤额度页
  → 囤成功后再 PUT notify-settings enabled=true
```

若用户点 [知道了] 仍允许开关保持开（站内兜底继续）；不强制关开关。

**频率**：同用户同模板组 **7 天最多 1 次** E18 弹框；横幅 E16 与 E18 不同一天同组叠加（有 E18 当天不再 E16）。

---

### E17 · 囤额度页（主动）

**入口**：消息通知页、横幅、弹窗次要按钮「去屯点额度」。  
**交互**：木鱼/铃铛 + 日历；每次点击 → `quota_pool_tap` → 单组 +1。见 [03](./03-quota-pool-gamification.md) §5。

---

## 5. 弹框优先级（同一次 onShow 只出一个）

```
1. pending_subscribe_prompt（E02-B/C/E、E14）
2. collab_todo_new（E13）
3. post_class_parent（E04）
4. quota_depleted（E18）          ← 额度不足弹框
5. quota_reactivate（E15）        ← 14 天再激活
6. 横幅（E16）                    ← 额度偏低
```

业务当场弹框（E01/E08 等）在 **操作页** 立即展示，与 onShow 队列无关。

---

## 6. 事件 → 角色 → UI → 模板 总表

| 事件 ID | 事件 | 接收角色 | 当场 UI | 延迟 UI（onShow） | 申请模板组 | 二次囤 |
|---------|------|----------|---------|-------------------|------------|--------|
| E01 | 添加学员 | OP | 弹框 | — | todo_remind, package_alert | — |
| E02-A | 入班 | OP | 弹框→查看班级 | — | schedule_change, class_remind | E02-D 弹窗 |
| E02-B | 入班 | HT≠OP | — | 弹框→查看班级 | class_remind, schedule_change, todo_remind | E02-D |
| E02-C | 入班 | AT≠OP | — | 弹框→查看班级 | 同 E02-B | E02-D |
| E02-E | 入班 | PA | — | 弹框 | class_remind, schedule_change, lesson_result | 囤额度页 |
| E03 | 绑定孩子 | PA | 弹框 | — | lesson_result, class_remind, package_alert | — |
| E04 | 课后 | PA | — | 弹框→弹窗 | lesson_result, class_remind | 弹窗屯 class_remind |
| E05 | 点名提交 | OP | 弹窗 | — | todo_remind, class_remind, lesson_result | — |
| E06 | 创建班级 | OP | 弹框 | — | schedule_change, todo_remind | — |
| E07 | 排课调班 | OP | 弹窗 | HT/AT 弹框 | schedule_change, class_remind | — |
| E08 | 充值 | OP | 弹框 | — | package_alert, todo_remind | 邀请家长 |
| E09 | 发卡 | OP | 弹框 | — | 同 E08 | 邀请家长 |
| E10 | 线索/跟进 | OP | 弹框/弹窗 | — | todo_remind | — |
| E11 | 薪资 | 教师/MG | 弹框/弹窗 | — | todo_remind | E15 |
| E12 | 自定义待办 | 创建人 | 保存点击链 | — | todo_remind, class_remind | — |
| E13 | 协作待办 | 参与人 | — | 弹框→详情横幅 | todo_remind | — |
| E14 | 未收到微信 | HT/AT | — | 弹框→E02-D | class_remind | 弹窗 |
| E15 | 再激活 | 本人 | — | 弹框 | 缺额组 | 囤额度页 |
| E16 | 额度偏低 1~3 | 本人 | 横幅 | — | — | 囤额度页 |
| E18 | 额度不足 0 | 本人 | 弹框/当场 | onShow 或开开关 | — | 囤额度页 |
| E17 | 主动囤 | 本人 | 页面点击 | — | 当前 tab 组 | 木鱼 |

---

## 7. 推演补充（边界情况）

| 情况 | 定稿行为 |
|------|----------|
| OP 即 HT，入班时又走 E02-A | E02-B 24h dedupe 跳过；不双弹 |
| 一名学员同日入多班 | 每班各一条 pending；onShow **合并**为「今日 2 个班级有新学员」单弹框，订阅一次，auth-report 记 `merged` |
| 家长未绑定，入班 | 仅站内；绑定时 E03 攒额度；若已在班不再 E02-E |
| 用户点 [稍后] | 写 `prompt_dismissed`；同 event 24h 不再弹框 |
| 微信主开关关闭 `20004` | Toast 引导微信设置；不无限重试 |
| 点名时家长在线 | 仍 E04 下次 onShow，不在教师点名页弹家长设备 |
| 管理层跨科目消课 | 不发教师代授权；`MG` 自己 E01/E08 攒 `approval_result`（P1 send） |

---

## 8. 前端组件映射

| UI 类型 | 组件 | 用于事件 |
|---------|------|----------|
| 弹框 | `SubscribePromptDialog` | E01,E02,E03,E04,E08,E09,E10,E11,E13,E14,E15,E18 |
| 弹窗 | `SubscribeRenewSheet` | E05,E07,E04 二次,E02-D |
| 横幅 | `SubscribeQuotaBanner` | E16 |
| 页面 | `quota-pool/index` | E17 |

**统一服务**：`subscribeMessageService.promptDialog(scene)` / `promptSheet(scene)` 内部封装点击 → 微信 API → auth-report。

---

## 9. API 补充

```
GET  /subscribe-message/pending-prompts     →  onShow 拉取
POST /subscribe-message/prompts/:id/consume →  弹框展示后消费
POST /subscribe-message/prompts/:id/dismiss →  点 [稍后]
```

`pending_prompt` 与 `auth-report.scene` 使用本文事件 ID（`E02-B` → scene `class_assign_teacher_prompt`）。
