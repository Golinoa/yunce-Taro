/**
 * B9 / R8 推荐关系 — 载荷三态语义（最容易改坏的一处）
 *
 * 背景：`mapStudentPayload` 对推荐人是**三态**，与文本字段（留空即不覆盖）完全不同：
 * - 不传 ⇒ 后端**不修改**（保护"新建后补传头像"这类局部更新不被误清）；
 * - `null` ⇒ 后端**明确清除**；
 * - id ⇒ 设置。
 *
 * 若有人"顺手"把它写成 `data.referrer_student_id ?? null`，
 * 局部更新就会把推荐人静默抹掉 —— 这个测试就是那道闸。
 */
import { describe, expect, it } from 'vitest';
import { __studentPayloadMappersForTest } from './student';

const { mapStudentPayload } = __studentPayloadMappersForTest;

describe('mapStudentPayload · 推荐关系三态（B9 / R8）', () => {
  it('传 id：原样带出，后端据此设置推荐人', () => {
    const payload = mapStudentPayload({ name: '张三', referrer_student_id: 'referrer-1' });
    expect(payload.referrerStudentId).toBe('referrer-1');
  });

  it('传 null：带出 null，后端据此 disconnect（清除）', () => {
    const payload = mapStudentPayload({ name: '张三', referrer_student_id: null });
    expect(payload.referrerStudentId).toBeNull();
  });

  it('不传：序列化后**不含该键** ⇒ 后端视为不修改（关键：不能变成 null）', () => {
    const payload = mapStudentPayload({ name: '张三' });
    expect(payload.referrerStudentId).toBeUndefined();
    // 走一遍真实网络序列化，确认这个键真的不上网络
    const wire = JSON.parse(JSON.stringify(payload));
    expect('referrerStudentId' in wire).toBe(false);
  });

  it('回归护栏：局部更新（只传头像）不得把推荐人清掉', () => {
    // 新建后补传头像的场景：只带 avatar_url，不带推荐人
    const payload = mapStudentPayload({ name: '张三', avatar_url: 'https://cdn/a.png' });
    const wire = JSON.parse(JSON.stringify(payload));
    expect(wire.avatar).toBe('https://cdn/a.png');
    expect('referrerStudentId' in wire).toBe(false);
  });
});
