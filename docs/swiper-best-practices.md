# 滑动效果最佳实践：使用 Swiper 组件

## 概述

在微信小程序和 Taro 项目中实现流畅的滑动效果，**推荐使用 Swiper 组件**而不是手动实现触摸滑动。

## 为什么选择 Swiper

### 优点
1. **原生性能优化**：微信小程序原生组件，性能最优
2. **成熟稳定**：经过大量项目验证，bug 少
3. **体验一致**：与微信生态内的其他组件体验一致
4. **功能完整**：支持循环、自动播放、指示器等常用功能
5. **维护性好**：不需要手写触摸事件处理代码

### 缺点
1. **自定义程度有限**：无法进行太复杂的定制
2. **固定的 item 高度**：每个 SwiperItem 高度需要一致

## 实现模式

### 三视图滑动模式（推荐）

对于日期、日历等需要左右滑动切换的场景，推荐使用**三视图模式**：

```tsx
import { Swiper, SwiperItem } from '@tarojs/components';

const SWIPER_DURATION = 260; // 与统计页面保持一致

function SwiperComponent() {
  const [swiperCurrent, setSwiperCurrent] = useState(1); // 0=prev, 1=current, 2=next
  
  // Swiper 变更时
  const handleSwiperChange = useCallback((event) => {
    setSwiperCurrent(event.detail?.current ?? 1);
  }, []);

  // Swiper 动画完成后
  const handleSwiperFinish = useCallback((event) => {
    const current = event.detail?.current ?? swiperCurrent;
    let delta = 0;
    if (current === 0) {
      delta = -1; // 滑到上一个
    } else if (current === 2) {
      delta = 1; // 滑到下一个
    }

    if (delta !== 0) {
      // 更新数据
      updateData(delta);
      // 重置 Swiper 位置到中间
      setSwiperCurrent(1);
    }
  }, [swiperCurrent]);

  return (
    <Swiper
      current={swiperCurrent}
      duration={SWIPER_DURATION}
      easingFunction="easeOutCubic"
      skipHiddenItemLayout
      onChange={handleSwiperChange}
      onAnimationFinish={handleSwiperFinish}
    >
      <SwiperItem itemId="prev">
        {/* 上一个视图 */}
      </SwiperItem>
      <SwiperItem itemId="current">
        {/* 当前视图 */}
      </SwiperItem>
      <SwiperItem itemId="next">
        {/* 下一个视图 */}
      </SwiperItem>
    </Swiper>
  );
}
```

## 关键配置

### Swiper Props 推荐配置

| 属性 | 推荐值 | 说明 |
|------|--------|------|
| `current` | 1 | 初始位置，通常在中间 |
| `duration` | 260 | 动画时长（毫秒） |
| `easingFunction` | `'easeOutCubic'` | 缓动函数，自然流畅 |
| `skipHiddenItemLayout` | `true` | 跳过未显示项的布局，提升性能 |
| `onChange` | 回调函数 | 滑动过程中的位置变更 |
| `onAnimationFinish` | 回调函数 | 动画完成后执行 |

### 缓动函数选择

| 函数 | 效果 | 适用场景 |
|------|------|----------|
| `default` | 平滑减速 | 通用 |
| `easeOutCubic` | 快速开始，慢结束 | 推荐，最自然 |
| `easeInCubic` | 慢开始，快速结束 | 较少用 |
| `easeInOutCubic` | 慢-快-慢 | 特殊场景 |

## 实际应用案例

### 案例 1：课表页面日期滑动

**文件位置**：`src/pages/schedule/index.tsx`

**实现方式**：
- 三个视图：前一天、今天、后一天
- 滑动后切换日期并重置 Swiper 到中间
- 每次显示对应日期的课表卡片

### 案例 2：日历组件周视图滑动

**文件位置**：`src/components/CalendarWeekSelector/index.tsx`

**实现方式**：
- 周视图：上一周、本周、下一周
- 月视图：上个月、本月、下个月
- 支持点击按钮和滑动两种切换方式

### 案例 3：统计页面视图切换

**文件位置**：`src/pages/statistics/index.tsx`

**实现方式**：
- 运营视图 / 财务视图切换
- 同时支持顶部标签点击和滑动切换
- 为项目中的参考实现

## 避免的问题

### ❌ 不要使用手动触摸滑动

```tsx
// 不推荐的方式
const handleTouchStart = (e) => { /* ... */ };
const handleTouchMove = (e) => { /* ... */ };
const handleTouchEnd = (e) => { /* ... */ };
```

**问题**：
- 手势判断复杂，容易出 bug
- 性能不如原生组件
- 体验不统一
- 维护成本高

### ⚠️ Swiper 在 ScrollView 中的问题

**错误**：
```tsx
<ScrollView scrollY>
  {/* 其他内容 */}
  <Swiper> {/* 这里会有问题 */}
    <SwiperItem>...</SwiperItem>
  </Swiper>
</ScrollView>
```

**正确**：
```tsx
<View className="flex flex-col">
  {/* 固定头部 */}
  <View className="flex-shrink-0">...</View>
  
  {/* Swiper 占据剩余空间 */}
  <Swiper className="flex-1">
    <SwiperItem>
      <ScrollView scrollY>
        {/* 内容 */}
      </ScrollView>
    </SwiperItem>
  </Swiper>
</View>
```

## 性能优化建议

1. **合理使用 `skipHiddenItemLayout`**
   - 设置为 `true`，跳过未显示项的布局计算
   - 提升初始渲染和滑动性能

2. **避免 SwiperItem 内复杂计算**
   - 复杂的数据计算放在 Swiper 外部
   - 使用 `useMemo` 缓存渲染结果

3. **图片懒加载**
   - SwiperItem 内的图片使用懒加载
   - 避免一次性加载过多图片

4. **控制 SwiperItem 数量**
   - 三视图模式（3个）是最优选择
   - 不建议超过 5 个

## 迁移指南

从手动滑动迁移到 Swiper：

1. **添加 Swiper 导入**
   ```tsx
   import { Swiper, SwiperItem } from '@tarojs/components';
   ```

2. **准备三视图数据**
   ```tsx
   const viewsData = useMemo(() => ({
     prev: getPrevData(),
     current: getCurrentData(),
     next: getNextData(),
   }), [currentData]);
   ```

3. **实现滑动处理**
   - `onChange`：更新 UI 状态
   - `onAnimationFinish`：更新数据，重置位置

4. **移除旧代码**
   - 删除触摸事件处理
   - 删除 transform 相关代码
   - 删除 isAnimating 等状态

## 常见问题

**Q: Swiper 不能自适应内容高度？**

A: Swiper 需要固定高度。可以：
1. 给 Swiper 设置固定高度
2. 使用 flex 布局让 Swiper 填充剩余空间
3. 每个 SwiperItem 高度保持一致

**Q: 滑动与 ScrollView 冲突？**

A: 确保 Swiper 不在 ScrollView 内部。让 Swiper 和 ScrollView 处于同一层级。

**Q: 滑动后立即回弹？**

A: 检查 `onAnimationFinish` 中是否正确调用了 `setSwiperCurrent(1)` 来重置位置。

## 参考文件

- `src/pages/statistics/index.tsx` - 统计页面（参考实现）
- `src/pages/schedule/index.tsx` - 课表页面
- `src/components/CalendarWeekSelector/index.tsx` - 日历选择组件
