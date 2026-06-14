# 云策教务 UI 设计迁移文档

## 迁移时间
2026-06-11

## 来源
`docs/demo/05-student-form-designs.html`（学员添加页面设计稿）

## 目标位置
`docs/UI-design/Todo/05-student-form-designs.html`

---

## 设计稿状态

### 已完成优化项

| 优化项 | 状态 | 说明 |
|--------|------|------|
| 设计 Token 同步 | ✅ | 与 `src/theme.ts`、`src/app.scss` 完全对齐 |
| 微信小程序规范适配 | ✅ | 导航栏 44px + 胶囊按钮 87px 占位、底部安全区 |
| 单位标注 | ✅ | 所有 px 均标注 rpx 转换（1px = 2rpx）|
| 新生/老生选择器 | ✅ | 改为分段控制器（Segmented Control），去掉 emoji |
| 支付方式"其他" | ✅ | 选中后展开自定义输入框 |
| 分期算法 | ✅ | 最后一期兜底，确保总金额精确 |
| 表单校验提示 | ✅ | 新生/老生课时区域均配备错误提示 |
| 头像上传 | ✅ | 去掉 emoji，改用纯色块 + "头像"文字 |
| 底部留白 | ✅ | 内容区 padding-bottom 增至 140px + safe-area |
| 重置逻辑 | ✅ | 重置时恢复所有表单状态 |

### 已知设计 Token

```css
/* 颜色 */
--primary: #5EC8A8;
--primary-dark: #3DA88A;
--accent: #E89BB8;
--destructive: #D94040;
--warning: #E8C468;
--info: #6BB5D4;
--text: rgba(0,0,0,0.9);
--text-secondary: rgba(0,0,0,0.6);
--text-tertiary: rgba(0,0,0,0.4);
--bg-page: #F5F7FA;
--bg-card: #FFFFFF;
--bg-muted: #EDF5F2;
--border: #D5E8E0;

/* 圆角 */
--radius-card: 16px;   /* 32rpx */
--radius-input: 12px;  /* 24rpx */
--radius-button: 24px; /* 48rpx */
--radius-tag: 8px;     /* 16rpx */

/* 字号 */
--text-xs: 12px;  /* 24rpx */
--text-sm: 13px;  /* 26rpx */
--text-md: 14px;  /* 28rpx */
--text-lg: 16px;  /* 32rpx */
--text-xl: 18px;  /* 36rpx */
```

### 微信适配规范

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

## 迁移原因

原 `docs/demo` 目录仅用于临时演示，现需要将成熟的设计稿归档至 `UI-design/Todo`，作为正式开发待办队列的一部分。

---

## 后续计划

1. **首页/工作台重设计**：将首页、课时充值、学生管理融合为统一工作台
2. **学生管理列表优化**：搜索、筛选、快捷操作一体化
3. **课时充值流程优化**：与课包管理打通
4. **组件设计系统建设**：提取公共组件（卡片、表单、按钮、列表）
