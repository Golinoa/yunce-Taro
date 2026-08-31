/* eslint-disable import/first -- vitest mock must hoist before SUT import */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/build-env', () => ({
  isDevApiEnv: () => true,
  isUseMock: () => false,
  getApiBaseUrl: () => 'https://dev.chancore.cn/api/app/v1',
  PROD_API_BASE_URL: 'https://api.chancore.cn/api/app/v1',
  API_BASE_URL: 'https://dev.chancore.cn/api/app/v1',
}));

import { createClientRequestId, requestSubscribeMessageAuth } from './subscribe-message';

describe('subscribe-message utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createClientRequestId 为 uuid 格式', () => {
    const id = createClientRequestId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('requestSubscribeMessageAuth：空 tmplId 不调微信', async () => {
    const items = await requestSubscribeMessageAuth([{ group: 'todo_remind', tmplId: '' }]);
    expect(items).toEqual([]);
  });

  it('requestSubscribeMessageAuth：mock tmplId 直接 accept', async () => {
    const items = await requestSubscribeMessageAuth([
      { group: 'todo_remind', tmplId: 'mock-tmpl-todo-remind' },
    ]);
    expect(items).toEqual([
      { group: 'todo_remind', tmplId: 'mock-tmpl-todo-remind', status: 'accept' },
    ]);
  });
});
