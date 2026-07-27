# SwappableScheduleCard 交互开发指南

> 本指南固化排课/约课列表中"卡片左滑露出操作按钮"的交互设计，确保后续复用时效果不走形。

---

## 一、组件定位

`SwappableScheduleCard` 是可复用的卡片容器，用于需要左滑展示快捷操作的列表场景：

- 排课页：固定排课卡片 → 编辑 / 取消 / 恢复
- 约课页：预约记录卡片 → 编辑 / 取消 / 恢复
- 未来类似列表：学员、课包、薪资等需要左滑操作的卡片

---

## 二、设计原则

### 1. 手势分区明确

| 区域 | 手势 | 行为 |
|------|------|------|
| 卡片主体（除右侧触发条外） | 上下滑动 | `ScrollView` 正常滚动 |
| 卡片主体（除右侧触发条外） | 左右滑动 | 外层 `Swiper` 切换日期 |
| 卡片右侧触发条 | 向左滑动 | 显示操作按钮，阻止日期切换 |
| 卡片右侧触发条 | 向右滑动 | 隐藏操作按钮，阻止日期切换 |

### 2. 触发条宽度

- **收起状态**：固定 **60px**，位于卡片最右侧
- **打开状态**：**60px + 按钮总宽度**，覆盖已露出的操作按钮区域
- 按钮总宽度根据 `actions.length * 65px` 动态计算，禁止写死

### 3. 阻止 Swiper 切日期的方式

必须使用 **`catchMove`**（即微信小程序 `catchtouchmove`）。

原因：微信小程序原生 `Swiper` 的手势识别不依赖子组件冒泡的 `touchmove`，普通 `onTouchMove` 里的 `e.stopPropagation()` 对其无效。

### 4. 方向锁定

首次移动超过 4px 时锁定方向：

- `|deltaX| > |deltaY|` → 水平方向，拦截并移动卡片
- 否则 → 垂直方向，不处理，交由 `ScrollView` 滚动

### 5. 卡片互斥

同一列表中**同一时间只能打开一张卡片**的操作按钮。

实现方式：父组件维护 `openCardId` 状态，通过 `cardId` / `openCardId` / `onOpenChange` 三件套传给每个卡片。

### 6. 自动收起时机

以下场景必须自动收起已打开的按钮：

- 列表发生上下滚动
- 切换日期（点击日历 / 左右滑动 Swiper）
- 打开另一张卡片的按钮
- 点击当前卡片的操作按钮后

---

## 三、Props 规范

```ts
export interface SwappableScheduleCardProps {
  /** 卡片内容 */
  children: React.ReactNode;
  /** 左滑露出的操作按钮，建议 2 个 */
  actions: SwappableScheduleCardAction[];
  /** 卡片点击回调（非滑动时触发） */
  onClick?: () => void;
  /** 外层容器类名 */
  className?: string;
  /** 卡片圆角类名 */
  radiusClassName?: string;
  /** 当前卡片唯一标识，用于互斥管理 */
  cardId?: string;
  /** 当前处于打开状态的卡片 ID */
  openCardId?: string | null;
  /** 打开状态变化回调 */
  onOpenChange?: (cardId: string | null) => void;
}

export interface SwappableScheduleCardAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'warning';
}
```

---

## 四、代码示例

### 4.1 基础用法

```tsx
import SwappableScheduleCard from '@/components/schedule/SwappableScheduleCard';

<SwappableScheduleCard
  cardId={item.id}
  openCardId={openCardId}
  onOpenChange={setOpenCardId}
  onClick={() => handleCardClick(item)}
  actions={[
    { label: '编辑', variant: 'default', onClick: () => handleEdit(item) },
    { label: '取消', variant: 'danger', onClick: () => handleCancel(item) },
  ]}
>
  <ScheduleCard item={item} />
</SwappableScheduleCard>
```

### 4.2 父组件维护互斥状态

```tsx
const [openCardId, setOpenCardId] = useState<string | null>(null);

// ScrollView 滚动时收起
<ScrollView scrollY onScroll={() => setOpenCardId(null)}>
  {list.map((item) => (
    <SwappableScheduleCard
      key={item.id}
      cardId={item.id}
      openCardId={openCardId}
      onOpenChange={setOpenCardId}
      actions={[...]}
    >
      {...}
    </SwappableScheduleCard>
  ))}
</ScrollView>

// 切换日期时收起
const handleDateChange = useCallback((date: dayjs.Dayjs) => {
  setSelectedDate(date);
  setOpenCardId(null);
}, []);
```

### 4.3 配合 CalendarSwiper 使用

`CalendarSwiper` 已内置 `onScroll` 转发：

```tsx
<CalendarSwiper
  selectedDate={selectedDate}
  onDateChange={handleDateChange}
  onScroll={() => setOpenCardId(null)}
>
  {(date) => (
    <View>
      {records.map((item) => (
        <SwappableScheduleCard
          key={item.id}
          cardId={item.id}
          openCardId={openCardId}
          onOpenChange={setOpenCardId}
          actions={[...]}
        >
          {...}
        </SwappableScheduleCard>
      ))}
    </View>
  )}
</CalendarSwiper>
```

---

## 五、注意事项

1. **必须使用 `cardId` / `openCardId` / `onOpenChange`**
   - 即使当前列表只有一条数据，也建议传入，保证后续扩展时互斥逻辑一致。

2. **`catchMove` 的副作用**
   - 触发条会拦截该窄条内的 `touchmove`，因此该区域的上下滚动会比卡片主体略受影响。
   - 通过保持触发条宽度 60px 来最小化影响范围。

3. **不要写死按钮宽度**
   - 按钮总宽度应使用 `actions.length * ACTION_ITEM_WIDTH_PX` 计算。
   - 当前单按钮宽度常量 `ACTION_ITEM_WIDTH_PX = 65px`。

4. **滑动保护期**
   - 右滑收起按钮后 300ms 内忽略按钮点击，避免误触。
   - 该逻辑已封装在组件内部，使用方无需处理。

5. **避免双滚动条**
   - 列表所在容器不要同时开启页面级滚动和 `ScrollView` 滚动，否则垂直手势会被外层消耗，影响卡片区域滚动体验。

6. **日期切换必清空**
   - 只要触发日期变化（点击日历、Swiper 滑动、回到今天），必须同步清空 `openCardId`，否则旧日期卡片的按钮状态会残留到新日期。

---

## 六、禁止项

- ❌ 不要在 `SwappableScheduleCard` 上使用普通 `onTouchMove` 替代 `catchMove` 来阻止 Swiper（对原生 Swiper 无效）
- ❌ 不要写死 `ACTION_TOTAL_WIDTH_PX = 130px`（应动态计算）
- ❌ 不要在列表内同时打开多个卡片的按钮（必须通过 `openCardId` 互斥）
- ❌ 不要忘记在滚动和日期切换时清空 `openCardId`

---

## 七、后续扩展建议

- 若需要三颗以上操作按钮，需重新评估 65px 单按钮宽度是否适配小屏，必要时改为基于屏幕宽度的动态计算。
- 若未来卡片内容右侧本身有按钮（如代约加号），注意触发条覆盖区域不要遮挡点击；可通过保持触发条宽度 60px