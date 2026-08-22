import { describe, it, expect } from 'vitest';
import { mockCreateLead } from '@/data/lead';
import { mockUpdateLead } from '@/data/lead';
import { mockReassignLead } from '@/data/lead';

/**
 * 线索归属锁定守卫回归测试（对应修复 L-14）
 * 验证：锁定态下禁止任意改派，必须经由专用 reassignLead 并显式 forceReassign，且记录审计。
 */
describe('线索归属锁定守卫（L-14）', () => {
  it('锁定态下直接 updateLead 改派会抛错', async () => {
    const lead = await mockCreateLead(
      { child_name: '测试学员A', parent_phone: '13800000001', campus_id: 'c1' } as any,
      'teacher_owner_1',
    );
    lead.owner_lock_status = 'locked';

    await expect(
      mockUpdateLead(lead.id, { owner_teacher_id: 'teacher_other_9' }),
    ).rejects.toThrow(/锁定/);
  });

  it('锁定态下带 forceReassign 仍可改派', async () => {
    const lead = await mockCreateLead(
      { child_name: '测试学员B', parent_phone: '13800000002', campus_id: 'c1' } as any,
      'teacher_owner_2',
    );
    lead.owner_lock_status = 'locked';

    const updated = await mockUpdateLead(
      lead.id,
      { owner_teacher_id: 'teacher_other_9' },
      { forceReassign: true },
    );
    expect(updated?.owner_teacher_id).toBe('teacher_other_9');
  });

  it('reassignLead 锁定态无 forceReassign 抛错，带 forceReassign 记录审计', async () => {
    const lead = await mockCreateLead(
      { child_name: '测试学员C', parent_phone: '13800000003', campus_id: 'c1' } as any,
      'teacher_owner_3',
    );
    lead.owner_lock_status = 'locked';

    await expect(
      mockReassignLead(lead.id, 'teacher_other_9', '家长指定'),
    ).rejects.toThrow(/锁定/);

    const ok = await mockReassignLead(lead.id, 'teacher_other_9', '家长指定', {
      forceReassign: true,
      operatorId: 'op1',
    });
    expect(ok?.owner_teacher_id).toBe('teacher_other_9');
    expect(ok?.reassign_reason).toBe('家长指定');
    expect(ok?.reassign_operator_id).toBe('op1');
    expect(ok?.reassign_at).toBeTruthy();
  });
});
