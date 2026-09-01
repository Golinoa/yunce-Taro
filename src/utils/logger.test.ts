import { beforeEach, describe, expect, it, vi } from 'vitest';

const errorFn = vi.fn();
const warnFn = vi.fn();

vi.mock('@tarojs/taro', () => ({
  default: {
    getRealtimeLogManager: () => ({
      error: errorFn,
      warn: warnFn,
      info: vi.fn(),
    }),
  },
}));

describe('logger realtime', () => {
  beforeEach(() => {
    vi.resetModules();
    errorFn.mockClear();
    warnFn.mockClear();
  });

  it('logError 调用 RealtimeLogManager.error', async () => {
    const { logError } = await import('./logger');
    logError('unit-test', new Error('boom'));
    expect(errorFn).toHaveBeenCalled();
    expect(errorFn.mock.calls[0][0]).toBe('unit-test');
    expect(errorFn.mock.calls[0][1]).toMatchObject({ message: 'boom' });
  });

  it('logRequestIssue 5xx 走 error，timeout 走 warn', async () => {
    const { logRequestIssue } = await import('./logger');
    logRequestIssue('http5xx', { path: '/x', statusCode: 502, errMsg: 'bad' });
    expect(errorFn).toHaveBeenCalled();
    logRequestIssue('timeout', { path: '/y', errMsg: 'timeout' });
    expect(warnFn).toHaveBeenCalled();
  });
});
