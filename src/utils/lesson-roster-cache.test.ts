/**
 * 点名页名单内存快照单测
 *
 * 关键回归点：
 * 1. 同班同日短窗口内重进必须命中（这就是"点卡片进详情不再重复拉名单"的能力本体）；
 * 2. **写信号时间戳晚于快照 ⇒ 必须 miss**（否则会出现"改完学员/班级，再次进页仍是旧名单"）；
 * 3. 信号早于快照不算过期 —— 信号在归属页消费掉之前会一直挂着，只判"存在"会把缓存永久封死；
 * 4. key 含 userId/classId/lessonDate ⇒ 身份或日期变化不得复用同一份名单。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LESSON_ROSTER_TTL_MS,
  buildLessonRosterKey,
  clearLessonRosterCache,
  invalidateLessonRoster,
  readLessonRoster,
  writeLessonRoster,
  type LessonRosterSnapshot,
} from '@/utils/lesson-roster-cache';
import { REFRESH_SIGNAL, setRefreshSignal } from '@/utils/refresh-signal';

const taroStub = vi.hoisted(() => {
  const map = new Map<string, unknown>();
  return {
    map,
    getStorageSync: (k: string) => map.get(k),
    setStorageSync: (k: string, v: unknown) => {
      map.set(k, v);
    },
    removeStorageSync: (k: string) => {
      map.delete(k);
    },
  };
});

vi.mock('@tarojs/taro', () => ({ default: taroStub }));
vi.mock('@/utils/logger', () => ({ logError: vi.fn() }));

const snapshot: LessonRosterSnapshot = {
  classInfo: { id: 'class-1', name: '周一班' } as never,
  students: [{ id: 'stu-1', name: '小明' }] as never,
  makeupStudentIds: ['stu-9'],
};

const key = () =>
  buildLessonRosterKey({ userId: 'user-1', classId: 'class-1', lessonDate: '2026-09-28' });

describe('lesson-roster-cache', () => {
  beforeEach(() => {
    clearLessonRosterCache();
    taroStub.map.clear();
  });

  it('写入后可同步读到（短窗口内重进免网络）', () => {
    writeLessonRoster(key(), snapshot, 1_000);
    expect(readLessonRoster(key(), 1_000 + LESSON_ROSTER_TTL_MS - 1)).toEqual(snapshot);
  });

  it('超过 TTL 判 miss（并顺手清掉条目）', () => {
    writeLessonRoster(key(), snapshot, 1_000);
    expect(readLessonRoster(key(), 1_000 + LESSON_ROSTER_TTL_MS)).toBeNull();
    // 已过期条目被移除：即使时间回调到 TTL 内也不再命中
    expect(readLessonRoster(key(), 1_001)).toBeNull();
  });

  it('未写入过 / key 为空 ⇒ miss', () => {
    expect(readLessonRoster(key(), 1_000)).toBeNull();
    expect(readLessonRoster('', 1_000)).toBeNull();
  });

  it('写信号晚于快照 ⇒ miss（改完学员/班级后不得再复用旧名单）', () => {
    writeLessonRoster(key(), snapshot, 1_000);
    setRefreshSignal(REFRESH_SIGNAL.students);
    expect(readLessonRoster(key(), 1_001)).toBeNull();
  });

  it('排课/班级辅数据信号同样触发失效', () => {
    writeLessonRoster(key(), snapshot, 1_000);
    setRefreshSignal(REFRESH_SIGNAL.classes);
    expect(readLessonRoster(key(), 1_001)).toBeNull();

    clearLessonRosterCache();
    taroStub.map.clear();
    writeLessonRoster(key(), snapshot, 1_000);
    setRefreshSignal(REFRESH_SIGNAL.schedule);
    expect(readLessonRoster(key(), 1_001)).toBeNull();
  });

  it('信号早于快照 ⇒ 仍命中（陈旧信号不得永久封死缓存）', () => {
    setRefreshSignal(REFRESH_SIGNAL.students);
    const signalAt = Number(taroStub.map.get(REFRESH_SIGNAL.students));
    writeLessonRoster(key(), snapshot, signalAt + 1);
    expect(readLessonRoster(key(), signalAt + 2)).toEqual(snapshot);
  });

  it('peek 不消费信号：归属页仍能收到该信号', () => {
    setRefreshSignal(REFRESH_SIGNAL.schedule);
    writeLessonRoster(key(), snapshot, 1_000);
    readLessonRoster(key(), 1_001);
    expect(taroStub.map.has(REFRESH_SIGNAL.schedule)).toBe(true);
  });

  it('key 维度隔离：userId / classId / lessonDate / 本节时段 任一不同都不复用', () => {
    writeLessonRoster(key(), snapshot, 1_000);
    const otherUser = buildLessonRosterKey({
      userId: 'user-2',
      classId: 'class-1',
      lessonDate: '2026-09-28',
    });
    const otherClass = buildLessonRosterKey({
      userId: 'user-1',
      classId: 'class-2',
      lessonDate: '2026-09-28',
    });
    const otherDate = buildLessonRosterKey({
      userId: 'user-1',
      classId: 'class-1',
      lessonDate: '2026-09-29',
    });
    // 同班同一天的另一节课：名单里合并的补课学员不同，不能复用
    const otherStartTime = buildLessonRosterKey({
      userId: 'user-1',
      classId: 'class-1',
      lessonDate: '2026-09-28',
      startTime: '14:00',
    });
    [otherUser, otherClass, otherDate, otherStartTime].forEach((k) => {
      expect(readLessonRoster(k, 1_001)).toBeNull();
    });
  });

  it('清理过期条目时不得误伤仍有效的条目', () => {
    const other = buildLessonRosterKey({
      userId: 'user-1',
      classId: 'class-2',
      lessonDate: '2026-09-28',
    });
    writeLessonRoster(other, snapshot, 1_000);
    writeLessonRoster(key(), snapshot, 1_001);
    // 两个都在 TTL 内：互不影响
    expect(readLessonRoster(other, 1_002)).toEqual(snapshot);
    expect(readLessonRoster(key(), 1_002)).toEqual(snapshot);
  });

  it('invalidate 单条与整体清空', () => {
    writeLessonRoster(key(), snapshot, 1_000);
    invalidateLessonRoster(key());
    expect(readLessonRoster(key(), 1_001)).toBeNull();

    writeLessonRoster(key(), snapshot, 1_000);
    clearLessonRosterCache();
    expect(readLessonRoster(key(), 1_001)).toBeNull();
  });
});
