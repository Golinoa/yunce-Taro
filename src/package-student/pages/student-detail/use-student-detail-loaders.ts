/**
 * 学员详情数据加载（2026-09-27 性能重构：分层加载 + 按需懒加载 + 信号驱动刷新）
 *
 * 旧实现的问题（实测"进详情页很慢"的根因）：
 * 1. 进页一次性并行拉 7 个接口、流水再串行补 1 个 ⇒ 首屏要等**最慢**的那个；
 * 2. 5 个 tab 的数据全部预载，用户往往只看 1-2 个；
 * 3. `useDidShow` 每次显示都全量重拉 —— 从任何子页返回都重复 8 个请求。
 *
 * 新设计：
 * - **首屏（阻塞）**只拉 student + parents（默认资料 tab 所需），毫秒级出页面；
 * - **其余 tab 懒加载**：切到哪个 tab 拉哪个，已加载过不重复拉；
 * - **动态更新**：`useDidShow` 只在消费到 `REFRESH_SIGNAL.students`（编辑/录入/退费等
 *   写操作设置）时才**后台静默**刷新——旧数据保持显示，回来即更新，不闪 loading；
 * - `loadData()` 保留为全量刷新入口（错误重试 / 写操作后），有数据时走后台模式。
 */
import Taro, { useDidShow } from '@tarojs/taro';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { studentService, lessonRecordService, leaveService } from '@/services';
import { followRecordService } from '@/services/follow-record';
import { memberCardService } from '@/services/member-card';
import type { FollowRecord } from '@/types/follow-record';
import type { LeaveRequest } from '@/types/leave-request';
import type { LessonRecord } from '@/types/lesson-record';
import type { MemberCardDetail } from '@/types/member-card';
import type { Student, StudentParent } from '@/types/student';
import { logError } from '@/utils/logger';
import { REFRESH_SIGNAL, consumeRefreshSignal } from '@/utils/refresh-signal';
import { writeStudentDetailCore } from '@/utils/student-detail-core-cache';

export type StudentDetailSlice = 'profile' | 'packages' | 'records' | 'follow';

export interface UseStudentDetailLoadersParams {
  studentId: string;
  /**
   * 首屏核心数据是否已命中本地缓存（页面用 `readStudentDetailCore` 同步初始化）。
   * 命中时：已有内容可渲染 ⇒ **不置全屏 loading**，改为后台静默刷新（stale-while-revalidate）。
   */
  hasCachedCore: boolean;
  setStudent: Dispatch<SetStateAction<Student | null>>;
  setRecords: Dispatch<SetStateAction<LessonRecord[]>>;
  setLeaves: Dispatch<SetStateAction<LeaveRequest[]>>;
  setMemberCards: Dispatch<SetStateAction<MemberCardDetail[]>>;
  setFollowRecords: Dispatch<SetStateAction<FollowRecord[]>>;
  setParents: Dispatch<SetStateAction<StudentParent[]>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setLoadError: Dispatch<SetStateAction<string>>;
  setNotFound: Dispatch<SetStateAction<boolean>>;
}

export function useStudentDetailLoaders(params: UseStudentDetailLoadersParams) {
  const {
    studentId,
    hasCachedCore,
    setStudent,
    setRecords,
    setLeaves,
    setMemberCards,
    setFollowRecords,
    setParents,
    setLoading,
    setLoadError,
    setNotFound,
  } = params;

  /** 各 tab 的独立加载态（首屏阻塞 loading 之外，切片用轻量加载提示） */
  const [sliceLoading, setSliceLoading] = useState<Record<StudentDetailSlice, boolean>>({
    profile: false,
    packages: false,
    records: false,
    follow: false,
  });

  const bootedRef = useRef(false);
  /** 命中缓存时视为核心已就绪（失败也不该清空页面/报错页，交给后台刷新兜底） */
  const coreLoadedRef = useRef(hasCachedCore);
  /** 已加载过数据的切片：刷新时只刷这些，未打开过的 tab 不浪费请求 */
  const loadedSlicesRef = useRef<Set<StudentDetailSlice>>(
    hasCachedCore ? new Set<StudentDetailSlice>(['profile']) : new Set<StudentDetailSlice>(),
  );
  const sliceLoadingRef = useRef(sliceLoading);
  useEffect(() => {
    sliceLoadingRef.current = sliceLoading;
  }, [sliceLoading]);

  const setSliceBusy = useCallback((slice: StudentDetailSlice, busy: boolean) => {
    setSliceLoading((prev) => ({ ...prev, [slice]: busy }));
  }, []);

  /** 清空全部数据（404 / 首次失败时） */
  const resetAll = useCallback(() => {
    setStudent(null);
    setRecords([]);
    setLeaves([]);
    setMemberCards([]);
    setFollowRecords([]);
    setParents([]);
  }, [setFollowRecords, setLeaves, setMemberCards, setParents, setRecords, setStudent]);

  /** 首屏核心：student + parents（资料 tab 所需），阻塞首屏渲染 */
  const fetchCore = useCallback(
    async (background: boolean): Promise<boolean> => {
      if (!studentId) {
        resetAll();
        setNotFound(true);
        return false;
      }
      try {
        const [stu, parentList] = await Promise.all([
          studentService.getById(studentId),
          studentService.getParents(studentId),
        ]);
        if (!stu) {
          // 已有数据（含缓存命中/后台刷新）时不清空：`getById` 吞掉网络错误后返回 null，
          // 若在此无条件 reset 会把已渲染的页面清成「未找到该学员」。仅从未加载成功过才判未找到。
          if (!coreLoadedRef.current) {
            resetAll();
            setNotFound(true);
          }
          return coreLoadedRef.current;
        }
        setStudent(stu);
        setParents(parentList);
        // 回填首屏缓存：下次点开可同步渲染（第二次及以后不再出现 loading）
        writeStudentDetailCore(studentId, { student: stu, parents: parentList });
        coreLoadedRef.current = true;
        loadedSlicesRef.current.add('profile');
        setNotFound(false);
        setLoadError('');
        return true;
      } catch (error) {
        logError('StudentDetail fetchCore', error);
        // 后台刷新失败：保留旧数据（stale-while-revalidate）；仅在从未加载成功过时才报错页
        if (!coreLoadedRef.current) {
          resetAll();
          setLoadError('学员详情加载失败，请稍后重试');
        }
        return coreLoadedRef.current;
      } finally {
        if (!background) setLoading(false);
      }
    },
    [resetAll, setLoadError, setNotFound, setParents, setLoading, setStudent, studentId],
  );

  /** 单个切片拉取（切片内部接口并行；不依赖其它切片） */
  const fetchSlice = useCallback(
    async (slice: StudentDetailSlice): Promise<void> => {
      if (!studentId) return;
      setSliceBusy(slice, true);
      try {
        switch (slice) {
          case 'profile': {
            // student 在 core 已加载，资料切片只需家长
            setParents(await studentService.getParents(studentId));
            break;
          }
          case 'packages': {
            setMemberCards(await memberCardService.getByStudent(studentId));
            break;
          }
          case 'records': {
            const [recs, lvs] = await Promise.all([
              lessonRecordService.getByStudent(studentId),
              leaveService.getByStudent(studentId),
            ]);
            setRecords(recs);
            setLeaves(lvs);
            break;
          }
          case 'follow': {
            setFollowRecords(await followRecordService.getByStudent(studentId));
            break;
          }
        }
        loadedSlicesRef.current.add(slice);
      } catch (error) {
        logError(`StudentDetail fetchSlice(${slice})`, error);
        // 后台刷新失败保留旧数据；首次加载失败给一条可感知的提示（面板自身展示空态）
        if (!loadedSlicesRef.current.has(slice)) {
          Taro.showToast({ title: '数据加载失败，可下拉或切回重试', icon: 'none' });
        }
      } finally {
        setSliceBusy(slice, false);
      }
    },
    [setFollowRecords, setLeaves, setMemberCards, setParents, setRecords, setSliceBusy, studentId],
  );

  /** 首次进入：无缓存时核心数据阻塞加载（骨架屏只等 student+parents）；有缓存则后台静默刷新 */
  const boot = useCallback(async () => {
    if (bootedRef.current) return;
    if (!studentId) {
      // 缺 id：明确落"未找到"，否则骨架屏会一直转（原实现会停在全屏 loading）
      bootedRef.current = true;
      setLoading(false);
      setNotFound(true);
      return;
    }
    bootedRef.current = true;
    // 命中缓存：页面已同步渲染出内容 ⇒ 不置全屏 loading，只做后台刷新（失败保留旧数据）
    if (coreLoadedRef.current) {
      await fetchCore(true);
      return;
    }
    setLoading(true);
    setLoadError('');
    setNotFound(false);
    await fetchCore(false);
  }, [fetchCore, setLoading, setLoadError, setNotFound, studentId]);

  /** 切换 tab：懒加载该切片（已加载过则跳过） */
  const loadTab = useCallback(
    (slice: StudentDetailSlice) => {
      if (loadedSlicesRef.current.has(slice) || sliceLoadingRef.current[slice]) return;
      if (!coreLoadedRef.current) return; // core 未就绪时不抢跑
      void fetchSlice(slice);
    },
    [fetchSlice],
  );

  /**
   * 全量刷新（兼容旧入口：错误重试 / 推荐人更新 / 期初录入后）。
   * 已有数据时走**后台静默**刷新：不置全屏 loading、失败保留旧数据。
   */
  const loadData = useCallback(async () => {
    if (!bootedRef.current) {
      await boot();
      return;
    }
    const background = coreLoadedRef.current;
    const ok = await fetchCore(background);
    if (!ok) return;
    const slices = Array.from(loadedSlicesRef.current);
    await Promise.all(slices.map((slice) => fetchSlice(slice)));
  }, [boot, fetchCore, fetchSlice]);

  const loadDataRef = useRef(loadData);
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  // 挂载即 boot（useDidShow 首次触发也会走 boot，bootedRef 双重保险）
  useEffect(() => {
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  /**
   * 动态更新：再次显示页面时**不再全量重拉**。
   * 只有当存在 `REFRESH_SIGNAL.students` 信号（编辑学员 / 录入课时 / 退费等写操作
   * 返回时设置）才后台刷新核心 + 已打开过的切片；旧数据全程保持显示。
   */
  useDidShow(() => {
    if (!bootedRef.current) {
      void loadDataRef.current();
      return;
    }
    if (consumeRefreshSignal(REFRESH_SIGNAL.students)) {
      void loadDataRef.current();
    }
  });

  return { loadData, loadTab, sliceLoading };
}
