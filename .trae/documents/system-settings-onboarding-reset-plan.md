# 系统设置页收纳「退出登录」并新增「重置新手引导」实现计划

## 上下文

个人中心页目前直接外露「退出登录」按钮。产品希望将其收起到「系统设置」页（即现有 `package-settings/pages/campus-settings/index`），并在该页新增 6 个设置项：操作记录、主题颜色、课表管理、定时备份、用户协议、重置新手引导。当前先只实现「重置新手引导」的完整交互，其余 5 项先以占位入口呈现。

## 需求理解

- **入口调整**：个人中心页移除「退出登录」按钮；在系统设置页底部新增「退出登录」按钮。
- **新增设置项**：在系统设置页新增「系统设置」分组，包含 6 个入口。
- **首期实现**：仅「重置新手引导」需要真实功能；其余 5 项点击后给出占位提示。
- **重置新手引导**：清除本地记录的「已隐藏」标记，使店铺管理 onboarding 引导卡片重新出现（即使 6 步已完成）。
- **页面标题**：当前系统设置页导航栏标题为「校区设置」，与入口名称不一致，需同步改为「系统设置」。

## 推荐的实现方案

### 1. 文件结构与新增/修改清单

#### 修改文件

| 文件路径 | 说明 |
|---|---|
| `src/package-settings/pages/campus-settings/index.config.ts` | 导航栏标题改为「系统设置」 |
| `src/package-settings/pages/campus-settings/index.tsx` | 新增「系统设置」分组、实现重置新手引导、底部新增退出登录 |
| `src/pages/profile/index.tsx` | 移除底部「退出登录」按钮 |
| `src/utils/auth.tsx` | 新增本地存储 key 常量 `STORE_ONBOARDING_HIDDEN_KEY`（如尚未集中管理） |

### 2. 重置新手引导的状态设计

在 `utils/auth.tsx`（或新建 `utils/storage-keys.ts`）集中声明本地存储 key：

```typescript
export const STORE_ONBOARDING_HIDDEN_KEY = 'store_onboarding_hidden';
```

逻辑规则（在 `src/pages/profile/index.tsx` 中）：

| 服务返回进度 | `store_onboarding_hidden` | 页面渲染 |
|---|---|---|
| `completed < total` | 任意 | `StoreOnboarding` |
| `completed === total` | `null`（未设置） | 先显示 `ProfileGrid`，并写入 `hidden = true` |
| `completed === total` | `true` | `ProfileGrid` |
| `completed === total` | `false`（重置后） | `StoreOnboarding` |

读取/写入工具：

```typescript
function getStoreOnboardingHidden(): boolean | null {
  try {
    const raw = Taro.getStorageSync(STORE_ONBOARDING_HIDDEN_KEY);
    return raw === true ? true : raw === false ? false : null;
  } catch {
    return null;
  }
}

function setStoreOnboardingHidden(hidden: boolean): void {
  Taro.setStorageSync(STORE_ONBOARDING_HIDDEN_KEY, hidden);
}
```

### 3. 系统设置页改造

#### 新增常量

```typescript
const SYSTEM_ITEMS: SettingItem[] = [
  {
    icon: 'mdi-clipboard-text-clock-outline',
    iconBg: 'bg-primary-bg',
    iconColor: 'primary',
    title: '操作记录',
    desc: '查看账号与业务操作日志',
    route: '',
  },
  {
    icon: 'mdi-palette-outline',
    iconBg: 'bg-accent-bg',
    iconColor: 'accent',
    title: '主题颜色',
    desc: '切换品牌主题色',
    route: '',
  },
  {
    icon: 'mdi-calendar-clock-outline',
    iconBg: 'bg-info-bg',
    iconColor: 'info',
    title: '课表管理',
    desc: '管理排课与课表展示',
    route: '',
  },
  {
    icon: 'mdi-cloud-upload-outline',
    iconBg: 'bg-success-bg',
    iconColor: 'success',
    title: '定时备份',
    desc: '设置数据自动备份周期',
    route: '',
  },
  {
    icon: 'mdi-file-document-outline',
    iconBg: 'bg-warning-bg',
    iconColor: 'warning',
    title: '用户协议',
    desc: '查看用户协议与隐私政策',
    route: '/pages/agreement/index',
  },
  {
    icon: 'mdi-restart',
    iconBg: 'bg-error-bg',
    iconColor: 'error',
    title: '重置新手引导',
    desc: '重新显示店铺管理配置引导',
    route: '__reset_onboarding__',
  },
];
```

#### 处理函数

```typescript
const handleResetOnboarding = useCallback(() => {
  Taro.showModal({
    title: '重置新手引导',
    content: '重置后将重新显示店铺管理配置引导，是否继续？',
    confirmColor: '#5EC8A8',
    success: (res) => {
      if (res.confirm) {
        Taro.setStorageSync(STORE_ONBOARDING_HIDDEN_KEY, false);
        Taro.showToast({ title: '已重置', icon: 'success' });
      }
    },
  });
}, []);

const handleSignOut = useCallback(async () => {
  const res = await Taro.showModal({
    title: '确认退出',
    content: '退出后将清除本地登录状态，是否继续？',
    confirmColor: '#5EC8A8',
  });
  if (!res.confirm) return;
  await signOut();
  Taro.reLaunch({ url: '/pages/login/index' });
}, []);
```

在 `handleNavigate` 中新增分支：

```typescript
if (route === '__reset_onboarding__') {
  handleResetOnboarding();
  return;
}
```

页面底部新增退出登录按钮：

```tsx
<View className="px-[32rpx] mt-[48rpx] mb-[48rpx]">
  <View
    className="bg-white rounded-[28rpx] py-[28rpx] flex items-center justify-center shadow-soft press-bg"
    onClick={handleSignOut}
  >
    <Text className="text-[30rpx] font-semibold text-error">退出登录</Text>
  </View>
</View>
```

### 4. 个人中心页改造

移除底部「退出登录」相关 JSX。保留 `handleSignOut` 逻辑本身（若其他入口不再使用可一并删除，但建议保留在 auth.tsx 中统一维护）。

### 5. 边界情况

| 编号 | 边界情况 | 处理策略 |
|---|---|---|
| 1 | 用户从未进入过店铺管理引导 | `hidden` 为 `null`，按服务数据自然渲染 |
| 2 | 6 步已完成且已自动隐藏 | `hidden = true`，显示正常 8 宫格 |
| 3 | 重置后返回个人中心 | `hidden = false`，显示引导态 |
| 4 | 重置后引导态再次全部完成 | 自动重新设置 `hidden = true`，恢复为正常态 |
| 5 | 多角色切换 | 本地存储 key 与账号无关，切换身份后行为一致；若需按身份隔离，key 可拼接 `userId` |
| 6 | 本地存储读取失败 | 降级为 `null`，按服务数据自然渲染 |
| 7 | 用户连续点击重置 | 仅重复设置 `false`，幂等无额外副作用 |

## 验证 Checklist

- [ ] 系统设置页导航栏标题显示为「系统设置」
- [ ] 个人中心页底部不再显示「退出登录」
- [ ] 系统设置页新增「系统设置」分组，包含 6 个入口
- [ ] 点击「重置新手引导」弹出二次确认弹窗
- [ ] 确认重置后，返回个人中心可重新看到店铺管理 onboarding 引导态
- [ ] 6 步全部完成后再次返回个人中心，自动恢复为正常 8 宫格
- [ ] 点击「用户协议」跳转至协议页
- [ ] 其余 4 项点击给出占位提示
- [ ] 点击底部「退出登录」可正常退出并跳转登录页
- [ ] `npm run lint` 无新增 error
- [ ] `npm run typecheck` 通过
- [ ] `$env:VITE_USE_MOCK="true"; npm run build:weapp` 编译成功
