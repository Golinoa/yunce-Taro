---
last_updated: 2026-09-12
status: active
---

# Skill: 新增业务模块

## 前置

- [ ] 在 `.harness/changes/<module>-feature/` 建设计文档（目标 / 非目标 / 涉及模块 / 验收标准）
- [ ] 与后端核对路由、validator、字段单位——**不猜接口**
- [ ] 读 `.harness/rules/00-core-stack.md` 与 `40-data-and-services.md`

## 实施顺序（不可颠倒）

```
types → constants → services → stores（可选）→ components → pages → 注册路由
```

1. **`src/types/course.ts`** — 定义业务类型，优先 union type，接口命名 PascalCase
2. **`src/constants/course.ts`** — 业务常量、状态映射表（不要硬编码文案）
3. **`src/services/course.ts`** — Service 层，负责 DTO → 现有 UI 模型的映射
   - 复用 `utils/request.ts`，不新造请求链路
   - 401 / 续期交给统一链路
4. **`src/stores/course.ts`**（仅当需要跨页状态）— Zustand，选择性订阅
5. **`src/components/course/XxxCard/index.tsx`** — 业务组件；先查 `component-catalog` 是否已有可复用
6. **`src/pages/course-list/` + `course-detail/`** — 按 `new-page.md` 建
7. **各目录 `index.ts` 聚合导出中追加**——消费方只从目录根导入
8. **`src/app.config.ts` 注册路由**（分包页注册到对应 `package-*`）

## 验收（缺一不可）

- [ ] 正常 / 空态 / 错误 / 无权限 / 幂等 五种分支都验证过
- [ ] 未接通路径登记进统一 ISSUES 台账，没有伪造成功
- [ ] `npm run check` 通过
- [ ] 转 `verify-build.md` 编译并说明 dist 状态

## 禁止

- 页面里硬编码业务列表或恢复已删除的 `src/data`
- 直接 `import '@/services/course'` 这类穿透内部文件的写法
- 为绕过类型问题加 `as any`
