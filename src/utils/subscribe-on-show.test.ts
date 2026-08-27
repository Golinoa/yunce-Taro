import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockEnqueuePending, mockResetState } from '@/data/subscribe-message';
import { getSession } from '@/services/auth';
import { subscribeMessageService } from '@/services/subscribe-message';
import { useSubscribeAuthStore } from '@/stores/subscribe-auth';
import { consumeSubscribeOnShow } from './subscribe-on-show';

vi.mock('@/services/auth', () => ({
  getSession: vi.fn(),
}));

const USER = 'onshow-test-user';

describe('consumeSubscribeOnShow', () => {
  beforeEach(() => {
    mockResetState();
    Taro.removeStorageSync('yunce:subscribe-freq');
    useSubscribeAuthStore.setState({
      prompt: { visible: false, presetId: 'student_created' },
      sheet: { visible: false, presetId: 'checkin_renew', scene: '', groups: [] },
      banner: { visible: false, message: '' },
    });
    vi.mocked(getSession).mockResolvedValue({
      profile: { id: USER } as never,
      session: null,
    });
  });

  it('T-F-04: pending 空队列时不展示弹框', async () => {
    const openSpy = vi.spyOn(subscribeMessageService, 'openPromptFromPending');

    await consumeSubscribeOnShow();

    expect(openSpy).not.toHaveBeenCalled();
    expect(useSubscribeAuthStore.getState().prompt.visible).toBe(false);
    openSpy.mockRestore();
  });

  it('T-F-05: 多 pending 时只展示优先级最高（priority 最小）的一条', async () => {
    await mockEnqueuePending(USER, {
      id: 'p-collab',
      presetId: 'collab_todo_new',
      eventCode: 'collab_todo',
      payload: { title: '协作待办' },
      templateGroups: [],
      scene: 'collab_todo_entry',
      priority: 20,
    });
    await mockEnqueuePending(USER, {
      id: 'p-class',
      presetId: 'student_join_class_teacher',
      eventCode: 'class_assign',
      payload: { studentName: '小明', className: '钢琴班' },
      templateGroups: ['class_remind'],
      scene: 'class_assign_teacher',
      priority: 5,
    });

    const openSpy = vi
      .spyOn(subscribeMessageService, 'openPromptFromPending')
      .mockResolvedValue(undefined);

    await consumeSubscribeOnShow();

    expect(openSpy).toHaveBeenCalledOnce();
    expect(openSpy.mock.calls[0][0].id).toBe('p-class');
    openSpy.mockRestore();
  });

  it('E15: needsReactivate 时展示 quota_reactivate 弹框', async () => {
    vi.spyOn(subscribeMessageService, 'bootstrap').mockResolvedValue({
      templates: [],
      quotas: [
        {
          group: 'todo_remind',
          tmplId: 'mock-tmpl-todo-remind',
          remain: 2,
          lowThreshold: 3,
          notifyEnabled: true,
          needsReactivate: true,
        },
      ],
      pendingPrompts: [],
      lowQuotaGroups: [],
    });
    const openSpy = vi.spyOn(subscribeMessageService, 'openPrompt').mockResolvedValue('secondary');

    await consumeSubscribeOnShow();

    expect(openSpy).toHaveBeenCalledWith(
      expect.objectContaining({ presetId: 'quota_reactivate' }),
    );
    openSpy.mockRestore();
  });
});
