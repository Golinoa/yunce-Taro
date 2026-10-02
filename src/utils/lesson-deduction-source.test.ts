/**
 * 「这次点名扣哪本账」的用例。
 *
 * 这条链路是资损链路：挑错卡 = 扣错科目的次数。两端都要锁死：
 * ① 有旧课包时必须仍走旧课包（零回归）；② 没旧课包时要能落到正确科目的会员卡上。
 */
import { describe, expect, it } from 'vitest';
import type { CoursePackage } from '@/types/course-package';
import type { MemberCardDetail } from '@/types/member-card';
import {
  getMemberCardRemaining,
  pickMemberCardForLesson,
  resolveLessonDeduction,
} from '@/utils/lesson-deduction-source';
import { pickBestPackage } from '@/utils/package-helper';

const pkg = (over: Partial<CoursePackage> = {}): CoursePackage =>
  ({
    id: 'pkg-1',
    name: '钢琴课时包',
    total_hours: 20,
    remaining_hours: 10,
    purchased_remaining: 10,
    bonus_remaining: 0,
    status: 'active',
    created_at: '',
    ...over,
  }) as CoursePackage;

const card = (over: Partial<MemberCardDetail> = {}): MemberCardDetail =>
  ({
    id: 'card-1',
    cardTypeId: 'ct-1',
    cardTypeName: '钢琴 20 次卡',
    studentId: 's1',
    studentName: '张三',
    status: 'active',
    remainingCount: 8,
    remainingGiftCount: 0,
    purchaseAt: '2026-01-01',
    frozenCount: 0,
    frozenDays: 0,
    purchasePrice: 0,
    cardTypeKind: 'count',
    cardTypeValidDays: 365,
    cardTypeFreezeCount: 0,
    cardTypeFreezeDays: 0,
    ...over,
  }) as MemberCardDetail;

const PIANO = { id: 'sub-piano', name: '钢琴' };

describe('getMemberCardRemaining', () => {
  it('剩余 = 次数 + 赠送次数', () => {
    expect(getMemberCardRemaining(card({ remainingCount: 5, remainingGiftCount: 2 }))).toBe(7);
  });

  it('历史卡 remainingCount 为空 ⇒ 只算赠送（不炸）', () => {
    expect(getMemberCardRemaining(card({ remainingCount: undefined, remainingGiftCount: 3 }))).toBe(
      3,
    );
  });
});

describe('pickMemberCardForLesson', () => {
  it('按科目挑卡：科目不匹配的卡绝不用', () => {
    const art = card({ id: 'card-art', cardTypeSubjectId: 'sub-art', cardTypeSubjectName: '美术' });
    expect(pickMemberCardForLesson([art], 1, PIANO)).toBeNull();
  });

  it('科目匹配的卡可用（卡种只填了名称也认）', () => {
    const legacy = card({
      id: 'card-legacy',
      cardTypeSubjectId: '钢琴',
      cardTypeSubjectName: '钢琴',
    });
    expect(pickMemberCardForLesson([legacy], 1, PIANO)?.id).toBe('card-legacy');
  });

  it('班级没配科目 ⇒ 任意可用卡都能用', () => {
    const art = card({ id: 'card-art', cardTypeSubjectId: 'sub-art' });
    expect(pickMemberCardForLesson([art], 1)?.id).toBe('card-art');
  });

  it('冻结 / 未激活 / 非次数卡 / 剩余不足 一律排除', () => {
    const cards = [
      card({ id: 'frozen', status: 'frozen', cardTypeSubjectId: 'sub-piano' }),
      card({ id: 'notActivated', status: 'notActivated', cardTypeSubjectId: 'sub-piano' }),
      card({ id: 'time', cardTypeKind: 'time', cardTypeSubjectId: 'sub-piano' }),
      card({ id: 'notEnough', remainingCount: 0, cardTypeSubjectId: 'sub-piano' }),
    ];
    expect(pickMemberCardForLesson(cards, 1, PIANO)).toBeNull();
  });

  it('多张可用 ⇒ 先到期先消耗', () => {
    const cards = [
      card({ id: 'late', expiredAt: '2027-12-31', cardTypeSubjectId: 'sub-piano' }),
      card({ id: 'early', expiredAt: '2026-06-30', cardTypeSubjectId: 'sub-piano' }),
      card({ id: 'never', cardTypeSubjectId: 'sub-piano' }),
    ];
    expect(pickMemberCardForLesson(cards, 1, PIANO)?.id).toBe('early');
  });
});

describe('resolveLessonDeduction', () => {
  it('有旧课包 ⇒ 走旧课包（存量行为零回归）', () => {
    const result = resolveLessonDeduction({
      packages: [pkg({ id: 'pkg-1', subject_id: 'sub-piano' })],
      memberCards: [card({ cardTypeSubjectId: 'sub-piano' })],
      hoursNeeded: 1,
      subject: PIANO,
    });
    expect(result).toEqual({ kind: 'package', id: 'pkg-1', name: '钢琴课时包' });
  });

  it('旧课包的选择结果与改前逐字一致（不许按科目偏袒）', () => {
    const packages = [
      pkg({ id: 'pkg-piano', subject_id: 'sub-piano', end_date: '2026-12-31' }),
      pkg({ id: 'pkg-general', subject_id: undefined, end_date: '2026-06-30' }),
    ];
    const result = resolveLessonDeduction({
      packages,
      memberCards: [],
      hoursNeeded: 1,
      subject: PIANO,
    });
    // 与"不传科目"的既有口径完全一致：谁早到期谁先扣
    expect(result?.id).toBe(pickBestPackage(packages, 1)?.id);
    expect(result?.id).toBe('pkg-general');
  });

  it('没有旧课包、有该科目会员卡 ⇒ 扣会员卡（本次要修的场景）', () => {
    const result = resolveLessonDeduction({
      packages: [],
      memberCards: [card({ id: 'card-piano', cardTypeSubjectId: 'sub-piano' })],
      hoursNeeded: 1,
      subject: PIANO,
    });
    expect(result).toEqual({ kind: 'memberCard', id: 'card-piano', name: '钢琴 20 次卡' });
  });

  it('只有别的科目的卡 ⇒ null（不猜、不扣错科目）', () => {
    const result = resolveLessonDeduction({
      packages: [],
      memberCards: [card({ cardTypeSubjectId: 'sub-art' })],
      hoursNeeded: 1,
      subject: PIANO,
    });
    expect(result).toBeNull();
  });

  it('两本账都没有 ⇒ null', () => {
    expect(
      resolveLessonDeduction({ packages: [], memberCards: [], hoursNeeded: 1, subject: PIANO }),
    ).toBeNull();
  });

  it('数据还没加载（undefined）不会抛错，返回 null', () => {
    expect(resolveLessonDeduction({ hoursNeeded: 1, subject: PIANO })).toBeNull();
  });
});
