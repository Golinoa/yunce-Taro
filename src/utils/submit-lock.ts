/**
 * 同步提交锁：防止 React setState 异步间隙内连点双提交（消课/点名等资损路径）。
 */
export interface SubmitLock {
  /** 尝试占锁；已占用返回 false */
  tryAcquire: () => boolean;
  release: () => void;
  isLocked: () => boolean;
}

export function createSubmitLock(): SubmitLock {
  let locked = false;
  return {
    tryAcquire: () => {
      if (locked) return false;
      locked = true;
      return true;
    },
    release: () => {
      locked = false;
    },
    isLocked: () => locked,
  };
}
