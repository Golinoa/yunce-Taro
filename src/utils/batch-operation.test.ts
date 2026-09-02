/**
 * createOperationLock 并发锁测试（L-04）
 *
 * 验收口径：
 * - 快速连点同一操作：仅执行一次任务，后续调用直接返回 undefined（不产生新请求）
 * - 任务无论成败都释放锁，失败后可重试成功
 * - isLocked 反映真实占用状态
 */
import { describe, expect, it, vi } from 'vitest';
import { createOperationLock } from '@/utils/batch-operation';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('createOperationLock', () => {
  it('并发调用仅执行一次任务：第二个 run 直接返回 undefined', async () => {
    const lock = createOperationLock();
    const task = vi.fn().mockImplementation(async () => {
      await delay(30);
      return 'ok';
    });

    const first = lock.run('restore-lesson', task);
    const second = await lock.run('restore-lesson', task);

    expect(second).toBeUndefined();
    expect(task).toHaveBeenCalledTimes(1);
    await expect(first).resolves.toBe('ok');
  });

  it('不同 key 共用同一把锁：仍只允许一个任务执行', async () => {
    const lock = createOperationLock();
    const task = vi.fn().mockImplementation(async () => {
      await delay(30);
      return 'ok';
    });

    const first = lock.run('restore-lesson', task);
    const second = await lock.run('suspend-lesson', task);

    expect(second).toBeUndefined();
    expect(task).toHaveBeenCalledTimes(1);
    await first;
  });

  it('任务完成后锁释放：可再次执行', async () => {
    const lock = createOperationLock();
    const task = vi.fn().mockResolvedValue('ok');

    await lock.run('restore-lesson', task);
    expect(lock.isLocked()).toBe(false);
    await expect(lock.run('restore-lesson', task)).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('任务失败后锁释放：可重试成功', async () => {
    const lock = createOperationLock();
    const task = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce('ok');

    await expect(lock.run('restore-lesson', task)).rejects.toThrow('network down');
    expect(lock.isLocked()).toBe(false);
    await expect(lock.run('restore-lesson', task)).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('锁占用时 isLocked 为 true', async () => {
    const lock = createOperationLock();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const pending = lock.run('op', async () => {
      await gate;
      return 'done';
    });

    expect(lock.isLocked()).toBe(true);
    release();
    await pending;
    expect(lock.isLocked()).toBe(false);
  });
});
