/**
 * 课表派生纯逻辑单测：Tab 生成、班级/排课过滤、日历红点
 */
import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import type { Class } from '@/types/class';
import type { CourseCategoryConfig } from '@/types/course-category';
import type { Schedule } from '@/types/schedule';
import type { TemporaryReschedule } from '@/types/temporary-reschedule';
import {
  buildScheduleTabs,
  filterClassesForTab,
  filterSchedulesForTab,
  resolveActiveCategoryIds,
  resolveDateDotType,
  resolveOpenDateDotType,
  type ScheduleTabItem,
} from './schedule-derived-logic';

const NOW = dayjs('2026-09-01T10:00:00');

function makeCategory(
  overrides: Partial<CourseCategoryConfig> & Pick<CourseCategoryConfig, 'id' | 'name' | 'mode'>,
): CourseCategoryConfig {
  return {
    sortOrder: 1,
    minOpenCount: 1,
    bookingDeadline: 'unlimited',
    cancelQueueTime: 'unlimited',
    nonCancelTime: 'unlimited',
    autoCheckin: 'off',
    studentSelfCheckin: false,
    distanceLimit: false,
    checkinBeforeMinutes: 30,
    checkinAfterMinutes: 30,
    independentDisplay: false,
    isSystem: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

function makeClass(overrides: Partial<Class> & Pick<Class, 'id' | 'name'>): Class {
  return {
    teacher_id: 't1',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    type: 'unlimited',
    status: 'active',
    used_lessons: 0,
    color: 'primary',
    student_count: 0,
    ...overrides,
  };
}

function makeSchedule(overrides: Partial<Schedule> & Pick<Schedule, 'id'>): Schedule {
  return {
    teacher_id: 't1',
    day_of_week: 1,
    start_time: '09:00',
    end_time: '10:00',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

describe('buildScheduleTabs', () => {
  it('生成基础模式 Tab 并按 sortOrder 排序', () => {
    const categories: CourseCategoryConfig[] = [
      makeCategory({ id: 'c-class', name: '班课', mode: 'class', sortOrder: 1, isSystem: true }),
      makeCategory({ id: 'c-group', name: '团课', mode: 'group', sortOrder: 2, isSystem: true }),
    ];
    const tabs = buildScheduleTabs(categories, false);
    expect(tabs.map((t) => t.key)).toEqual(['mode-class', 'mode-group']);
    expect(tabs[0].label).toBe('班课');
  });

  it('venueBookingEnabled 时追加场地 Tab', () => {
    const categories = [
      makeCategory({ id: 'c-class', name: '班课', mode: 'class', sortOrder: 1, isSystem: true }),
    ];
    const tabs = buildScheduleTabs(categories, true);
    expect(tabs.some((t) => t.key === 'venue' && t.type === 'venue')).toBe(true);
  });

  it('独立展示分类单独成 Tab', () => {
    const categories = [
      makeCategory({ id: 'c-class', name: '班课', mode: 'class', sortOrder: 1, isSystem: true }),
      makeCategory({
        id: 'c-ind',
        name: '钢琴精品',
        mode: 'private',
        sortOrder: 3,
        independentDisplay: true,
      }),
    ];
    const tabs = buildScheduleTabs(categories, false);
    expect(tabs.find((t) => t.key === 'category-c-ind')?.label).toBe('钢琴精品');
  });

  it('某模式无分类时不生成对应 Tab', () => {
    const categories = [
      makeCategory({ id: 'c-class', name: '班课', mode: 'class', sortOrder: 1, isSystem: true }),
    ];
    const tabs = buildScheduleTabs(categories, false);
    expect(tabs.some((t) => t.mode === 'private')).toBe(false);
  });

  it('无分类且关闭场地 → 空 Tab', () => {
    expect(buildScheduleTabs([], false)).toEqual([]);
  });

  it('无分类仅开场地 → 仅 venue', () => {
    const tabs = buildScheduleTabs([], true);
    expect(tabs.map((t) => t.key)).toEqual(['venue']);
    expect(tabs[0].type).toBe('venue');
  });

  it('仅独立展示分类时不生成 mode Tab，可与场地并存', () => {
    const categories = [
      makeCategory({
        id: 'c-ind',
        name: '独立私教',
        mode: 'private',
        sortOrder: 2,
        independentDisplay: true,
      }),
    ];
    const tabs = buildScheduleTabs(categories, true);
    expect(tabs.map((t) => t.key)).toEqual(['category-c-ind', 'venue']);
    expect(tabs.every((t) => t.key !== 'mode-private')).toBe(true);
  });
});

describe('resolveActiveCategoryIds', () => {
  const categories = [
    makeCategory({ id: 'c1', name: '班课', mode: 'class', sortOrder: 1 }),
    makeCategory({ id: 'c2', name: '班课进阶', mode: 'class', sortOrder: 2 }),
    makeCategory({
      id: 'c-ind',
      name: '独立',
      mode: 'private',
      sortOrder: 5,
      independentDisplay: true,
    }),
  ];

  it('场地 Tab 返回空集', () => {
    const tab: ScheduleTabItem = { key: 'venue', type: 'venue', label: '场地', sortOrder: 4 };
    expect(resolveActiveCategoryIds(tab, categories).size).toBe(0);
  });

  it('独立分类 Tab 仅含自身 id', () => {
    const tab: ScheduleTabItem = {
      key: 'category-c-ind',
      type: 'category',
      label: '独立',
      mode: 'private',
      categoryId: 'c-ind',
      sortOrder: 5,
    };
    expect([...resolveActiveCategoryIds(tab, categories)]).toEqual(['c-ind']);
  });

  it('模式 Tab 含同 mode 非独立分类', () => {
    const tab: ScheduleTabItem = {
      key: 'mode-class',
      type: 'category',
      label: '班课',
      mode: 'class',
      sortOrder: 1,
    };
    expect([...resolveActiveCategoryIds(tab, categories)].sort()).toEqual(['c1', 'c2']);
  });
});

describe('filterClassesForTab', () => {
  const classTab: ScheduleTabItem = {
    key: 'mode-class',
    type: 'category',
    label: '班课',
    mode: 'class',
    sortOrder: 1,
  };
  const groupTab: ScheduleTabItem = {
    key: 'mode-group',
    type: 'category',
    label: '团课',
    mode: 'group',
    sortOrder: 2,
  };

  it('场地 Tab 返回空数组', () => {
    const venueTab: ScheduleTabItem = { key: 'venue', type: 'venue', label: '场地', sortOrder: 4 };
    expect(
      filterClassesForTab({
        activeTab: venueTab,
        activeCategoryIds: new Set(),
        classes: [makeClass({ id: 'cl1', name: 'A' })],
        isParent: false,
        parentClassIds: new Set(),
      }),
    ).toEqual([]);
  });

  it('按 category_id 过滤', () => {
    const classes = [
      makeClass({ id: 'cl1', name: 'A', category_id: 'c1' }),
      makeClass({ id: 'cl2', name: 'B', category_id: 'c-other' }),
    ];
    const result = filterClassesForTab({
      activeTab: classTab,
      activeCategoryIds: new Set(['c1']),
      classes,
      isParent: false,
      parentClassIds: new Set(),
    });
    expect(result.map((c) => c.id)).toEqual(['cl1']);
  });

  it('无 category_id 时 group 模式仅保留 open 班', () => {
    const classes = [
      makeClass({ id: 'cl1', name: 'Open', schedule_mode: 'open' }),
      makeClass({ id: 'cl2', name: 'Fixed', schedule_mode: 'fixed' }),
    ];
    const result = filterClassesForTab({
      activeTab: groupTab,
      activeCategoryIds: new Set(['c-group']),
      classes,
      isParent: false,
      parentClassIds: new Set(),
    });
    expect(result.map((c) => c.id)).toEqual(['cl1']);
  });

  it('家长仅可见 parentClassIds 内的班课/团课', () => {
    const classes = [
      makeClass({ id: 'cl1', name: 'Mine', category_id: 'c1' }),
      makeClass({ id: 'cl2', name: 'Other', category_id: 'c1' }),
    ];
    const result = filterClassesForTab({
      activeTab: classTab,
      activeCategoryIds: new Set(['c1']),
      classes,
      isParent: true,
      parentClassIds: new Set(['cl1']),
    });
    expect(result.map((c) => c.id)).toEqual(['cl1']);
  });

  it('无 category_id 时 class 模式保留 fixed/未设，排除 open', () => {
    const classes = [
      makeClass({ id: 'cl-fixed', name: 'Fixed', schedule_mode: 'fixed' }),
      makeClass({ id: 'cl-unset', name: 'Unset' }),
      makeClass({ id: 'cl-open', name: 'Open', schedule_mode: 'open' }),
    ];
    const result = filterClassesForTab({
      activeTab: classTab,
      activeCategoryIds: new Set(['c1']),
      classes,
      isParent: false,
      parentClassIds: new Set(),
    });
    expect(result.map((c) => c.id)).toEqual(['cl-fixed', 'cl-unset']);
  });

  it('无 category_id 时 private 模式一律排除', () => {
    const privateTab: ScheduleTabItem = {
      key: 'mode-private',
      type: 'category',
      label: '私教',
      mode: 'private',
      sortOrder: 3,
    };
    const result = filterClassesForTab({
      activeTab: privateTab,
      activeCategoryIds: new Set(['c-private']),
      classes: [
        makeClass({ id: 'cl1', name: 'A', schedule_mode: 'fixed' }),
        makeClass({ id: 'cl2', name: 'B', schedule_mode: 'open' }),
      ],
      isParent: false,
      parentClassIds: new Set(),
    });
    expect(result).toEqual([]);
  });

  it('家长在团课 Tab 同样受 parentClassIds 约束', () => {
    const classes = [
      makeClass({ id: 'g1', name: 'Mine', category_id: 'c-group' }),
      makeClass({ id: 'g2', name: 'Other', category_id: 'c-group' }),
    ];
    const result = filterClassesForTab({
      activeTab: groupTab,
      activeCategoryIds: new Set(['c-group']),
      classes,
      isParent: true,
      parentClassIds: new Set(['g1']),
    });
    expect(result.map((c) => c.id)).toEqual(['g1']);
  });
});

describe('filterSchedulesForTab', () => {
  const classTab: ScheduleTabItem = {
    key: 'mode-class',
    type: 'category',
    label: '班课',
    mode: 'class',
    sortOrder: 1,
  };

  it('停课班级排课被排除', () => {
    const filteredClasses = [
      makeClass({ id: 'cl-active', name: 'Active', status: 'active' }),
      makeClass({ id: 'cl-paused', name: 'Paused', status: 'paused' }),
    ];
    const schedules = [
      makeSchedule({ id: 's1', class_id: 'cl-active' }),
      makeSchedule({ id: 's2', class_id: 'cl-paused' }),
    ];
    const result = filterSchedulesForTab(classTab, filteredClasses, schedules);
    expect(result.map((s) => s.id)).toEqual(['s1']);
  });

  it('无 class_id 的排课保留', () => {
    const filteredClasses = [makeClass({ id: 'cl1', name: 'A' })];
    const schedules = [makeSchedule({ id: 's-no-class' })];
    expect(filterSchedulesForTab(classTab, filteredClasses, schedules).length).toBe(1);
  });
});

describe('resolveDateDotType', () => {
  const monday = dayjs('2026-09-07'); // Monday
  const tuesday = dayjs('2026-09-08');

  it('无课且无临调迁入 → none', () => {
    const dot = resolveDateDotType({
      date: tuesday,
      currentTime: NOW,
      filteredSchedules: [makeSchedule({ id: 's1', class_id: 'cl1', day_of_week: 1 })],
      selectedClassId: '',
      temporaryReschedules: [],
      calendarWeekdaySet: new Set([1]),
    });
    expect(dot).toBe('none');
  });

  it('有固定排课 → active（未来）或 past（过去）', () => {
    const future = resolveDateDotType({
      date: monday.add(7, 'day'),
      currentTime: NOW,
      filteredSchedules: [makeSchedule({ id: 's1', class_id: 'cl1', day_of_week: 1 })],
      selectedClassId: '',
      temporaryReschedules: [],
      calendarWeekdaySet: new Set([1]),
    });
    expect(future).toBe('active');

    const past = resolveDateDotType({
      date: monday.subtract(7, 'day'),
      currentTime: NOW,
      filteredSchedules: [makeSchedule({ id: 's1', class_id: 'cl1', day_of_week: 1 })],
      selectedClassId: '',
      temporaryReschedules: [],
      calendarWeekdaySet: new Set([1]),
    });
    expect(past).toBe('past');
  });

  it('临调迁出日不计入固定排课', () => {
    const reschedules: TemporaryReschedule[] = [
      {
        id: 'tr1',
        teacher_id: 't1',
        class_id: 'cl1',
        schedule_id: 's1',
        source_date: '2026-09-07',
        target_date: '2026-09-09',
        start_time: '09:00',
        end_time: '10:00',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];
    const dot = resolveDateDotType({
      date: monday,
      currentTime: NOW,
      filteredSchedules: [makeSchedule({ id: 's1', class_id: 'cl1', day_of_week: 1 })],
      selectedClassId: '',
      temporaryReschedules: reschedules,
      calendarWeekdaySet: new Set([1]),
    });
    expect(dot).toBe('none');
  });

  it('临调迁入日无固定 weekday 仍显示 active', () => {
    const reschedules: TemporaryReschedule[] = [
      {
        id: 'tr1',
        teacher_id: 't1',
        class_id: 'cl1',
        schedule_id: 's1',
        source_date: '2026-08-25',
        target_date: '2026-09-08',
        start_time: '09:00',
        end_time: '10:00',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];
    const dot = resolveDateDotType({
      date: tuesday,
      currentTime: NOW,
      filteredSchedules: [],
      selectedClassId: '',
      temporaryReschedules: reschedules,
      calendarWeekdaySet: new Set<Schedule['day_of_week']>(),
    });
    expect(dot).toBe('active');
  });

  it('临调迁入到过去日 → past', () => {
    const pastTuesday = dayjs('2026-08-25'); // Tuesday before NOW
    const reschedules: TemporaryReschedule[] = [
      {
        id: 'tr1',
        teacher_id: 't1',
        class_id: 'cl1',
        schedule_id: 's1',
        source_date: '2026-08-18',
        target_date: '2026-08-25',
        start_time: '09:00',
        end_time: '10:00',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];
    expect(
      resolveDateDotType({
        date: pastTuesday,
        currentTime: NOW,
        filteredSchedules: [],
        selectedClassId: '',
        temporaryReschedules: reschedules,
        calendarWeekdaySet: new Set<Schedule['day_of_week']>(),
      }),
    ).toBe('past');
  });

  it('selectedClassId 过滤临调迁入：其它班迁入不点亮', () => {
    const reschedules: TemporaryReschedule[] = [
      {
        id: 'tr1',
        teacher_id: 't1',
        class_id: 'cl-other',
        schedule_id: 's-other',
        source_date: '2026-08-25',
        target_date: '2026-09-08',
        start_time: '09:00',
        end_time: '10:00',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];
    expect(
      resolveDateDotType({
        date: tuesday,
        currentTime: NOW,
        filteredSchedules: [],
        selectedClassId: 'cl1',
        temporaryReschedules: reschedules,
        calendarWeekdaySet: new Set<Schedule['day_of_week']>(),
      }),
    ).toBe('none');
  });
});

describe('resolveOpenDateDotType', () => {
  it('无开放时段 → none', () => {
    expect(resolveOpenDateDotType(NOW, NOW, new Set())).toBe('none');
  });

  it('有开放时段 → active 或 past', () => {
    const dateStr = NOW.format('YYYY-MM-DD');
    expect(resolveOpenDateDotType(NOW, NOW, new Set([dateStr]))).toBe('active');
    expect(
      resolveOpenDateDotType(
        NOW.subtract(1, 'day'),
        NOW,
        new Set([NOW.subtract(1, 'day').format('YYYY-MM-DD')]),
      ),
    ).toBe('past');
  });

  it('当天有开放时段不算 past（isBefore day 为 false）', () => {
    const today = dayjs('2026-09-01T23:59:00');
    expect(resolveOpenDateDotType(today, NOW, new Set(['2026-09-01']))).toBe('active');
  });
});
