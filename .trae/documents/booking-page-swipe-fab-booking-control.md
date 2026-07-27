# 预约页面优化：滑动切日 + FAB 缩小 + 预约控制弹窗

## Context
用户反馈三个优化点：
1. 预约页（家长视角）没有滑动切换日期功能，排课页已有需对齐
2. 排课页和预约页的圆形悬浮按钮太大，需要调小
3. 预约页家长视角需要一个 FAB，点击弹窗显示老师列表 + 开关控制可预约状态

---

## 改动 1：家长视角滑动切换日期

**文件**: `src/pages/booking/index.tsx`

- 已有 `useDateSwiperWindow` import 和老师视角的实例（line 420-426）
- 新增第二个 hook 实例供家长视角使用：
  ```ts
  const {
    dateWindow: parentDateWindow,
    swiperCurrent: parentSwiperCurrent,
    handleCalendarChange: handleParentCalendarChange,
    handleSwiperChange: handleParentSwiperChange,
    handleSwiperAnimationFinish: handleParentSwiperAnimationFinish,
  } = useDateSwiperWindow({ selectedDate, onDateChange: setSelectedDate });
  ```
- 将 `CalendarWeekSelector` 的 `onChange` 从 `setSelectedDate` 改为 `handleParentCalendarChange`（保持 Swiper 与日历同步）
- 将课程列表区域从普通 View 改为 Swiper 包裹：
  ```tsx
  <Swiper current={parentSwiperCurrent} onChange={handleParentSwiperChange}
          onAnimationFinish={handleParentSwiperAnimationFinish}>
    {parentDateWindow.map(date => <SwiperItem>{renderParentCourseSwiperItem(date)}</SwiperItem>)}
  </Swiper>
  ```
- 抽取 `renderParentCourseSwiperItem(date)` 函数：按日期参数构建课程列表并渲染（复用现有 `courses` memo 逻辑但按 date 参数过滤）

---

## 改动 2：FAB 按钮缩小

**文件 1**: `src/pages/schedule/index.tsx` (line 1427)
- `h-[108rpx] w-[108rpx]` → `h-[88rpx] w-[88rpx]`
- 图标 `size="xl"` → `size="lg"`

**文件 2**: `src/pages/booking/index.tsx` (line 1849，老师视角 FAB)
- `h-[108rpx] w-[108rpx]` → `h-[88rpx] w-[88rpx]`
- 阴影 `shadow-[0_12rpx_30rpx_rgba(249,123,109,0.35)]` → `shadow-[0_10rpx_24rpx_rgba(249,123,109,0.3)]`
- 图标 `size="lg"` → `size="md"`

---

## 改动 3：预约页家长视角 FAB + 老师预约控制弹窗

**新建文件**: `src/components/booking/BookingControlSheet/index.tsx`
- Props: `visible`, `teachers`, `bookingConfigs`, `onConfigChange`, `onClose`
- 使用 BottomSheet（visible 单 prop 模式）
- 每行老师：状态圆点 + 姓名 + 状态文字 + Switch 开关
- Switch checked = status === 'open'，color="#f97b6d"
- onChange 调用 onConfigChange(teacherId, boolean)

**文件**: `src/pages/booking/index.tsx`
- 在家长视角 loadSchedules 时同时加载老师列表
- 新增 state: `bookingControlSheetVisible`
- 新增 `handleBookingControlToggle` 回调：切换老师 config status 在 open/rest 之间
- 在家长视角 booking tab 添加 FAB（`h-[88rpx] w-[88rpx]`，mdi-tune-variant 图标）
- 渲染 BookingControlSheet 组件

---

## 关键依赖文件（不修改，仅引用）
- `src/utils/use-date-swiper-window.ts` — 滑动日期 hook
- `src/utils/booking-one-on-one.ts` — TeacherBookingConfig 类型 + 读写函数
- `src/components/BottomSheet/index.tsx` — 弹窗基础组件

## 验证
1. `npm run typecheck` 通过
2. `npm run lint` 无新增 error
3. `$env:VITE_USE_MOCK="true"; npm run build:weapp` 编译成功
4. 预约页家长视角：左右滑动可切换日期，CalendarWeekSelector 同步联动
5. 排课页 FAB 缩小至 88rpx
6. 预约页家长视角 FAB 点击弹窗，老师列表开关可切换预约状态
