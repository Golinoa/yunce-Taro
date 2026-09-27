/**
 * 学员详情首屏缓存单测：读写命中、作用域隔离、写后失效
 *
 * 关键回归点：`setRefreshSignal(REFRESH_SIGNAL.students)`（编辑/录入/退费/转校等写操作）
 * 必须连带失效本域 —— 否则下次冷进入会先显示旧值。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_FLAGS } from '@/constants/cache-flags';
import { useCampusStore } from '@/stores/campus';
import { REFRESH_SIGNAL, consumeRefreshSignal, setRefreshSignal } from '@/utils/refresh-signal';
import {
  invalidateStudentDetailCore,
  readStudentDetailCore,
  writeStudentDetailCore,
} from '@/utils/student-detail-core-cache';

const taroStub = vi.hoisted(() => {
  const map = new Map<string, unknown>();
  return {
    map,
    getStorageSync: (k: string) => map.get(k),
    setStorageSync: (k: string, v: unknown) => {
      map.set(k, v);
    },
    removeStorageSync: (k: string) => {
      map.delete(k);
    },
    getStorageInfoSync: () => ({ keys: Array.from(map.keys()), currentSize: 0 }),
  };
});

vi.mock('@tarojs/taro', () => ({ default: taroStub }));
vi.mock('@/utils/logger', () => ({ logError: vi.fn() }));

const PROFILE_KEY = 'yunce-edu-user-profile';

function loginAs(campusId: string) {
  taroStub.map.set(
    PROFILE_KEY,
    JSON.stringify({
      id: 'user-1',
      currentContext: { organizationId: 'org-1', role: 'teacher' },
    }),
  );
  useCampusStore.setState({ currentCampusId: campusId });
}

const core = {
  student: { id: 'stu-1', name: '小明' } as never,
  parents: [] as never[],
};

describe('student-detail-core-cache', () => {
  beforeEach(() => {
    taroStub.map.clear();
    CACHE_FLAGS.cacheEnabled = true;
    loginAs('campus-a');
  });

  it('写入后可同步读到（第二次点开的即时渲染来源）', () => {
    writeStudentDetailCore('stu-1', core);
    expect(readStudentDetailCore('stu-1')?.student).toEqual(core.student);
  });

  it('未写入 / 空 id 返回 null（不误命中）', () => {
    expect(readStudentDetailCore('stu-1')).toBeNull();
    writeStudentDetailCore('stu-1', core);
    expect(readStudentDetailCore('')).toBeNull();
  });

  it('不同校区读不到彼此的数据（四维作用域隔离）', () => {
    writeStudentDetailCore('stu-1', core);
    loginAs('campus-b');
    expect(readStudentDetailCore('stu-1')).toBeNull();
  });

  it('缓存开关关闭时读写空转（G6 回退不靠 revert）', () => {
    CACHE_FLAGS.cacheEnabled = false;
    writeStudentDetailCore('stu-1', core);
    expect(readStudentDetailCore('stu-1')).toBeNull();
  });

  it('按学员失效只清该学员', () => {
    writeStudentDetailCore('stu-1', core);
    writeStudentDetailCore('stu-2', core);
    invalidateStudentDetailCore('stu-1');
    expect(readStudentDetailCore('stu-1')).toBeNull();
    expect(readStudentDetailCore('stu-2')).not.toBeNull();
  });

  it('存在待刷新写操作信号时不返回缓存（避免闪旧值），信号被消费后恢复命中', () => {
    writeStudentDetailCore('stu-1', core);
    expect(readStudentDetailCore('stu-1')).not.toBeNull();

    setRefreshSignal(REFRESH_SIGNAL.students);
    expect(readStudentDetailCore('stu-1')).toBeNull();

    consumeRefreshSignal(REFRESH_SIGNAL.students);
    expect(readStudentDetailCore('stu-1')).not.toBeNull();
  });

  it('其他域的刷新信号不影响本缓存', () => {
    writeStudentDetailCore('stu-1', core);
    setRefreshSignal(REFRESH_SIGNAL.schedule);
    expect(readStudentDetailCore('stu-1')).not.toBeNull();
  });
});
