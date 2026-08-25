# 页面开发规范

## 一、页面生命周期

使用 Taro Hooks，禁止 class 组件生命周期：

| Hook | 触发时机 | 用途 |
|------|----------|------|
| `useLoad(fn)` | 页面首次加载 | 初始化数据、读取路由参数 |
| `useDidShow(fn)` | 页面显示（含返回） | 刷新数据、重置状态 |
| `useDidHide(fn)` | 页面隐藏 | 暂停轮询等 |
| `usePullDownRefresh(fn)` | 下拉刷新 | 刷新列表数据 |
| `useReachBottom(fn)` | 触底 | 加载更多 |
| `useUnload(fn)` | 页面卸载 | 清理资源 |

### 禁止

```tsx
// ❌ class 组件生命周期
componentDidMount() { ... }
componentWillUnmount() { ... }

// ❌ 混用 onLoad 事件
<View onLoad={handleLoad} />

// ✅ Taro Hooks
useLoad(() => { ... });
useDidShow(() => { ... });
```

## 二、路由规范

### 页面跳转

```typescript
import Taro from '@tarojs/taro';

// 普通页面
Taro.navigateTo({ url: '/pages/teacher-detail/index?id=123' });

// TabBar 页面
Taro.switchTab({ url: '/pages/home/index' });

// 替换当前页（不可返回）
Taro.redirectTo({ url: '/pages/login/index' });

// 返回上一页
Taro.navigateBack({ delta: 1 });
```

### 路由参数

```typescript
// 传参
Taro.navigateTo({ url: `/pages/teacher-detail/index?id=${id}&tab=salary` });

// 接收参数
useLoad((options) => {
  const id = options?.id;
  const tab = options?.tab;
});
```

### 路由守卫

```typescript
// 需要登录的页面，用 withRouteGuard 包裹
import { withRouteGuard } from '@/utils/route-guard';

const TeacherList: React.FC = () => { ... };
export default withRouteGuard(TeacherList);
```

## 三、页面配置

### index.config.ts

```typescript
export default definePageConfig({
  navigationBarTitleText: '页面标题',
  navigationBarBackgroundColor: '#5EC8A8',  // 主题色头部
  navigationBarTextStyle: 'white',          // 白色标题
  // 或
  // navigationBarBackgroundColor: '#FAFDFB',  // 浅色头部
  // navigationBarTextStyle: 'black',          // 黑色标题
});
```

### 页面配置规则

| 页面类型 | 导航栏背景 | 导航栏文字 |
|----------|-----------|-----------|
| 首页/主 TabBar 页 | `#5EC8A8` | `white` |
| 列表页 | `#FAFDFB` | `black` |
| 详情页 | `#FAFDFB` | `black` |
| 表单页 | `#FAFDFB` | `black` |

## 四、页面组件结构

```tsx
import React, { useState, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import { useLoad, useDidShow } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import PageContainer from '@/components/PageContainer';
import { xxxService } from '@/services';
import { useXxxStore } from '@/stores';

const PageName: React.FC = () => {
  // 1. 状态声明
  const [data, setData] = useState<Type[]>([]);
  const [loading, setLoading] = useState(true);

  // 2. Store 引用
  const storeData = useXxxStore((s) => s.data);

  // 3. 生命周期
  useLoad((options) => {
    // 初始化
  });

  useDidShow(() => {
    // 刷新数据
    fetchData();
  });

  // 4. 数据获取
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = xxxService.getList();
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  // 5. 事件处理
  const handleAction = useCallback(() => {
    // 业务逻辑
  }, [/* deps */]);

  // 6. 渲染
  return (
    <PageContainer title="页面标题" loading={loading}>
      <View className="p-4">
        {/* 内容 */}
      </View>
    </PageContainer>
  );
};

export default PageName;
```

## 五、Tab 页面规范

### Tab 切换组件

使用 `SegmentedControl` 或自定义 Tab：

```tsx
const TAB_OPTIONS = [
  { label: '排课', value: 'schedule' },
  { label: '课时', value: 'hours' },
  { label: '薪资', value: 'salary' },
  { label: '反馈', value: 'feedback' },
];

const [activeTab, setActiveTab] = useState('schedule');

// Tab 栏
<View className="flex border-b border-border">
  {TAB_OPTIONS.map((tab) => (
    <View
      key={tab.value}
      className={cn(
        'flex-1 py-3 text-center text-sm relative',
        activeTab === tab.value ? 'text-primary font-semibold' : 'text-muted-foreground'
      )}
      onClick={() => setActiveTab(tab.value)}
    >
      {tab.label}
      {activeTab === tab.value && (
        <View className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40rpx] h-[6rpx] rounded-[4rpx] bg-primary" />
      )}
    </View>
  ))}
</View>

// Tab 内容
{activeTab === 'schedule' && <ScheduleTab />}
{activeTab === 'hours' && <HoursTab />}
```

## 六、列表页规范

### 下拉刷新 + 触底加载

```tsx
// 页面配置
export default definePageConfig({
  navigationBarTitleText: '列表',
  enablePullDownRefresh: true,
});

// 页面组件
usePullDownRefresh(async () => {
  await fetchData();
  Taro.stopPullDownRefresh();
});

useReachBottom(() => {
  if (hasMore && !loadingMore) {
    loadMore();
  }
});
```

### 空状态

```tsx
{data.length === 0 && !loading && (
  <Empty title="暂无数据" description="点击刷新重试" action={fetchData} />
)}
```

### 加载状态

```tsx
{loading && <Loading text="加载中..." />}
```

## 七、详情页规范

### 路由参数获取

```tsx
const [id, setId] = useState('');

useLoad((options) => {
  if (options?.id) {
    setId(options.id);
  }
});
```

### 数据加载

```tsx
useDidShow(() => {
  if (id) {
    fetchData(id);
  }
});
```

## 八、安全区域适配

```tsx
// 底部安全区域
<View className="pb-safe">
  {/* 内容 */}
</View>

// 或使用 UnoCSS
<View className="pb-[env(safe-area-inset-bottom)]">
  {/* 内容 */}
</View>
```

## 九、首页 ScrollView + FAB 交互

首页 `src/pages/home/index.tsx` 待办 Tab 使用整页 `ScrollView` + 固定 `ExpandableFabMenu`：

| 场景 | 做法 |
|------|------|
| FAB 展开 | `fabMenuExpanded` + `scrollTopPin` + `scrollY={!fabMenuExpanded}` |
| 菜单内「切换视图」 | 禁止展开态直接切视图；菜单关闭后延迟调用与 `TodoToolbar` 相同的 `handleTodoViewModeChange` |
| 多入口同一能力 | 只维护一条 handler，其它入口串联复用 |

`ExpandableFabMenu`：`handleActionClick` 先 `setExpandedState(false)`，再 `action.onClick()`。详见 `AGENTS.md` 第十节。
