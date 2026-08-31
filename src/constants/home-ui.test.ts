import { describe, expect, it } from 'vitest';
import {
  HOME_QUICK_ENTRIES,
  PARENT_HOME_QUICK_ENTRIES,
  TEACHER_HOME_QUICK_ENTRIES,
} from '@/constants/home-ui';

const PARENT_LABELS = [
  '请假',
  '我要约课',
  '我的课表',
  '我的课时',
  '上课记录',
  '课后作业',
  '课堂点评',
  '成长档案',
] as const;

const TEACHER_LABELS = [
  '学员',
  '添加学员',
  '上课记录',
  '意向学员',
  '试听记录',
  '续费提醒',
] as const;

const TAB_PATHS = new Set([
  '/pages/home/index',
  '/pages/schedule/index',
  '/pages/statistics/index',
  '/pages/profile/index',
]);

describe('home-ui 快捷入口常量', () => {
  it('家长金刚区固定 8 项且顺序与产品口径一致', () => {
    expect(PARENT_HOME_QUICK_ENTRIES).toHaveLength(8);
    expect(PARENT_HOME_QUICK_ENTRIES.map((e) => e.label)).toEqual([...PARENT_LABELS]);
  });

  it('家长入口 label/icon/url 齐全且无重复', () => {
    const labels = PARENT_HOME_QUICK_ENTRIES.map((e) => e.label);
    const icons = PARENT_HOME_QUICK_ENTRIES.map((e) => e.icon);
    expect(new Set(labels).size).toBe(labels.length);
    expect(PARENT_HOME_QUICK_ENTRIES.every((e) => Boolean(e.icon && e.url && e.color))).toBe(true);
    expect(icons.every((icon) => icon.startsWith('mdi-'))).toBe(true);
  });

  it('家长入口 url 仅为页面路径、Tab 或首页锚点', () => {
    for (const entry of PARENT_HOME_QUICK_ENTRIES) {
      const url = entry.url;
      const isAnchor = url.startsWith('#');
      const path = url.split('?')[0];
      const isTab = TAB_PATHS.has(path);
      const isSubPackage = path.startsWith('/package-');
      expect(isAnchor || isTab || isSubPackage, `${entry.label} → ${url}`).toBe(true);
    }
  });

  it('教师金刚区收敛为教学主路径 6 项', () => {
    expect(TEACHER_HOME_QUICK_ENTRIES).toHaveLength(6);
    expect(TEACHER_HOME_QUICK_ENTRIES.map((e) => e.label)).toEqual([...TEACHER_LABELS]);
    expect(TEACHER_HOME_QUICK_ENTRIES.every((e) => Boolean(e.icon && e.url && e.color))).toBe(true);
    const labels = TEACHER_HOME_QUICK_ENTRIES.map((e) => e.label);
    expect(labels.includes('充值记录')).toBe(false);
    expect(labels.includes('课时充值')).toBe(false);
  });

  it('校长/管理员金刚区保留教务工具且首项为课时充值', () => {
    expect(HOME_QUICK_ENTRIES.length).toBe(8);
    expect(HOME_QUICK_ENTRIES[0]?.label).toBe('课时充值');
    expect(HOME_QUICK_ENTRIES[0]?.url).toContain('/package-course/pages/package-form/index');
    const parentSet = new Set(PARENT_HOME_QUICK_ENTRIES.map((e) => e.label));
    expect(parentSet.has('课时充值')).toBe(false);
  });
});
