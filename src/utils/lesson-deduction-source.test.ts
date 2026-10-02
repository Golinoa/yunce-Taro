/**
 * 「这次点名扣哪张卡」的用例。
 *
 * 口径：**唯一来源 = 会员卡**（课包已于 2026-10-02 整套移除）。
 * 挑错卡 = 扣错科目的次数，所以科目匹配、状态、剩余三条都要锁死。
 */
import { describe, expect, it } from 'vitest';
import type { MemberCardDetail } from '@/types/member-card';
import {
  getMemberCardRemaining,
  pickMemberCardForLesson,
  resolveLessonDeduction,
  resolveRemainingAfterDeduct,
} from '@/utils/lesson-deduction-source';

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

  it('传 undefined 算 0（调用方不必先判空）', () => {
    expect(getMemberCardRemaining(undefined)).toBe(0);
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

describe('resolveLessonDeduction（唯一来源 = 会员卡）', () => {
  it('有该科目可用卡 ⇒ 返回该卡', () => {
    const result = resolveLessonDeduction({
      memberCards: [card({ id: 'card-piano', cardTypeSubjectId: 'sub-piano' })],
      hoursNeeded: 1,
      subject: PIANO,
    });
    expect(result).toEqual({ id: 'card-piano', name: '钢琴 20 次卡' });
  });

  it('只有别的科目的卡 ⇒ null（不猜、不扣错科目）', () => {
    expect(
      resolveLessonDeduction({
        memberCards: [card({ cardTypeSubjectId: 'sub-art' })],
        hoursNeeded: 1,
        subject: PIANO,
      }),
    ).toBeNull();
  });

  it('没有可用卡 ⇒ null', () => {
    expect(
      resolveLessonDeduction({ memberCards: [card({ remainingCount: 0 })], hoursNeeded: 1 }),
    ).toBeNull();
  });

  it('数据还没加载（undefined）不会抛错，返回 null', () => {
    expect(resolveLessonDeduction({ hoursNeeded: 1, subject: PIANO })).toBeNull();
  });
});

describe('resolveRemainingAfterDeduct', () => {
  it('优先用后端返回的剩余', () => {
    expect(resolveRemainingAfterDeduct(9, card({ remainingCount: 8 }), 1)).toBe(9);
  });

  it('后端没给 ⇒ 本地按卡余额推算', () => {
    expect(resolveRemainingAfterDeduct(null, card({ remainingCount: 8 }), 3)).toBe(5);
  });

  it('推算结果不为负', () => {
    expect(resolveRemainingAfterDeduct(undefined, card({ remainingCount: 1 }), 5)).toBe(0);
  });
});
