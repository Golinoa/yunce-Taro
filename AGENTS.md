# 云策教务 - AI 编程工程化硬性要求

> 本文件是 AI 辅助编码时的强制约束，任何代码生成、修改、重构都必须遵守。
> 详细规则见 `Agents/` 目录下对应文件。

---

## 一、技术栈锁定

| 项 | 规范 | 禁止 |
|---|---|---|
| 框架 | Taro 4.x + React 18 | 类组件、Vue |
| 语言 | TypeScript 严格模式 | 隐式 any、@ts-ignore |
| 样式 | UnoCSS 原子化类名 + rpx 单位 | **禁止新增 SCSS**（遗留待迁）；内联 style、px 单位 |
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

### AI 交付必做（每次改代码后）

凡修改 `src/` 下影响小程序运行的代码（页面 / 组件 / 样式 / Service / Store），**任务结束前 AI 必须主动执行 Mock 重编译**。用户在微信开发者工具里看的是 `dist` 产物，**只改源码不编译等于用户看不到最新效果**。

- ✅ **必须做**：改完代码 → `npm run check`（或至少 `typecheck`）→ **`npm run build:weapp:mock`**
- ❌ **禁止**：只提交源码、在回复里写「请自行编译」而不实际执行编译
- 交付摘要中注明「已重编译 `dist`」；若编译失败须修到通过再交付

**每次代码修改完成后，必须删除 dist 目录并用 Mock 模式重新编译。若"改了代码小程序里没生效"，必须连 webpack 持久化缓存一起清掉再编：**

```bash
# 常规（仅删除 dist 重编）
$env:VITE_USE_MOCK="true"; npm run build:weapp

# 干净重编（清 dist + 清 webpack 缓存，遇到"改了没反应"必用）
$env:VITE_USE_MOCK="true"; npm run build:weapp:clean
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
| `$env:VITE_USE_MOCK="true"; npm run build:weapp:clean` | 清 dist + 清 webpack 缓存后全量重编（"改了没反应"时用） |
| `npm run dev:weapp` | 开发模式，自动开启 Mock + 热更新 |

### 禁止的做法

- ❌ 直接使用 `npm run build:weapp`（会禁用 Mock，导致网络异常）
- ❌ 不删除 dist 目录直接编译（可能残留旧代码）
- ❌ "改了代码没生效"时只删 dist 不删 webpack 缓存（`node_modules/.cache/webpack/weapp`）——该缓存可能不随源码失效，会把旧代码喂进产物

## 八、审查清单

每次代码生成/修改后，AI 必须自检：

- [ ] 是否复用了已有组件（FormInput/BottomSheet/Card 等）？
- [ ] 样式是否使用 UnoCSS Token（无硬编码色值/尺寸）？
- [ ] 弹窗是否封装为独立组件（非页面内联）？
- [ ] 输入框是否使用 FormInput（非裸 Input）？
- [ ] 是否有新增 SCSS 文件（应迁移为 UnoCSS）？
- [ ] 是否有内联 style（应提取为 UnoCSS 规则）？
- [ ] TypeScript 类型是否完整（无隐式 any）？
- [ ] **是否已执行 `npm run build:weapp:mock` 重编译**（用户靠 `dist` 验收入口）？

---

## 九、小程序 PickerView 铁律

所有使用微信原生 `PickerView` / `picker-view` 的滚轮选择器（日期、时间、范围、分类等）必须遵守：

1. **`indicator-style` 的高度必须用 `px` 单位**——
   写 `rpx` 会被微信**静默忽略**并退回默认 `34px`，导致选中框高度异常、各 item 行高不一致、滚动时选中行不居中、整体"不丝滑/错位"。
2. **px 与 rpx 的换算**：设计稿 item 高度 `96rpx`（@375 基准）→ 微信须写 `48px`。
   ```tsx
   <PickerView indicatorStyle="height: 48px; line-height: 48px;" ... />
   ```
3. **`picker-view-column` 内子 view 的高度由 `indicator-style` 自动决定**，在子元素样式里写高度无效，无需（也不该）再写 `h-[96rpx]` 去强行对齐。
4. 涉及文件（改一处须全改）：`PickerSheet`、`DatePickerSheet`、`TimePickerSheet`、`TimeRangePicker`、`teacher/MonthPickerSheet`。

> 排查方式：`grep -rn 'indicatorStyle' src/` 确认所有命中都是 `px`，无一例 `rpx`。

---

## 十、交互复用铁律（ScrollView + 多入口同一能力）

**教训来源**：首页待办 FAB「切换视图」与工具栏 icon——工具栏正常，FAB 路径反复改 scroll 锁定仍跳顶。
**二次教训**：待办详情/添加弹窗「关层触发滚动条」——根因是误用 `scrollTop` 受控。

### 原则

1. **同一业务能力只保留一条已验证实现**（如 `handleTodoViewModeChange`），多入口复用，禁止 FAB 再写一套旁路。
2. **先确认哪条路径可用**，让其它入口串联到该路径，而非为坏路径叠 scroll hack。
3. **FAB + ScrollView**：沿用 `fabMenuExpanded` + `scrollTopPin` + `scrollY={!fabMenuExpanded}`；勿随意改成 ref-only 等半套方案。
4. **菜单内操作等价于页面按钮**：菜单先收起，短延迟后调用同一 handler（首页 `FAB_VIEW_TOGGLE_DELAY_MS` ≈ 220ms）。
5. **禁止**长期保留专用排查 `console.log` / 临时代码文件；问题解决后删除。正式本地调试走 `utils/local-debug.ts`。
6. **能复用就不扩代码**：每多一层无关 setState 都可能让微信 `ScrollView` 丢滚动位置。

### 固定蒙层弹窗 × ScrollView（硬性，三根因必须同时规避）

| # | 根因 | 正确做法 | 禁止 |
|---|------|----------|------|
| 1 | `scroll-into-view` **只要还绑着**（含 `""`），任意 setData 都可能回顶 | idle 用 `scrollIntoViewProps(id)` **完全解绑**；仅定位瞬间传入 | 长期绑 `scrollIntoView={x \|\| undefined}` / 空串 |
| 2 | 开蒙层 setState 可能让未受控列表丢位置；onScroll 缓存可能过期（ref=0→一点击回顶） | `freeze(() => open())`：先 `scrollOffset` 实测再开层；关层后 `unfreeze()` **延迟解绑** | 先 `setVisible` 再 freeze；关层 `top → top+0.01 → null` |
| 3 | 页面级滚动 / 弹层内 Input 插入推页 | 页配置 `disableScroll: true`；Input `adjustPosition={false}`；详情可推迟挂载 Input | 为弹层改 `scrollY`；用 `+0.01` 当「保位置」 |

**标准钩子**：`useOverlayScrollFreeze('#scroll-id')`（开层 `freeze(() => setVisible(true))`；关层 `unfreeze`；FAB 收起用 `unfreezeNow`）。

**FAB 菜单**（已验证）：`fabMenuExpanded` + freeze + `scrollY={!fabMenuExpanded}`，勿与蒙层方案拆成两套互相打架的 pin。

**根因总结**：点卡片跳顶 = idle 仍绑着 `scroll-into-view` + 开层 setData 丢位置；关层抖滚动条 = `+0.01` 解绑舞——两套「修复」互相制造问题。

### 首页待办 FAB 切换视图（标准写法）

```tsx
const handleTodoViewModeChange = useCallback((mode: TodoViewMode) => {
  setTodoViewMode(mode);
}, []);

const handleFabViewModeToggle = useCallback(() => {
  const next = todoViewModeRef.current === 'timeline' ? 'quadrant' : 'timeline';
  setTimeout(() => handleTodoViewModeChange(next), FAB_VIEW_TOGGLE_DELAY_MS);
}, [handleTodoViewModeChange]);
```

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
