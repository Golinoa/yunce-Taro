---
last_updated: 2026-09-12
status: active
source: 首页待办 FAB 与弹窗滚动位置反复丢失（多次修复互相打架）
---

# R90 滚动与交互铁律（本仓库特有，血泪级）

## PickerView

❌ `indicator-style` 高度写 `rpx`

```tsx
<PickerView indicatorStyle="height: 96rpx" />
```

✅ FIX: **必须用 `px`**。写 `rpx` 会被微信**静默忽略**并退回默认 `34px`，导致选中框高度异常、行高不一致、滚动不居中。

```tsx
<PickerView indicatorStyle="height: 48px; line-height: 48px;" />
```

> 换算：设计稿 item 高度 `96rpx`（@375 基准）→ 微信写 `48px`。
> `picker-view-column` 内子 view 高度由 `indicator-style` 决定，子元素里再写 `h-[96rpx]` 无效。

**涉及文件（改一处须全改）**：`PickerSheet`、`DatePickerSheet`、`TimePickerSheet`、`TimeRangePicker`、`teacher/MonthPickerSheet`。

排查：`grep -rn 'indicatorStyle' src/`，确认所有命中都是 `px`。

## 固定蒙层弹窗 × ScrollView（三根因必须同时规避）

| # | 根因 | 正确做法 | 禁止 |
| --- | --- | --- | --- |
| 1 | `scroll-into-view` 只要还绑着（含空串），任意 setData 都可能回顶 | idle 用 `scrollIntoViewProps(id)` **完全解绑**，仅定位瞬间传入 | 长期绑 `scrollIntoView={x \|\| undefined}` 或空串 |
| 2 | 开蒙层 setState 让未受控列表丢位置；onScroll 缓存过期 | `freeze(() => open())`：先记录 `scrollOffset` 再开层；关层后 `unfreeze()` 延迟解绑 | 先 `setVisible` 再 freeze；用 `top → top+0.01 → null` 保位置 |
| 3 | 页面级滚动 / 弹层内 Input 插入推页 | 页配置 `disableScroll: true`；Input `adjustPosition={false}` | 为弹层改 `scrollY`；用 `+0.01` 当「保位置」 |

**标准钩子**：`useOverlayScrollFreeze('#scroll-id')`

```tsx
const { freeze, unfreeze, unfreezeNow } = useOverlayScrollFreeze('#todo-scroll');
// 开层
freeze(() => setVisible(true));
// 关层
unfreeze();
```

根因总结：点卡片跳顶 = idle 仍绑着 `scroll-into-view` + 开层 setData 丢位置；关层抖滚动条 = `+0.01` 解绑舞。两套"修复"互相制造问题。

## FAB 与多入口

❌ 同一业务能力在 FAB 菜单里另写一套旁路实现（历史教训：工具栏正常，FAB 路径反复改 scroll 锁定仍跳顶）

✅ FIX: **同一能力只保留一条已验证实现**，其它入口串联到它。

```tsx
const handleTodoViewModeChange = useCallback((mode: TodoViewMode) => {
  setTodoViewMode(mode);
}, []);

const handleFabViewModeToggle = useCallback(() => {
  const next = todoViewModeRef.current === 'timeline' ? 'quadrant' : 'timeline';
  setTimeout(() => handleTodoViewModeChange(next), FAB_VIEW_TOGGLE_DELAY_MS); // ≈220ms
}, [handleTodoViewModeChange]);
```

- 菜单内操作等价于页面按钮：先收起菜单，短延迟后调用同一 handler。
- FAB 展开沿用 `fabMenuExpanded` + `scrollTopPin` + `scrollY={!fabMenuExpanded}`，勿改成 ref-only 半套方案。
- 能复用就不扩代码：每多一层无关 `setState` 都可能让微信 `ScrollView` 丢滚动位置。

## 卫生

❌ 问题排查完保留专用 `console.log` 或临时代码文件

✅ FIX: 解决后删除；正式本地调试走 `utils/local-debug.ts`。
