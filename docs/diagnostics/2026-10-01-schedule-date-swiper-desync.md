# 诊断 · 课表切换日期后「日历有选中态、卡片显示没课」（2026-10-01）

> 现象：点击周日历 或 左右滑动日期时，**偶尔**出现日历上某天是选中态，但下面课程卡片不显示、写「当前日期暂无课程安排」。

---

## 一、结论（大白话）

课表页有两个"人在说话"，而它们用的是**两个不同的地方**记录"今天看的是哪一天"：

- **顶部日历的选中态**：听**程序内部**记的日期（JS 状态）；
- **下面的课程卡片**：其实是**滑动的那个组件自己停在的那一页**——它按"第几页"来显示内容。

打比方：把日期列表想成一本 9 页的册子。程序手里的便签写的是"第 5 页 = 10月1日"，而**册子翻到第几页是册子自己的身体记忆**。当册子内容被"重新装订"（前面又插入 4 页）时，"第 5 页"这几个字代表的日期就变了。只要册子身体的页码和便签上的数字**错开过一次**，就会出现：

- 便签（日历选中态）是对的 → **日历上那天是选中态**
- 册子翻在别的页上 → **卡片渲染的是另外一天**

而本校排课是**按星期几**命中的（周一有课、周二没课）。差 1～4 天，星期几一定变了 ⇒ 大概率**整天没课** ⇒ 看起来就是"卡片没加载 / 显示没课"。

关键点：**这跟接口慢、数据没拉到没关系**——卡片是用本地排课规则现算的，切日期不发请求（见第四节）。

---

## 二、问题代码定位

| 位置 | 职责 | 问题 |
| --- | --- | --- |
| `src/pages/schedule/index.tsx:375-393` | 日期切换入口：`setSelectedDate` + `refreshDateData`，接 `useDateSwiperWindow` | 正常（只是把两边状态接起来） |
| `src/pages/schedule/ScheduleMainViews.tsx`（`ScheduleDateSwiper`） | 4 个日期 Swiper：`current={swiperCurrent}`，每个 SwiperItem 用 `renderDateCards(date)` 渲卡片 | `current` 是**数字页号**，没有和"日期"绑定 |
| `src/utils/use-date-swiper-window.ts` | **问题核心**：`dateWindow`（窗口）+ `swiperCurrent`（页号）两个 state，被 4 个事件源同时写 | 见第三节 |
| `src/components/CalendarWeekSelector/index.tsx:142-171 / 253-286` | 周日历自身：内部 `displaySelectedDate` + 周/月 Swiper | 同族缺陷（见第六节，本批未改） |
| `src/utils/schedule-card-build.ts:153-190` | 卡片按 `date.day_of_week` 从本地排课规则派生 | 决定了"日期错位 ⇒ 直接表现为没课" |

---

## 三、根因：三个缺陷叠加

### 缺陷 1：拿"页号"当"日期"用

`handleSwiperAnimationFinish` 的算法是 `currentDate = dateWindow[event.detail.current]`。

而窗口维护逻辑里，**往前划到边缘会前插 4 天**，同时把页号整体 +4：

```ts
setDateWindow([...prependDates, ...dateWindow]);
setSwiperCurrent(currentIndex + extendCount);   // 页号语义整体平移
```

同一次手势的第二个事件（`change` 与 `animationfinish` 是两条事件）如果在重排之后到达，`dateWindow[2]` 已经是"差 4 天"的那一天了，代码却直接 `onDateChange(那一天)`。

### 缺陷 2：原生事件不过滤来源

`handleSwiperChange` / `handleSwiperAnimationFinish` 对**任何**事件都照单全收——包括本 hook 自己程序化跳页产生的事件、以及窗口重排前那套编号的迟到事件。weapp 的 swiper 事件其实带 `detail.source`（`touch` = 用户划动 / `autoplay` / `''` = 其它原因），原实现完全忽略了它。

### 缺陷 3：对齐命令只在"数字变了"时才下发（最关键）

`<Swiper current={swiperCurrent}>` 是**数字页码**。React 只把**变化的** prop 下发给 native（值不变就不会重新 setData）。于是：

- 只要 native 页号与 JS 的 `swiperCurrent` 错开过一次（例如 native 停在 6、JS 以为 4：程序化跳页被丢掉 / 被手势惯性打断），
- 之后即使发生窗口重排，`setSwiperCurrent(4)` 也是**空操作**（数字没变），

⇒ **视图永远停在错的那一页，且没有任何机制会发现或修复它**。这就是"偶尔"的来源：它依赖事件时序，一旦错开就长期错下去，直到用户下一次操作碰巧把它带回来。

---

## 四、为什么能断定"不是没拉到数据"

- 卡片是 `buildScheduleCardsForDate(date)` 用**本地周规则**现算的：`schedule.day_of_week === date.day_of_week`（`schedule-card-build.ts:182-187`），**切换日期不发请求**。
- 所以"当前日期暂无课程安排"只可能意味着：**被渲染的那一天，星期几没有课**。
- 差异 1～4 天 ⇒ 星期几必变 ⇒ 常常整天为空 ⇒ 与"偶发、只在点/滑的瞬间出现"完全吻合。
- 反向排除：接口慢/失败会表现为全局「课表加载中…」或**所有**日期都空，不会只影响切换的那一下。

---

## 五、本批修复（口径：日期是唯一真源，页号只是 native 的当前位置）

### 1. 新增纯逻辑 `src/utils/date-swiper-window-logic.ts` + 18 条单测

- 页号 → 日期**一律用最新窗口**解析（不给过期数组机会）；
- **只有通过校验的用户手势**才能改选中日：`source === 'touch'`，或几何上"只走一页 + 日期只差一天"（手势永远只走一天，差 4 天只可能是编号错位）；
- 其余事件不改日期，只做对齐；落点不是选中日 ⇒ 判为**视图漂移** → 让调用方重挂载拉回；
- 扩窗只改数组、尽量不动编号；**编号变了必须重挂载**；窗口到上限自动以当前日重排（顺带修掉窗口无限增长的隐患）。

关键回归用例（对应上面的时序）：

- 窗口前插 4 天后的迟到事件 → 旧实现 `dateWindow[2]` 落到"差 4 天"并改选中日；新实现判为**漂移**，不改日期。
- 程序化命令在途时的动画中间页 → 忽略（`command-in-flight`）。
- 同一手势的 change + animationfinish 双事件 → 去重（避免第二个事件按新编号解析成"差 4 天"）。

### 2. 重写 `src/utils/use-date-swiper-window.ts`

- 用 ref 镜像最新 `{window, index, selectedDate}`，事件回调**不再吃过期闭包**；
- 程序化命令带确认看门狗：1200ms 内 native 没回报落点 ⇒ 重挂载兜底对齐；
- 检测到漂移打 `logWarn('useDateSwiperWindow:view-drift')`，命令未确认打 `:command-unconfirmed`（真机取证用）；
- 新增返回 `swiperSyncKey`。

### 3. 消费方接线（编号语义变化时重挂载是唯一可靠的对齐手段）

- `src/pages/schedule/index.tsx` → `ScheduleMainViews` → 3 个日期 Swiper 用 `key={syncKey}`；
- `src/components/schedule/CalendarSwiper/index.tsx`（私教/试听视图）同样接 `key={swiperSyncKey}`。

### 交互保持不变（重要）

- 正常路径完全不变：一次滑动仍跟手；点日历仍在窗口内平滑滑过去；**不新增可见动画**；
- 重挂载只发生在两类情形：① 窗口编号语义变化（本来就会整块换内容）；② 检测到漂移/命令未确认（异常态修复，修完停在正确日期）。

---

## 六、本批未做（同族缺陷，建议下一批）

`src/components/CalendarWeekSelector/index.tsx` 里的**周/月 Swiper 是同一类写法**：

- 同样忽略 `detail.source`；
- `handleWeekSwiperFinish` / `handleMonthSwiperFinish` **每次动画结束都无条件 `commitDateChange`** —— 程序化移动（由外部 `selectedDate` 变化推动的动画）也会被当成"用户翻页"去改日期。

已知可观察后果（不是本次用户报的现象，故未扩大范围）：

- 月选择器里选"10月"，动画结束后会被 `getDefaultDateForMonth` 改写成"10月1日"；
- 周滑动与日 Swiper 之间存在互相触发的回环（通常被 `isSame` 挡住，但没有收敛保证）。

建议同法处理：接 `source` 过滤 + ref 镜像窗口 + 编号变化时重挂载。

---

## 七、回归清单（需真机验证）

1. 点日历切到本周末/下周任意日期 → 卡片与日历一致；
2. 连续左右滑动 10+ 次（特别是往回滑到"前几天"触发扩窗的路径）→ 每次都只走一天，卡片不空；
3. 先滑动再立刻点日历（抢动画时间）→ 仍一致；
4. 换 Tab（班课/团课/场地）后再切日期 → 一致；
5. 私教/试听视图（`CalendarSwiper`）同样试 1–4；
6. 真机若出现 `[useDateSwiperWindow:view-drift]` 实时日志 → 说明确实发生过错位，且修复动作已触发（这条日志本身就是证据）。

---

## 八、门禁与验证

- `tsc --noEmit` exit 0；
- `eslint`（含 prettier 规则）6 个文件 0 problems；
- 单测：全量 **144 文件 / 855 条通过**（新增 `date-swiper-window-logic.test.ts` 18 条）；
- 小程序编译：见 `runtime-logs/`（`env -u NODE_OPTIONS` 增量编译 + postbuild + 页数门禁）。

> 备注：本机 vitest 进程退出码偶发非 0（用例全绿、摘要 `144 passed`），排除本次新增用例后同样复现过 ⇒ 属既有环境现象，不是本批改动引入。
