# 云策教务 - AI 编程工程化硬性要求

> 本文件是 AI 辅助编码时的强制约束，任何代码生成、修改、重构都必须遵守。
> 详细规则见 `Agents/` 目录下对应文件。

---

## 一、技术栈锁定

| 项 | 规范 | 禁止 |
|---|---|---|
| 框架 | Taro 3.x + React 18 | 类组件、Vue |
| 语言 | TypeScript 严格模式 | 隐式 any、@ts-ignore |
| 样式 | UnoCSS 原子化类名 + rpx 单位 | SCSS 文件、内联 style、px 单位 |
| 状态 | Zustand | Redux、MobX、组件内 useState 管理全局状态 |
| 日期 | dayjs | moment.js、硬编码月份/年份 |
| 类名 | classnames (cn) | 模板字符串拼接 className |

## 二、样式铁律

1. **禁止创建 SCSS 文件** — 所有样式使用 UnoCSS 类名，已有 SCSS 文件应迁移后删除
2. **禁止内联 style** — 除非动态计算值（如 ECharts 配置），否则必须用 UnoCSS 类名或 Token
3. **使用设计 Token** — 颜色用 `text-primary`/`bg-card`/`border-border` 等，禁止硬编码色值
4. **单位用 rpx** — `text-[28rpx]`、`py-[20rpx]`，禁止 `px`/`rem`（UnoCSS presetRemRpx 自动转换）
5. **新增样式规则** — 在 `uno.config.ts` 的 rules/shortcuts 中定义，禁止散落硬编码值

## 三、组件铁律

1. **先查后写** — 新增 UI 元素前，必须先检查 `src/components/` 是否已有可复用组件
2. **弹窗必须封装** — 所有底部弹窗使用 `BottomSheet` 组件，业务弹窗封装为独立 Sheet 组件
3. **输入框必须用 FormInput** — 禁止直接使用 `<Input>` 组件，必须用 `<FormInput>` 包裹
4. **BottomSheet 只传 visible** — `visible={state}` 单 prop 模式，禁止 `show={x} visible={x}`
5. **组件文件结构** — `ComponentName/index.tsx`，组件名 PascalCase，文件名 kebab-case

## 四、数据铁律

1. **设计 Token 单一数据源** — `src/theme.ts` → 同步 `app.scss` → 全局生效
2. **禁止硬编码业务文本** — 月份用 `dayjs().month() + 1`，状态文本用映射表
3. **状态机严格单向** — 薪资 pending→confirmed→paid，禁止反向跳转
4. **Mock 数据在 `src/data/`** — 禁止在组件内硬编码 mock 数据
5. **页面只引用 `@/services`** — 禁止直接引用 `@/data/`，Service 层是唯一数据出口
6. **Service 层接口契约** — mock 函数用 `mock` 前缀，联调时只改 Service 一行切换

## 五、代码质量

1. **Hooks 规范** — useCallback/useMemo 包裹回调/计算值，依赖数组完整
2. **事件命名** — handle 前缀（handleSubmit、handleClose）
3. **常量命名** — UPPER_SNAKE_CASE，提取到文件顶部或 `src/data/`
4. **类型定义** — Props 接口必须导出，禁止隐式 any
5. **JSDoc** — 每个组件必须有使用场景 + 功能说明的 JSDoc 注释

## 六、工程化工具链

| 工具 | 作用 | 触发时机 |
|------|------|---------|
| ESLint | 代码规则检查 | `npm run lint` / pre-commit |
| Prettier | 代码格式化 | `npm run format` / pre-commit |
| TypeScript | 类型检查 | `npm run typecheck` |
| husky | Git 钩子管理 | `git commit` 时自动触发 |
| lint-staged | 只检查暂存文件 | pre-commit 钩子调用 |

### 可用命令

```bash
npm run lint          # 检查代码规则
npm run lint:fix      # 自动修复规则问题
npm run format        # 格式化代码
npm run format:check  # 检查格式是否合规
npm run typecheck     # TypeScript 类型检查
npm run check         # 全量检查（typecheck + lint + format）
```

### 提交流程

```
git commit
  → husky pre-commit 钩子触发
    → lint-staged 只检查暂存文件
      → .ts/.tsx: eslint --fix + prettier --write
      → .scss/.css/.json/.md: prettier --write
        → 全部通过 → 提交成功
        → 有 error → 提交被拒绝，修完再提交
```

## 七、编译铁律

**每次代码修改完成后，必须删除 dist 目录并用 Mock 模式重新编译：**

```bash
$env:VITE_USE_MOCK="true"; npm run build:weapp
```

### 为什么必须这样做？

| 问题 | 原因 |
|------|------|
| 网络异常 | `npm run build:weapp` 是生产模式，自动禁用 Mock（`VITE_USE_MOCK=false`），而 `BASE_URL` 为空，请求全部失败 |
| 登录失败 | Mock 数据失效后，登录接口无法响应，导致"网络异常"错误 |

### 正确的编译方式

| 命令 | 说明 |
|------|------|
| `$env:VITE_USE_MOCK="true"; npm run build:weapp` | 强制开启 Mock，生产模式编译（推荐） |
| `npm run dev:weapp` | 开发模式，自动开启 Mock + 热更新 |

### 禁止的做法

- ❌ 直接使用 `npm run build:weapp`（会禁用 Mock，导致网络异常）
- ❌ 不删除 dist 目录直接编译（可能残留旧代码）

## 八、审查清单

每次代码生成/修改后，AI 必须自检：

- [ ] 是否复用了已有组件（FormInput/BottomSheet/Card 等）？
- [ ] 样式是否使用 UnoCSS Token（无硬编码色值/尺寸）？
- [ ] 弹窗是否封装为独立组件（非页面内联）？
- [ ] 输入框是否使用 FormInput（非裸 Input）？
- [ ] 是否有新增 SCSS 文件（应迁移为 UnoCSS）？
- [ ] 是否有内联 style（应提取为 UnoCSS 规则）？
- [ ] TypeScript 类型是否完整（无隐式 any）？

---

## 详细规则索引

| 文件 | 内容 |
|------|------|
| `Agents/project-structure.md` | 项目目录结构、文件命名、导出规范、新增页面/模块流程 |
| `Agents/api-service.md` | Service 层规范、接口定义、Mock 数据、请求工具、联调切换 |
| `Agents/pages.md` | 页面开发规范、生命周期、路由、Tab、列表页、详情页 |
| `Agents/components.md` | 组件开发规范、组件清单、复用规则 |
| `Agents/styles.md` | UnoCSS 规范、Token 体系、样式迁移指南 |
| `Agents/sheets.md` | 弹窗开发规范、BottomSheet 用法、Sheet 组件模板 |
| `Agents/forms.md` | 表单/输入框规范、FormInput 用法、小程序 Input 陷阱 |
| `Agents/state.md` | 状态管理规范、Zustand 用法、数据流 |
| `Agents/types.md` | TypeScript 规范、类型定义模板 |
| `Agents/review.md` | 代码审查 Checklist、常见问题速查 |
