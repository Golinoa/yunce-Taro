# FE-B3 报告：学员列表 N+1 与同参数重复 GET（FE-14 / FE-13）

- 范围：**仅前端** `D:\Coding\yunce\yunceTaro`（未触碰 `yunce-back`）
- 批次：FE-14（班级详情页学员列表慢 + 无加载态）、FE-13（同参数重复 GET 真去重）
- 附：campusId 线索核实（**只查不改**）

---

## 一、FE-14：班级详情页「学员列表」慢 + 无加载态

### 1.1 真实根因（以实际代码为准）

页面链路（由课表课程卡片进入，`action=supplement` 补录 / 直接点名）：
`src/package-course/pages/lesson-form/index.tsx` → `use-lesson-form-loaders.ts` → `lesson-attendance-load.ts`。

**根因 A：同一批学员的课包被重复拉了两遍（一次「默认补包」，一次「活跃课包」）**

`src/services/class.ts:252-264`：

```ts
  getStudents: async (
    classId: string,
    options: { includePackages?: boolean } = {},
  ): Promise<Student[]> => {
    const includePackages = options.includePackages !== false;   // ← 默认 true
    const withPackages = async (base: Student[]): Promise<Student[]> => {
      if (!includePackages) return base;
      if (base.length === 0) return base;
      return Promise.all(
        base.map(async (student) => {
          if (student.course_packages && student.course_packages.length > 0) return student;
          try {
            const packages = await packageService.getByStudent(student.id);   // ← :264 每学员一次
```

而点名页在拿到 `students` 之后，**又**调用 `loadPackageMapsForStudents()` 给每个学员拉一次活跃课包
（`use-lesson-form-loaders.ts:347` 与 `:499` 传的是默认参数）：

```ts
// use-lesson-form-loaders.ts:345-348（初始化路径）
const [classInfo, formalStudents] = await Promise.all([
  classService.getById(classIdParam),
  classService.getStudents(classIdParam),        // ← 默认 includePackages=true
]);
...
// use-lesson-form-loaders.ts:403
const { packages, subjects } = await loadPackageMapsForStudents(students, hoursUsed);
```

→ 同一批学员：`/course-packages?studentId=` 与 `/course-packages/active?studentId=` 各来一遍。

**根因 B：`loadPackageMapsForStudents` 是 `for` + `await` 串行**

`src/package-course/pages/lesson-form/lesson-attendance-load.ts:160-175`（改动前）：

```ts
for (const student of students) {
  const pkgs = await packageService.getActiveByStudent(student.id); // ← :163 串行，RTT 线性累加
  const best = pickBestPackage(pkgs, hoursUsed);
  if (!best) continue;
  packages.set(student.id, best);
  if (best.subject_id) {
    const sub = await subjectService.getById(best.subject_id); // ← :168 串行，且同科重复查
    subjects.set(student.id, sub);
  } else {
    subjects.set(student.id, null);
  }
}
```

同一个班的学员通常同属 1～2 个学科，但原实现**按学员逐个** `GET /subjects/{id}`，同一学科被重复拉 N 次。

**根因 C：`lesson-form/` 目录无任何 loading/骨架态**（全目录仅有 `uploading`，属图片上传）。
列表为空时直接落到 `ClassLessonPanel.tsx:389-395` 的「暂无匹配学员」，首次进入或切班期间会被误读为「这个班没学员」。

> 与任务书的差异（已按实际代码为准，未硬改）：
>
> 1. 任务书写的 `src/utils/lesson-attendance-load.ts:162-163`，实际路径是
>    `src/package-course/pages/lesson-form/lesson-attendance-load.ts:162-163`（`src/utils/` 下无此文件）。
> 2. `class.ts` 的 N+1 是**条件性**的：`:262` 有 `if (student.course_packages?.length) return student;` 提前返回。
>    只有当 `/classes/{id}/students` 未返回可用 `remainingHours` 时，才会对每个学员补发一次 `getByStudent`。
>    即 `includePackages=true` 是**隐患**，是否爆量取决于后端是否回该字段（见 1.4 不确定项）。

### 1.2 改了什么、为什么

| 文件                                                                                  | 改动                                                                                                                                                  | 为什么                                                                                                    |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/package-course/pages/lesson-form/use-lesson-form-loaders.ts:345-348`、`:497-500` | 两处 `classService.getStudents(classId)` → `{ includePackages: false }`                                                                               | 课包本来就由紧随其后的 `loadPackageMapsForStudents` 权威获取；关掉默认补包，**彻底消除重复的那 N 个请求** |
| `src/package-course/pages/lesson-form/lesson-attendance-load.ts:153-222`              | `for` 串行 → `mapWithConcurrency(students, 6, ...)`；学科按 **distinct subject_id** 去重后并发查                                                      | 消除串行 RTT 累加；同学科不再重复拉（`PACKAGE_LOAD_CONCURRENCY = 6` 上限，避免打爆后端）                  |
| `use-lesson-form-loaders.ts` + `index.tsx` + `ClassLessonPanel.tsx`                   | 新增 `classStudentsLoading` 状态；初始化与 `loadClassStudents` 用 `try/finally` 置位；面板在**列表为空且加载中**时渲染既有 `<Loading size="small" />` | 补加载态（复用 `src/components/Loading`，未新造组件）；列表非空时保持原样，不改交互与信息结构             |

**结果一致性保证**：`loadPackageMapsForStudents` 的返回值语义逐条对齐原实现——无最优课包的学员 **不进** `packages`/`subjects`；有课包但无 `subject_id` 的学员 `subjects` 落 `null`；有学科的学员拿到同一个 `Subject` 对象（学科对象为只读展示，跨学员共享不产生副作用）。

**展示未变**：学员卡片剩余课时/课程名来自 `studentPackages` / `studentSubjects` 两个 Map
（`use-lesson-form-helpers.ts:222-240`），**不读** `student.course_packages`。
全仓唯一读 `student.course_packages` 的是 `src/components/lesson/StudentCheckinList/index.tsx:43`，
而该组件**全仓无任何引用**（死代码）。故 `includePackages: false` 不改变任何展示内容。

**样式合规**：新增 UI 只有 `<Loading size="small" />`（既有组件，内部全部 UnoCSS 原子类 + 设计 Token）；无 SCSS、无内联 style、无 px/rem。

### 1.3 改造前后请求量对比（静态推断）

记号：`N` = 班级学员数（含补课学员），`S` = 有最优课包的学员中**不同学科数**，`K` = 因缺 `remainingHours` 而被 `withPackages` 补包的学员数。

|        | 请求                                                                                                                                                                                 | 并发性                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| 改造前 | `1`（`/classes/{id}/students`）+ `K`（`/course-packages?studentId=`，Promise.all 无上限）+ `N`（`/course-packages/active?studentId=`，**串行**）+ `≤N`（`/subjects/{id}`，**串行**） | 尾段 N+≤N 全部串行     |
| 改造后 | `1` + `0`（`K=0`，不再补包）+ `N`（active，**并发 ≤6**）+ `S`（`/subjects/{id}`，**并发 ≤6**、已去重）                                                                               | 全程并发有界，无串行尾 |

净减少 = `K + (N - S)` 个请求，且消除 `N + ≤N` 次串行 RTT。

典型估算（N=20、全班同属 1 个学科、后端未回 `remainingHours` 即 K=20）：
`1+20+20+20 = 61` → `1+20+1 = 22`，**约 -64% 请求**，且串行尾段（40 次逐个等待）归零。

实测：**未做真机请求数抓包**（无法安全注入代理而不影响用户环境），以上为按代码路径的静态推断；
并发上限与学科去重已由单测确证（见 1.4）。

### 1.4 验证证据（FE-14 相关）

新增定向用例 `src/package-course/pages/lesson-form/lesson-attendance-load.test.ts`：

- 同学科 3 个学员 → `packageService.getActiveByStudent` 调 3 次、`subjectService.getById` **只调 1 次**，且 `packages/subjects` 内容与逐学员查询一致；
- 无课包学员不进 map、有课包无学科 → `subjects` 落 `null`、`getById` 零调用；
- 10 个学员时**实测并发峰值 `>1` 且 `≤6`**（证明"改并发"且"有上限"）；
- 空学员列表零请求。

真实输出见第三节。

### 1.5 未覆盖 / 待确认

- `src/package-course/pages/lesson-supplement/index.tsx:122` + `:153` 存在**同构**的 N+1（`getStudents` 默认补包 + `for` 循环 `getActiveByStudent`），属**其它页面**，按"不动其它页面"约束未改。
- `src/services/class.ts:334 getStudentCount` 内部调用 `getStudents(classId)`（默认补包）。该函数全仓无引用（死代码），未改。
- 任务书症状描述为"学员列表慢"，但 `ClassLessonPanel` 的列表渲染本身是同步 map，**慢来自请求串行 + 重复**，不是渲染。

---

## 二、FE-13：同参数重复 GET 真去重

### 2.1 真实根因

`src/utils/request.ts:260-274`（改动前）：

```ts
/** 开发环境重复 GET 告警（1s 窗口） */
const recentGetHits = new Map<string, number>();
function warnDuplicateGet(url: string): void {
  const now = Date.now();
  const prev = recentGetHits.get(url) || 0;
  if (prev && now - prev < 1000) {
    // eslint-disable-next-line no-console
    console.warn(`[request-dedup] duplicate GET within 1s: ${url}`);   // ← 只告警，请求照发
  }
  recentGetHits.set(url, now);
  ...
```

且 `:282-288` 的调用条件还要求 `NODE_ENV !== 'production' && TARO_ENABLE_LOCAL_DEBUG === 'true'` —— 生产环境连告警都没有。
`attendance/reschedules`、`lesson-records/by-range` 这类被多个 `useEffect`/`useDidShow` 同时触发的只读接口，
同参数请求每次都真的打到后端。

### 2.2 改了什么、为什么

`src/utils/request.ts`：

```ts
export async function request<T = unknown>(options: RequestOptions): Promise<T> {
  if ((options.method ?? 'GET') === 'GET') {
    const key = buildGetDedupeKey(options.url, options.data, options.skipAuth === true);
    return singleFlight(key, () => performRequest<T>(options));
  }
  return performRequest<T>(options);
}
```

- **只 GET**：`PUT/POST/PATCH/DELETE` 直接走 `performRequest`，不去重（写方法重复发 = 幂等性风险）。
- **键 = method + url + 排序后的 query + skipAuth 标记**：`buildGetDedupeKey` 对 query key 排序，避免
  `{page,pageSize}` 与 `{pageSize,page}` 这类同参数不同书写顺序漏去重。
- **复用既有并发去重基建** `src/utils/single-flight.ts`（仓库已有、且已有 `organization/permission/teacher` 三处在用）。
  其契约与本任务边界完全吻合：**只合并并发，响应返回即从飞行表移除，不缓存跨页面长期结果**。
- **失败不驻留**：`single-flight.ts:22-24` 用 `promise.finally` 清理飞行态，失败同样立即释放 →
  后续重试照常发请求，不会拿到被缓存住的失败结果。
- 删除了 `warnDuplicateGet` / `recentGetHits`（升级后即死代码），并去掉那层 `NODE_ENV/TARO_ENABLE_LOCAL_DEBUG` 门禁
  —— 去重是生产收益，不应只在本地调试时生效。
- **未触碰** refresh / 认证 / 429 退避逻辑，只是把原函数体整体改名为 `performRequest`，`request` 变为分流入口。

**语义影响说明**：并发同参请求现在会拿到**同一个结果对象引用**（原先各拿一份）。这是任务书允许的
「复用同一个 in-flight Promise（或返回同一结果）」；被合并的都是"同一瞬间的重复只读请求"。

**窗口口径说明（重要）**：本实现是**严格 in-flight 合并**（重叠即合并，settle 即释放），
不是"settle 后再保鲜 N 秒"。这与仓库既有约定一致（`single-flight.ts:8-9` 注释：
"数据新鲜度仍由 utils/data-freshness.ts 的 TTL 控制——响应返回即从表中移除"），也符合任务书
"不得缓存跨页面的长期结果（这不是引入全局缓存，只是把'同一瞬间的重复请求'合并）"。
**残留边界**：若 3 次同参请求是**严格串行、彼此不重叠**（前一次已返回后才发下一次），本实现不会合并它们。
按现有告警日志（1s 内 3 次）判断其大概率来自并发触发（多个 effect / useDidShow 竞态），可被合并；
若现场确认是严格串行触发，需要另立需求（页面层去抖或引入短 TTL），本次未擅自引入结果缓存。

### 2.3 改造前后对比

| 场景                                           | 改造前                                             | 改造后                           |
| ---------------------------------------------- | -------------------------------------------------- | -------------------------------- |
| 3 个同参 GET 并发（`/attendance/reschedules`） | 3 次网络请求（+1 条 console.warn，且仅本地调试态） | **1 次**网络请求（单测实测）     |
| 同参但 query 书写顺序不同                      | 视为不同请求，照发                                 | 排序后同一键，合并               |
| 参数不同                                       | 2 次                                               | 2 次（单测实测不去重）           |
| POST 同参                                      | 2 次                                               | 2 次（单测实测不去重）           |
| 并发失败后重试                                 | 1 + 1 次                                           | 1 + 1 次（单测实测：失败不驻留） |

### 2.4 验证证据（FE-13 相关）

`src/utils/request.test.ts` 新增 `request GET 同参数 in-flight 去重` 共 4 例，全部通过（真实输出见第三节）。

---

## 三、campusId 线索核实结论（**只查不改**）

**结论：线索成立。`roomService.add` 构造请求体时丢掉了调用方明明传进来了的 `campusId`，
而场地列表按 `campusId` 过滤 → 新场地落库后无法被列表命中，于是"保存成功但不出现"。**

证据链（全部为现有代码，未做任何修改）：

1. 调用方**传了** `campusId` —— `src/package-settings/pages/venue-form/index.tsx:132-137`：

```ts
      const payload = {
        venueId: venue.id,
        campusId: currentCampus.id,     // ← 有
        name: form.name.trim(),
        capacity: form.capacity ? Number(form.capacity) : undefined,
        status: form.status,
      };
      ...
        await roomService.add(payload);
```

2. 写入体的"正规"构造函数**支持** `campusId` —— `src/services/campus.ts:457-467`：

```ts
export function buildRoomWriteBody(
  data: Partial<RoomFormData> & { venueId?: string; campusId?: string; name?: string },
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (data.venueId !== undefined) body.venueId = data.venueId;
  if (data.campusId !== undefined) body.campusId = data.campusId;   // ← :462 支持
  ...
```

3. 但 `roomService.add` **没有把 `body` 整体发出**，而是手写字段清单，`campusId` 被丢弃 —— `src/services/campus.ts:515-522`：

```ts
  add: async (data: RoomFormData): Promise<Room> => {
    const body = buildRoomWriteBody(data);          // ← :516 算出来了
    const raw = await post<Record<string, unknown>>('/venues/rooms', {
      venueId: body.venueId,
      name: body.name,
      capacity: body.capacity ?? 20,
      status: body.status === 'inactive' ? 'INACTIVE' : 'ACTIVE',
    });                                             // ← :517-522 无 campusId
```

4. 列表按 `campusId` 过滤 —— `src/services/campus.ts:470-475`：

```ts
  getList: async (options?: { campusId?: string; venueId?: string }): Promise<Room[]> => {
    const data = await get<unknown>('/venues/rooms', {
      page: 1,
      pageSize: 100,
      ...(options?.venueId ? { venueId: options.venueId } : {}),
      ...(options?.campusId ? { campusId: options.campusId } : {}),   // ← :475 按校区过滤
```

5. 列表页正是按当前校区过滤 —— `src/package-settings/pages/venue-list/index.tsx:46`：

```ts
const list = await roomService.getList({ campusId: currentCampusId || undefined });
```

6. "保存成功"的假象来源：`add` 的**返回对象**用本地入参回填 `campusId`（`src/services/campus.ts:526`：`campusId: data.campusId,`），
   所以前端内存里这条记录看起来是对的，返回列表页重新按 `campusId` 拉取后它就消失了。

**附带观察（同类问题，同样未改）**：`roomService.update`（`src/services/campus.ts:532-543`）同样用 `buildRoomWriteBody` 后只挑
`name/capacity/status` 发出，**也不带 `campusId`**；只是 `update` 不影响"能否被列表命中"，故不是本次症状的成因。

**处置建议（需产品/后端确认口径，本次未改）**：
把 `add` 的请求体改为 `post('/venues/rooms', body)`（或显式补 `campusId: body.campusId`）即可；
但"场地是否必须挂校区""后端 `/venues/rooms` 是否接受并持久化 `campusId`"属于接口契约口径，需确认后再改。

---

## 四、验证证据（实际命令 + 真实输出）

全部在 `D:\Coding\yunce\yunceTaro` 下执行（Windows 宿主，`npm run` 不注入 `node_modules/.bin`，故直调二进制）。

### 4.1 TypeScript

```
$ node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
(无输出)
TSC_EXIT=0
```

### 4.2 ESLint（改动文件）

```
$ node ./node_modules/eslint/bin/eslint.js src/utils/request.ts src/utils/request.test.ts \
    src/package-course/pages/lesson-form/lesson-attendance-load.ts \
    src/package-course/pages/lesson-form/lesson-attendance-load.test.ts \
    src/package-course/pages/lesson-form/use-lesson-form-loaders.ts \
    src/package-course/pages/lesson-form/index.tsx \
    src/package-course/pages/lesson-form/ClassLessonPanel.tsx
(无输出)
ESLINT_EXIT=0
```

### 4.3 Prettier（改动文件）

```
$ node ./node_modules/prettier/bin/prettier.cjs --check <同上 7 个文件>
Checking formatting...
All matched files use Prettier code style!
PRETTIER_EXIT=0
```

### 4.4 定向 vitest（**只跑定向用例，未跑全量**）

```
$ node ./node_modules/vitest/vitest.mjs run \
    src/package-course/pages/lesson-form/lesson-attendance-load.test.ts \
    src/utils/request.test.ts src/utils/single-flight.test.ts --reporter=basic

 RUN  v2.1.9 D:/Coding/yunce/yunceTaro

 ✓ src/utils/single-flight.test.ts (6 tests) 54ms
 ✓ src/package-course/pages/lesson-form/lesson-attendance-load.test.ts (13 tests) 41ms
 ✓ src/utils/request.test.ts (5 tests) 131ms

 Test Files  3 passed (3)
      Tests  24 passed (24)
   Duration  3.55s
```

> 说明：本机 vitest 可正常运行（此前"缺 optional dep 起不来"的经验本次未复现），单个文件约 2～4s。

### 4.5 未执行的验证

- **未做真机/小程序端请求数抓包**，1.3 的请求量对比为静态推断（依据：`class.ts:252-332`、`use-lesson-form-loaders.ts:345-348/403/497-500/576`、`lesson-attendance-load.ts:153-222` 的逐跳代码路径）。
- **未跑全量测试**（任务书要求定向）。
- **未跑 `npm run build`**（本批无构建产物变更，且构建耗时长）。

---

## 五、改动文件清单

```
src/utils/request.ts
src/utils/request.test.ts
src/package-course/pages/lesson-form/lesson-attendance-load.ts
src/package-course/pages/lesson-form/lesson-attendance-load.test.ts
src/package-course/pages/lesson-form/use-lesson-form-loaders.ts
src/package-course/pages/lesson-form/index.tsx
src/package-course/pages/lesson-form/ClassLessonPanel.tsx
```

（以上 7 个源文件已 `git add` 进暂存区，等待 refs 恢复后提交；本报告 `docs/diagnostics/FE-B3-REPORT.md` 按任务书要求**不提交**。）

---

## 六、commit 状态：**未能创建（仓库级故障，已上报，未擅自修 .git）**

### 6.1 事实

改动已全部暂存（`git add` 成功，`git diff --cached --name-only` 见下），但 `git commit` 在 **pre-commit 钩子**处失败：

```
$ git commit -m "perf(course): 消除学员卡包 N+1 与同参数重复请求，补学员列表加载态"
'lint-staged' 不是内部或外部命令，也不是可运行的程序
或批处理文件。
husky - pre-commit script failed (code 1)
```

原因 1（钩子不可用，与任务书预告一致）：`.husky/pre-commit` 内容为 `npx lint-staged`，
本机 shell 的 PATH 不含 `node_modules/.bin`，`npx` 无法解析 `lint-staged`。
直接调 `node ./node_modules/lint-staged/bin/lint-staged.js` 亦失败（`[STARTED] Backing up original state...` 后 exit 1），
说明钩子在本沙箱**确实不可用**，不是偶发。

原因 2（**阻塞项**）：紧接着发现仓库变成不可读——

```
$ git rev-parse HEAD
fatal: not a git repository (or any of the parent directories): .git
$ ls .git/refs
ls: cannot access '.git/refs': No such file or directory
```

只读排查结论（**未做任何 .git 修改动作**）：

| 检查                                                      | 结果                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `.git/HEAD`                                               | 存在，内容 `ref: refs/heads/main`                                                                                        |
| `.git/refs/`                                              | **整个目录缺失**（`heads/`、`remotes/` 都没了）                                                                          |
| `.git/packed-refs`                                        | 只剩 `refs/remotes/origin/main = 43b80f8`（旧的远端快照），**没有 `refs/heads/main`**                                    |
| `.git/objects/pack/*.pack`                                | 正常，27.5 MB；`git verify-pack` 统计 **244 个 commit**（对象库完好，**不是**"对象被清空"型损坏）                        |
| `.git/logs/refs/heads/main`                               | 完好，最后一条 new-value = `55b8f0c58fcb5f9e299e8f8654b16a1d319f8ad7`（与故障前 `git log --oneline -1` 打印的 tip 一致） |
| `D:/Coding/yunce/_recover_yunceTaro/.git/refs/heads/main` | 内容 `55b8f0c58fcb5f9e299e8f8654b16a1d319f8ad7`（**第二处独立佐证**）                                                    |

即：**这是本机沙箱把 `.git/refs` 目录当删除操作隔离的已知环境缺陷**
（团队 skill `gitee-git-push-fix` 第八节/第一节均有记载：「沙箱把 git ref 事务（lockfile rename）当删除操作，
隔离 `.git/refs/remotes/origin/` 目录」；第六节专列「status 报 not a git repository、refs 目录缺失」的处置）。
**本次故障不是代码改动造成的，也不是我执行任何 `.git` 修复动作造成的。**

### 6.2 我的处置（**未触碰 .git**）

任务书第三/五节明令：「绝对禁止任何 `.git` 级操作：……不要手写 refs……违反即失败」。
因此我**没有**执行任何 ref 重建动作，而是**上报 team-lead 请求授权**。当前状态：

- 工作区代码改动**完好无损**（已逐个核对 7 个源文件 + 本报告的存在与 mtime，见第五节；`src/` 共 918 个文件，无缺失迹象；
  仓库内无 `lint-staged_*.patch` 残留）。特别提示：skill 第七节警告「`.git` 损坏状态下触发 commit → lint-staged 会删工作树文件」
  ⇒ **在 refs 修复前，任何人都不应对本仓库执行 `git commit`**，否则可能把仓库变成一个"无历史根提交"并连带丢文件。
- 唯一缺失的产物就是那个 commit。

### 6.3 待授权的恢复方案（**最小、非破坏性**，等 team-lead 一句话即可执行）

`.git/refs/heads/main` 的值有**两处独立佐证**（reflog + 恢复点快照），均为 `55b8f0c…`：

```bash
mkdir -p .git/refs/heads
printf '55b8f0c58fcb5f9e299e8f8654b16a1d319f8ad7\n' > .git/refs/heads/main
```

（团队 skill 第三/六节明确：本沙箱下 `git update-ref` 会走同一事务机制再次被隔离，
**只能直接写 ref 文件**。该操作不写对象、不删对象、不改历史。）

恢复后即可 `git commit`（预计提交后 `refs/heads/main` 可能再次被隔离，需按同样方式写回一次，
值改为新提交的 sha，用 `git rev-parse HEAD` 取）。

> 备选恢复源：`gitee-git-push-fix` 第六节的 bundle 重建流程（`D:/Coding/yunce/_backup/pre-fix-*/taro.bundle` 存在，
> 但那是 2026-09-11 的旧快照，**不推荐**——会让丢弃 09-11 之后的提交，代价远大于直接写 ref 文件）。

### 6.4 恢复后将被执行的提交命令（**不含 `git add -A` / `git add .`**）

```
$ git diff --cached --name-only
src/package-course/pages/lesson-form/ClassLessonPanel.tsx
src/package-course/pages/lesson-form/index.tsx
src/package-course/pages/lesson-form/lesson-attendance-load.test.ts
src/package-course/pages/lesson-form/lesson-attendance-load.ts
src/package-course/pages/lesson-form/use-lesson-form-loaders.ts
src/utils/request.test.ts
src/utils/request.ts

$ git commit -m "perf(course): 消除学员卡包 N+1 与同参数重复请求，补学员列表加载态"
```

**commit sha：待生成**（当前无法生成；`git log -1 --stat` 输出在恢复提交后回填）。

---

## 六·补、pre-commit 钩子不可用 → 已手动执行等价校验

钩子声明（`package.json` → `lint-staged`）：`*.{ts,tsx}` → `eslint --fix` + `prettier --write`。
等价手动执行（仅对我改动的 7 个文件）：

```
$ node ./node_modules/eslint/bin/eslint.js --fix <7 个文件>
EXIT=0

$ node ./node_modules/prettier/bin/prettier.cjs --write <7 个文件>
src/utils/request.ts 115ms (unchanged)
src/utils/request.test.ts 21ms (unchanged)
src/package-course/pages/lesson-form/lesson-attendance-load.ts 27ms (unchanged)
src/package-course/pages/lesson-form/lesson-attendance-load.test.ts 28ms (unchanged)
src/package-course/pages/lesson-form/use-lesson-form-loaders.ts 34ms (unchanged)
src/package-course/pages/lesson-form/index.tsx 51ms (unchanged)
src/package-course/pages/lesson-form/ClassLessonPanel.tsx 23ms (unchanged)
EXIT=0
```

全部 `unchanged` ⇒ 我暂存的内容与钩子清洗后的内容**完全一致**，钩子即便可用也不会产生额外改动。
再加上第四节 4.1/4.2/4.3 的 tsc / eslint / prettier 全绿，**是否使用 `--no-verify`** 的结论见第七节第 6 条。

---

## 七、未完成项 / 不确定项

1. **FE-14 实测请求数未做**：受环境限制只做了静态推断 + 单测证明并发上限与学科去重。若需要硬数字，请在真机 DevTools Network 面板按同一班级对比。
2. **FE-13 的窗口口径**：采用**严格 in-flight 合并**（settle 即释放），未引入 settle 后的短期结果缓存。若现场确认那 3 次同参请求是**严格串行不重叠**的，则本改动不覆盖该场景，需要另立需求（页面层去抖 / 短 TTL），本次不擅自加结果缓存以免引入陈旧数据。
3. **`class.ts` 的 N+1 是条件性的**：`getStudents` 默认 `includePackages=true` 只在后端未回 `remainingHours` 时才真正对每个学员补发请求；本次在点名页显式关掉，行为已确定不再依赖后端字段。
4. **同构 N+1 未修**（按"不动其它页面"约束）：`lesson-supplement/index.tsx:122/153`、`class.ts:334 getStudentCount`（死代码）。
5. **campusId 只查未改**：结论已给出，修复涉及后端契约口径，需用户确认后再动。
6. **`--no-verify`**：**当前尚未产生任何 commit，因此也还没有真正使用过 `--no-verify`**。
   钩子在本沙箱**不可用**（`npx lint-staged` → `'lint-staged' 不是内部或外部命令`，直接 `node lint-staged.js` 亦 exit 1），
   原因与证据见第六·补节；我已按钩子声明手动执行 `eslint --fix` + `prettier --write`（输出全 `unchanged`）并额外跑通
   tsc / eslint / prettier --check / 定向 vitest（第四、六·补节，全绿）。
   恢复 refs 后的实际提交**计划使用 `--no-verify`**，并在提交时显著标注该事实，原因即上述钩子不可用（非绕过校验）。
7. **仓库级阻塞（最高优先级）**：`git commit` 无法创建 —— `.git/refs/` 目录被本机沙箱隔离，仓库报
   `fatal: not a git repository`。**未擅自执行任何 `.git` 修复动作**（任务书明令禁止"手写 refs"），已上报 team-lead 待授权。
   详情与最小恢复方案见第六节。**请勿在 refs 修复前对本仓库执行 `git commit`**（团队 skill 第七节：会触发 lint-staged 删工作树文件）。
8. **本报告未纳入 git**：任务书要求"工作区现有的未跟踪文档（`docs/diagnostics/*.md`）不要提交"，
   本报告属同类未跟踪诊断文档，故**只作为工作区可见产物交付，未 `git add`**。如需入库请指示。
