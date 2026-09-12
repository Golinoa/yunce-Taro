---
last_updated: 2026-09-12
status: active
source: Agents/swappable-schedule-card.md 迁移
---

# SwappableScheduleCard 交互指南

> 排课 / 约课列表中"卡片左滑露出操作按钮"的交互设计，复用时效果不走形。

## 组件定位

`SwappableScheduleCard` 是可复用的卡片容器，用于需要左滑展示快捷操作的列表：

- 排课页：固定排课卡片 → 编辑 / 取消 / 恢复
- 约课页：预约记录卡片 → 编辑 / 取消 / 恢复
- 未来类似列表：学员、课包、薪资等需要左滑操作的卡片

## 手势分区（必须遵守）

| 区域 | 手势 | 行为 |
| --- | --- | --- |
| 卡片主体（除右侧触发条外） | 上下滑动 | `ScrollView` 正常滚动 |
| 卡片主体（除右侧触发条外） | 左右滑动 | 外层 `Swiper` 切换日期 |
| 卡片右侧触发条 | 向左滑动 | 显示操作按钮，阻止日期切换 |
| 卡片右侧触发条 | 向右滑动 | 隐藏操作按钮，阻止日期切换 |

## 触发条宽度

- **收起状态**：固定 **60px**，位于卡片最右侧。
- **打开状态**：**60px + 按钮总宽度**，覆盖已露出的操作按钮区域。
- 按钮总宽度 = `actions.length * 65px` 动态计算，**禁止写死**（如 `ACTION_TOTAL_WIDTH_PX = 130px`）。

## 阻止 Swiper 切日期：必须 `catchMove`

> 微信小程序原生 `Swiper` 的手势识别不依赖子组件冒泡的 `touchmove`，普通 `onTouchMove` 里的 `e.stopPropagation()` 对原生 Swiper **无效**。

- ❌ 用 `onTouchMove` + `stopPropagation` 阻止 Swiper
- ✅ 必须用 `catchMove`（微信 `catchtouchmove`）——副作用是触发条区域上下滚动略受影响，靠 60px 窄条最小化影响。

## 方向锁定

首次移动超过 4px 时锁定方向：

- `|deltaX| > |deltaY|` → 水平方向，拦截并移动卡片
- 否则 → 垂直方向，不处理，交由 `ScrollView` 滚动

## 卡片互斥（父组件管状态）

同一列表**同一时间只能打开一张**：

```tsx
const [openCardId, setOpenCardId] = useState<string | null>(null);

<SwappableScheduleCard
  cardId={item.id}
  openCardId={openCardId}
  onOpenChange={setOpenCardId}
  ...
>
```

## 自动收起时机（必须全部覆盖）

- 列表发生上下滚动（`onScroll={() => setOpenCardId(null)}`）
- 切换日期（点击日历 / 左右滑动 Swiper / 回到今天）
- 打开另一张卡片的按钮
- 点击当前卡片的操作按钮后

## Props 规范

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

## 注意事项

1. **必须用 `cardId` / `openCardId` / `onOpenChange` 三件套**，即使列表只有一条数据——保证扩展时互斥一致。
2. **不要写死按钮宽度**：`actions.length * ACTION_ITEM_WIDTH_PX`（当前单按钮 `65px`）。
3. **滑动保护期**：右滑收起后 300ms 内忽略按钮点击（组件已内置，使用方无需处理）。
4. **避免双滚动条**：列表所在容器不要同时开页面级滚动和 `ScrollView` 滚动。
5. **日期切换必清空** `openCardId`，否则旧日期卡片的按钮状态残留到新日期。
6. 三颗以上按钮需重新评估 65px 单按钮宽度，必要时按屏幕宽度动态计算。

## 代码示例

```tsx
import SwappableScheduleCard from '@/components/schedule/SwappableScheduleCard';

const [openCardId, setOpenCardId] = useState<string | null>(null);

// ScrollView 滚动时收起
<ScrollView scrollY onScroll={() => setOpenCardId(null)}>
  {list.map((item) => (
    <SwappableScheduleCard
      key={item.id}
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
  ))}
</ScrollView>
```

`CalendarSwiper` 已内置 `onScroll` 转发，配合使用同样传 `onScroll={() => setOpenCardId(null)}`。
