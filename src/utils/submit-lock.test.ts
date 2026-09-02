import { describe, expect, it } from 'vitest';
import { createSubmitLock } from './submit-lock';

describe('createSubmitLock (G1-1)', () => {
  it('首次 tryAcquire 成功，占用中再次失败', () => {
    const lock = createSubmitLock();
    expect(lock.tryAcquire()).toBe(true);
    expect(lock.isLocked()).toBe(true);
    expect(lock.tryAcquire()).toBe(false);
  });

  it('release 后可再次占用', () => {
    const lock = createSubmitLock();
    expect(lock.tryAcquire()).toBe(true);
    lock.release();
    expect(lock.isLocked()).toBe(false);
    expect(lock.tryAcquire()).toBe(true);
  });
});
