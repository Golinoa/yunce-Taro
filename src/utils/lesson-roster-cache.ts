/**
 * 点名页「班级名单快照」内存缓存（班级信息 + 学员名单 + 当日补课学员）
 *
 * 为什么需要：小程序每次 `navigateTo` 进点名页都是**全新页面实例**，页面内的 `useRef` 守卫
 * 随实例销毁 ⇒ 从课表卡片点进详情必然重打 `classService.getById` + `getStudents` +
 * `makeupBooking.getByClassDate`（外加每个补课学员一次 `studentById`）。同一班级反复进出
 * 会把同一份名单拉很多遍，用户观感就是「每次都要等、没复用缓存」。本模块用**模块级内存**
 * 快照（跨页面实例存活）让短窗口内重进直接复用：立即渲染，且不再打这一组请求。
 *
 * 边界（都很关键）：
 * - **只缓存"慢变"部分**：班级信息 + 学员名单 + 当日补课学员。
 *   **点名记录 / 会员卡 / 科目 / 请假审批不进缓存** —— `LessonRecord` 与
 *   「学员课时/会员卡」属资损域（见
 *   `docs/diagnostics/2026-09-19-frontend-cache-layer-plan.md` §1.1 D1），仍每次直拉。
 * - **不落盘**：学员/班级列表按计划 §10.4 维持不持久化，本缓存只活在 JS 运行时内，
 *   运行时结束即消失；另有 `LESSON_ROSTER_TTL_MS` 自然过期兜底。
 * - **写后失效**：读取前用 `peekRefreshSignal` 比对 `students` / `classes` / `schedule`
 *   三个信号的时间戳 —— 信号晚于快照写入时间即判 miss。用 `peek`（非消费）是为了不
 *   抢占课表页 / 课程管理页对这些信号的消费权。
 * - **身份隔离**：key 含 userId，且切机构 / 切身份 / 登出时由 `resetDomainCaches`
 *   调 `clearLessonRosterCache()` 整体清空（G3）。
 */
import type { Class } from '@/types/class';
import type { Student } from '@/types/student';
import { TTL } from '@/utils/data-freshness';
import { REFRESH_SIGNAL, peekRefreshSignal } from '@/utils/refresh-signal';
import { normalizeLessonStartTime } from '@/utils/schedule-card-build';

/**
 * 有效期取 **L1 Tab 短鲜窗口（60s）**：点名页偏履约场景，宁可短一点；
 * 跨过 TTL 就走网络，写后失效另由信号时间戳兜底。
 */
export const LESSON_ROSTER_TTL_MS = TTL.tab;

export interface LessonRosterSnapshot {
  /** 班级信息；班级不存在 / 拉取失败为 null */
  classInfo: Class | null;
  /** 正式学员 + 当日已确认补课学员（已合并，顺序即展示顺序） */
  students: Student[];
  /** 当日补课学员 id（用于卡片标记与「补课」标识） */
  makeupStudentIds: string[];
}

export interface LessonRosterKeyParts {
  /** 当前登录用户 id —— 与后端 `req.user.userId` 对应，用于身份维度隔离 */
  userId?: string | null;
  classId: string;
  /** 上课日期（页面按天点名，同班不同天不能互用名单） */
  lessonDate: string;
  /**
   * 本节开始时段。同班同一天可能排多节课（如 09:00 与 14:00），
   * 名单里合并的是「本节」的补课学员 ⇒ 同天不同节也不能互用名单。
   */
  startTime?: string | null;
}

/** 影响"名单是否可信"的写信号：学员增删改 / 班级辅数据 / 排课（含补课预约） */
const ROSTER_WRITE_SIGNALS = [
  REFRESH_SIGNAL.students,
  REFRESH_SIGNAL.classes,
  REFRESH_SIGNAL.schedule,
];

type CacheEntry = { at: number; data: LessonRosterSnapshot };

/** 模块级内存快照：key → 数据 + 写入时间 */
const store = new Map<string, CacheEntry>();

export function buildLessonRosterKey(parts: LessonRosterKeyParts): string {
  const startTime = normalizeLessonStartTime(parts.startTime);
  return `${parts.userId || '-'}|${parts.classId}|${parts.lessonDate}|${startTime}`;
}

/**
 * 快照写入时间是否早于某次相关写操作。
 * 注意这里比对的是**时间戳**而非"信号是否存在"：信号在归属页消费掉之前会一直挂着，
 * 只判存在会让缓存被一个陈旧信号永久封死。
 */
function isStaleByWriteSignal(snapshotAt: number): boolean {
  return ROSTER_WRITE_SIGNALS.some((key) => {
    const signalAt = peekRefreshSignal(key);
    return signalAt !== null && signalAt > snapshotAt;
  });
}

/** 同步读快照；未命中 / 已过期 / 期间有写操作均返回 null（调用方回源） */
export function readLessonRoster(
  key: string,
  nowMs: number = Date.now(),
): LessonRosterSnapshot | null {
  if (!key) return null;
  const entry = store.get(key);
  if (!entry) return null;
  if (nowMs - entry.at >= LESSON_ROSTER_TTL_MS) {
    store.delete(key);
    return null;
  }
  if (isStaleByWriteSignal(entry.at)) return null;
  return entry.data;
}

/** 回源成功后写入快照 */
export function writeLessonRoster(
  key: string,
  snapshot: LessonRosterSnapshot,
  atMs: number = Date.now(),
): void {
  if (!key) return;
  // 顺手清理已过期条目：Map 只在"被读到"时惰性删除，而切班/改日期会留下不再访问的旧 key，
  // 不清理会在长会话里持续堆积。
  store.forEach((entry, entryKey) => {
    if (atMs - entry.at >= LESSON_ROSTER_TTL_MS) {
      store.delete(entryKey);
    }
  });
  store.set(key, { at: atMs, data: snapshot });
}

/** 失效单条；不传 key 清空全部（点名页自有写操作后可调） */
export function invalidateLessonRoster(key?: string): void {
  if (key) {
    store.delete(key);
    return;
  }
  store.clear();
}

/** 切机构 / 切身份 / 登出：整体清空（由 `resetDomainCaches` 调用） */
export function clearLessonRosterCache(): void {
  store.clear();
}
