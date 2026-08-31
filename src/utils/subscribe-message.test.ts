import { describe, expect, it } from 'vitest';
import { createClientRequestId, requestSubscribeMessageAuth } from './subscribe-message';

describe('subscribe-message utils', () => {
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
