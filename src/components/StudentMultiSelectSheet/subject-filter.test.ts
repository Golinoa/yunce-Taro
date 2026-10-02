import { describe, expect, it } from 'vitest';
import type { Subject } from '@/types/campus';
import type { Student } from '@/types/student';
import { matchSubjectFilter, resolveEffectiveSubjectId } from './index';

const subjects = [
  { id: 'sub-uuid-1', name: '美术' },
  { id: 'sub-uuid-2', name: '书法' },
] as unknown as Subject[];

describe('StudentMultiSelectSheet 科目过滤（2026-10-02 修复）', () => {
  describe('resolveEffectiveSubjectId', () => {
    it('按 id 命中（新数据：班级存 Subject UUID）', () => {
      expect(resolveEffectiveSubjectId('sub-uuid-1', subjects)).toBe('sub-uuid-1');
    });

    it('按名称命中（两代数据：班级存科目中文名）', () => {
      expect(resolveEffectiveSubjectId('美术', subjects)).toBe('sub-uuid-1');
    });

    it('未命中或空值回落 undefined ⇒ 弹窗回落「全部科目」', () => {
      expect(resolveEffectiveSubjectId('sub-piano', subjects)).toBeUndefined();
      expect(resolveEffectiveSubjectId(undefined, subjects)).toBeUndefined();
      expect(resolveEffectiveSubjectId('美术', [])).toBeUndefined();
    });
  });

  describe('matchSubjectFilter', () => {
    it('「全部科目」恒放行', () => {
      expect(
        matchSubjectFilter({ course_packages: [], package_subject_ids: ['sub-uuid-1'] }, 'all'),
      ).toBe(true);
    });

    it('按 package_subject_ids 判定：覆盖所选科目才放行', () => {
      const student = {
        course_packages: [],
        package_subject_ids: ['sub-uuid-1'],
      };
      expect(matchSubjectFilter(student, 'sub-uuid-1')).toBe(true);
      expect(matchSubjectFilter(student, 'sub-uuid-2')).toBe(false);
    });

    it('集合为空 = 无课包（可能只有会员卡等通用余额）⇒ 放行', () => {
      expect(
        matchSubjectFilter({ course_packages: [], package_subject_ids: [] }, 'sub-uuid-1'),
      ).toBe(true);
    });

    it('字段缺失（旧数据源）⇒ 回落卡包比对：无科目卡=通用放行、科目匹配才放行', () => {
      const generic = {
        course_packages: [{ subject_id: undefined }] as Student['course_packages'],
        package_subject_ids: undefined,
      };
      expect(matchSubjectFilter(generic, 'sub-uuid-1')).toBe(true);

      const matched = {
        course_packages: [{ subject_id: 'sub-uuid-2' }] as Student['course_packages'],
        package_subject_ids: undefined,
      };
      expect(matchSubjectFilter(matched, 'sub-uuid-2')).toBe(true);
      expect(matchSubjectFilter(matched, 'sub-uuid-1')).toBe(false);
    });
  });
});
