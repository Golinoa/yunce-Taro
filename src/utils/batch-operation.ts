/**
 * 批量操作并发锁（L-04）
 *
 * 背景：课表页批量操作（恢复开课 / 停课 / 取消开课等）在 Taro.showModal 确认后
 * 直接发起网络请求，无执行中状态保护——用户快速连点会并发发送重复请求。
 *
 * createOperationLock 提供进程内互斥：
 * - run(key, task)：已有任务执行中时直接返回 undefined（忽略新请求，不产生重复请求）
 * - 任务无论成败都会在 finally 释放锁，失败后用户可重试
 *
 * 页面用法：const lockRef = useRef(createOperationLock())，多个 handler 共享同一把锁。
 */
export interface OperationLock {
  /** 当前是否有任务执行中 */
  isLocked(): boolean;
  /**
   * 执行任务；锁被占用时返回 undefined，否则返回任务结果。
   * 多个操作共用同一把锁（同一时刻只允许一个批量操作在执行）。
   */
  run<T>(key: string, task: () => Promise<T>): Promise<T | undefined>;
}

export function createOperationLock(): OperationLock {
  let currentKey: string | null = null;

  return {
    isLocked: () => currentKey !== null,
    run: async <T>(key: string, task: () => Promise<T>): Promise<T | undefined> => {
      if (currentKey !== null) {
        return undefined;
      }
      currentKey = key;
      try {
        return await task();
      } finally {
        currentKey = null;
      }
    },
  };
}
