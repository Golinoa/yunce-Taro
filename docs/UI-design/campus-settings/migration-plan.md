# 校区设置模块 迁移计划

## 迁移时间
2026-06-13

## 来源
`docs/UI-design/campus-settings/campus-settings.html`（校区设置页面设计稿）

## 目标位置
`src/pages/campus-settings/` 及相关组件

---

## 设计稿功能清单

| 功能模块 | 功能点 | 优先级 | 状态 |
|---------|-------|--------|------|
| 校区切换 | 校区切换器、校区选择弹窗 | P0 | 待开发 |
| 校区信息 | 名称、电话、地址编辑 | P0 | 待开发 |
| 分校区管理 | 校区列表、添加、编辑、删除 | P0 | 待开发 |
| 发薪日设置 | 发薪模式（固定日期/指定星期）、星期选择 | P1 | 待开发 |
| 校区科目 | 科目列表、添加、编辑、删除、颜色图标 | P0 | 待开发 |
| 营业时间 | 工作日/周末时间范围、特殊日期管理 | P1 | 待开发 |
| 课时单价 | 按课程类型/按科目设置单价 | P1 | 待开发 |

---

## 需要创建/修改的文件

### 1. 页面文件

| 文件路径 | 说明 |
|---------|------|
| `src/pages/campus-settings/index.tsx` | 校区设置首页 |
| `src/pages/campus-settings/sub-campus.tsx` | 分校区管理页 |
| `src/pages/campus-settings/salary-day.tsx` | 发薪日设置页 |
| `src/pages/campus-settings/subject.tsx` | 校区科目页 |
| `src/pages/campus-settings/business-hours.tsx` | 营业时间页 |
| `src/pages/campus-settings/course-price.tsx` | 课时单价页 |

### 2. 组件文件

| 文件路径 | 说明 |
|---------|------|
| `src/components/CampusSwitcher/index.tsx` | 校区切换器组件 |
| `src/components/SettingList/index.tsx` | 设置项列表组件 |
| `src/components/SubjectCard/index.tsx` | 科目卡片组件 |
| `src/components/PriceCard/index.tsx` | 价格卡片组件 |
| `src/components/BottomSheet/index.tsx` | 底部弹窗组件 |
| `src/components/TimeRangePicker/index.tsx` | 时间范围选择器 |
| `src/components/WeekdayPicker/index.tsx` | 星期选择器 |
| `src/components/ColorPicker/index.tsx` | 颜色选择器 |
| `src/components/EmojiPicker/index.tsx` | Emoji选择器 |

### 3. 数据模型文件

| 文件路径 | 说明 |
|---------|------|
| `src/models/campus.ts` | 校区数据模型 |
| `src/models/subject.ts` | 科目数据模型 |
| `src/models/business-hours.ts` | 营业时间数据模型 |
| `src/models/course-price.ts` | 课时单价数据模型 |

### 4. 状态管理

| 文件路径 | 说明 |
|---------|------|
| `src/store/campusStore.ts` | 校区状态管理（Zustand） |

### 5. API 接口

| 接口路径 | 说明 |
|---------|------|
| `GET /api/campus/list` | 获取校区列表 |
| `POST /api/campus/create` | 创建校区 |
| `PUT /api/campus/:id` | 更新校区 |
| `DELETE /api/campus/:id` | 删除校区 |
| `GET /api/subject/list` | 获取科目列表 |
| `POST /api/subject/create` | 创建科目 |
| `PUT /api/subject/:id` | 更新科目 |
| `DELETE /api/subject/:id` | 删除科目 |
| `GET /api/business-hours` | 获取营业时间 |
| `PUT /api/business-hours` | 更新营业时间 |
| `GET /api/course-price/list` | 获取课时单价列表 |
| `POST /api/course-price/create` | 创建单价规则 |
| `PUT /api/course-price/:id` | 更新单价规则 |

---

## 设计 Token 同步清单

```typescript
// 颜色
--primary: #5EC8A8;
--primary-dark: #3DA88A;
--primary-bg: #EDF5F2;
--accent: #E89BB8;
--accent-bg: #FDF0F4;
--info: #6BB5D4;
--info-bg: #F0F7FB;
--warning: #E8C468;
--warning-bg: #FBF6E8;
--danger: #D94040;
--danger-bg: #FEF2F2;
--text: #374842;
--text-sec: #738C82;
--text-light: #A0B0A8;
--border: #D5E8E0;
--bg-page: #F5F7FA;
--bg-card: #FFFFFF;

// 圆角
--radius-card: 16px;
--radius-input: 12px;
--radius-button: 14px;
--radius-tag: 8px;

// 字号
--text-xs: 12px;
--text-sm: 13px;
--text-md: 14px;
--text-lg: 16px;
--text-xl: 18px;
```

---

## 微信小程序适配清单

| 项目 | 规格 |
|------|------|
| iOS 状态栏 | 44px |
| 导航栏内容高度 | 44px（总高 88px）|
| 胶囊按钮占位 | 87px（右侧不可设计区）|
| TabBar 高度 | 56px（112rpx）|
| 底部安全区 | env(safe-area-inset-bottom) |
| 页面边距 | 16px（32rpx）|
| 最小点击目标 | 44×44px |

---

## 迁移步骤

### Phase 1: 基础建设
1. 创建数据模型定义
2. 创建 Zustand Store
3. 创建基础组件（BottomSheet, SettingList）
4. 创建 API 接口 mock

### Phase 2: 核心页面
1. 校区设置首页
2. 分校区管理页
3. 校区科目管理页

### Phase 3: 扩展功能
1. 发薪日设置页
2. 营业时间设置页
3. 课时单价设置页

### Phase 4: 集成优化
1. API 接口对接
2. 状态管理集成
3. 细节打磨与测试

---

## 后续计划

1. **权限管理**：不同角色对校区的可见性和操作权限
2. **数据统计**：校区运营数据看板
3. **配置同步**：分校区配置的统一管理
