/**
 * Q2-5：学员家长绑定映射（消课通知依赖 parent_id = profileId）
 */
import { describe, expect, it } from 'vitest';

/** 与 services/student.ts mapBackendStudentParent 对齐的轻量副本，避免拉整文件副作用 */
function mapBackendStudentParent(
  studentId: string,
  item: {
    id: string;
    profileId?: string | null;
    createdAt?: string;
    profile?: {
      nickname?: string | null;
      phone?: string | null;
      avatar?: string | null;
    } | null;
  },
) {
  const profileId = item.profileId || '';
  return {
    id: item.id,
    student_id: studentId,
    parent_id: profileId,
    parent: item.profile
      ? {
          id: profileId,
          name: item.profile.nickname || '家长',
          phone: item.profile.phone || undefined,
          avatar_url: item.profile.avatar || undefined,
        }
      : undefined,
    created_at: item.createdAt || '',
  };
}

describe('mapBackendStudentParent (Q2-5)', () => {
  it('把 profileId 映射为 parent_id 供通知 receiver', () => {
    const mapped = mapBackendStudentParent('stu-1', {
      id: 'bind-1',
      profileId: 'profile-p1',
      createdAt: '2026-09-02T00:00:00.000Z',
      profile: { nickname: '张爸', phone: '13800138000', avatar: null },
    });
    expect(mapped.parent_id).toBe('profile-p1');
    expect(mapped.parent?.name).toBe('张爸');
    expect(mapped.student_id).toBe('stu-1');
  });

  it('无 profile 时仍保留绑定 id', () => {
    const mapped = mapBackendStudentParent('stu-1', {
      id: 'bind-2',
      profileId: 'profile-p2',
      profile: null,
    });
    expect(mapped.parent).toBeUndefined();
    expect(mapped.parent_id).toBe('profile-p2');
  });
});
