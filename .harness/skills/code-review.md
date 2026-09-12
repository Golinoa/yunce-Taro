---
last_updated: 2026-09-12
status: active
---

# Skill: 代码审查 / 提交前自检

> 用法：改完代码逐项过一遍；审查他人改动时用同一份清单，逐条给结论而不是笼统「看着没问题」。

## 一、组件复用

- [ ] 新增 UI 前检索了 `src/components/`？
- [ ] 弹窗封装为独立 Sheet 组件（非页面内联）？
- [ ] 输入框使用 `FormInput`（非裸 `<Input>`）？
- [ ] 底部弹窗使用 `BottomSheet` 且只传 `visible`？

## 二、样式

- [ ] 无新增 SCSS 文件、无 SCSS import？
- [ ] 无硬编码色值（`#xxx`）、无内联 style（动态值除外）？
- [ ] 单位全为 rpx（PickerView 的 `indicatorStyle` 除外，那里必须 px）？
- [ ] 新增样式规则写进了 `uno.config.ts`？
- [ ] 底部操作栏有 `pb-safe`？

## 三、TypeScript

- [ ] Props 接口已 `export`？
- [ ] 无隐式 any、无 `@ts-ignore`、无 `as any`？
- [ ] 未使用的变量 / import 已清理？
- [ ] `useCallback` / `useMemo` 依赖数组完整？

## 四、数据

- [ ] 只从 `@/services` 取数，没有直连 `@/data`？
- [ ] 没有伪造成功 / 吞异常？
- [ ] 写操作后触发了刷新信号或 invalidate？

## 五、角色与身份（涉及才勾）

- [ ] L0–L3 没有被压成一维？
- [ ] `orgRole` 取值全大写且只有 OWNER / ADMIN / MEMBER？
- [ ] 权限判定与展示文案分离，文案走 `role-glossary`？
- [ ] 单测假数据同步修正？

## 六、卫生

- [ ] 没有遗留排查用 `console.log` / 临时文件？
- [ ] 改动范围最小化，没有顺手大重构？

## 七、验证

- [ ] `npm run check` 通过？
- [ ] 已按 `verify-build.md` 编译并说明 dist 状态？

## 常见问题速查

| 症状 | 根因 | 方案 |
| --- | --- | --- |
| Input 文字不居中 | 在 Input 上设 height/line-height | 用 `FormInput`，容器控高 |
| BottomSheet 无动画 | `show` + `visible` 双 prop | 只传 `visible` |
| 弹窗关闭后状态残留 | 未重置内部状态 | `useEffect` 监听 `visible` |
| 颜色散落各处 | 未走 Token 体系 | `theme.ts` → `app.config` → `uno.config.ts` |
| 首页 FAB 切视图跳顶 | FAB 内直接 setState 走了旁路 | 复用同一 handler，见 `rules/90-scroll-interaction.md` |
| `CommonEventFunction` 未定义 | `@tarojs/components` 类型问题 | 过滤 node_modules 看项目自身错误 |

## 提交规范

```
feat: 新增 XX 功能
fix: 修复 XX 问题
refactor: 重构 XX 模块
style: 样式调整（不影响逻辑）
docs: 文档
chore: 构建 / 配置变更
```

## 提交流程（husky 自动触发）

```
git commit
  → husky pre-commit 钩子触发
    → lint-staged 只检查暂存文件
      → .ts/.tsx: eslint --fix + prettier --write
      → .scss/.css/.json/.md: prettier --write
        → 全部通过 → 提交成功
        → 有 error → 提交被拒绝，修完再提交
```

> 不需要手动跑钩子，但提交被拒时说明有 lint / format 问题，先 `npm run lint` / `npm run format` 修完再提交。
