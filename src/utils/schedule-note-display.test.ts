/**
 * 排课备注净化与卡片标题解析单测
 *
 * 关键回归点（2026-09-28）：排课表单把「规则元信息」写进 `note`，而首页把 `note` 当卡片标题
 * ⇒ 标题显示成「类型:班课 | 规则:weekly | 开始:2026-09-21 | …」。必须：
 * 1. 元信息段被剥掉；2. 用户原文（含 `|`）原样保留；3. 正式排课标题以班级名称为准。
 */
import { describe, expect, it } from 'vitest';
import { resolveScheduleDisplayTitle, stripScheduleNoteMeta } from '@/utils/schedule-note-display';

const REAL_NOTE =
  '类型:班课 | 规则:weekly | 开始:2026-09-21 | 结束:不结束 | 节假日排课:否 | 消耗课时:1';

describe('stripScheduleNoteMeta', () => {
  it('纯系统元信息 → 清空（这正是截图里那串标题）', () => {
    expect(stripScheduleNoteMeta(REAL_NOTE)).toBe('');
    expect(stripScheduleNoteMeta('类型:团课 | 自动开班:full | 每时段可约:6')).toBe('');
  });

  it('用户原文 + 元信息行 → 只留用户原文', () => {
    expect(stripScheduleNoteMeta(`准备教具\n${REAL_NOTE}`)).toBe('准备教具');
  });

  it('用户原文原样保留（不以元信息键开头、含 | 也不动）', () => {
    expect(stripScheduleNoteMeta('书法 · 毛笔 | 宣纸')).toBe('书法 · 毛笔 | 宣纸');
    expect(stripScheduleNoteMeta('调课说明：本周四改周五')).toBe('调课说明：本周四改周五');
  });

  it('空值与空白', () => {
    expect(stripScheduleNoteMeta(undefined)).toBe('');
    expect(stripScheduleNoteMeta(null)).toBe('');
    expect(stripScheduleNoteMeta('   ')).toBe('');
  });
});

describe('resolveScheduleDisplayTitle', () => {
  it('正式排课：班级名称优先（截图场景）', () => {
    expect(
      resolveScheduleDisplayTitle({
        note: REAL_NOTE,
        classInfoName: '初级书法班',
        scheduleKind: 'schedule',
      }),
    ).toBe('初级书法班');
  });

  it('正式排课无班级名时回落到用户备注，且备注已净化', () => {
    expect(
      resolveScheduleDisplayTitle({ note: `教具\n${REAL_NOTE}`, scheduleKind: 'schedule' }),
    ).toBe('教具');
  });

  it('正式排课两者都无 → 未命名课程', () => {
    expect(resolveScheduleDisplayTitle({ note: REAL_NOTE, scheduleKind: 'schedule' })).toBe(
      '未命名课程',
    );
  });

  it('私教试听：note 优先（"学员 · 课程"不能让位给班级名）', () => {
    expect(
      resolveScheduleDisplayTitle({
        note: '小明 · 钢琴课',
        classInfoName: '钢琴入门A班',
        scheduleKind: 'booking',
        trialMode: 'private',
      }),
    ).toBe('小明 · 钢琴课');
  });

  it('场地预约：note 优先（"用途 · 教室"）', () => {
    expect(
      resolveScheduleDisplayTitle({
        note: '教研会 · 301教室',
        classInfoName: '某班',
        scheduleKind: 'venue',
      }),
    ).toBe('教研会 · 301教室');
  });

  it('团课试听：班级名称优先（note 与班级名同义）', () => {
    expect(
      resolveScheduleDisplayTitle({
        note: '钢琴入门A班',
        classInfoName: '钢琴入门A班',
        scheduleKind: 'booking',
        trialMode: 'group',
      }),
    ).toBe('钢琴入门A班');
  });
});
