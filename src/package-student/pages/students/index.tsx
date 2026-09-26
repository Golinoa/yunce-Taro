import { View, Text, Input, Button, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Dialog from '@/components/Dialog';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import LeadCard from '@/components/lead/LeadCard';
import MemberActionSheet from '@/components/student/MemberActionSheet';
import StudentAvatar from '@/components/student/StudentAvatar';
import { LEAD_FILTER_TAB_OPTIONS } from '@/constants/lead';
import { useCurrentCampusId } from '@/hooks/use-current-campus-id';
import LegacyPackagesEditor from '@/package-student/components/LegacyPackagesEditor';
import { campusService } from '@/services/campus';
import { studentService } from '@/services/student';
import { useLeadStore } from '@/stores/lead';
import type { LeadFilterTab } from '@/types/lead';
import type { Student, StudentSort, PackageTag } from '@/types/student';
import { SORT_OPTIONS } from '@/types/student';
import { syncAlertThresholdFromCampus } from '@/utils/alert-config';
import { isStaffRole, useAuth } from '@/utils/auth';
import { TTL } from '@/utils/data-freshness';
import {
  getStudentCardStatus,
  getCardBorderColorClass,
  getProgressGradientClass,
  getHoursColorClass,
  calcStudentProgress,
  generatePackageTags,
} from '@/utils/hours-status';
import { reportLocalDebug } from '@/utils/local-debug';
import { logError } from '@/utils/logger';
import { useThemedNavigationBar } from '@/utils/navigation-bar';
import { API_PAGE_SIZE_BATCH } from '@/utils/pagination';
import { consumeRefreshSignal, REFRESH_SIGNAL } from '@/utils/refresh-signal';
import { withRouteGuard } from '@/utils/route-guard';
import { filterActiveStudents } from '@/utils/student-visibility';
import { useBatchRender } from '@/utils/use-batch-render';
import { resolveStudentQueryGate } from './students-query-gate';

reportLocalDebug({
  hypothesisId: 'students-module-loaded',
  location: 'students/index.tsx:module',
  msg: '学员页面模块已加载',
  data: { path: '/package-student/pages/students/index' },
});

/** 顶部 Tab 类型 */
type MainTab = 'member' | 'lead';

/** 学员子筛选 Tab */
type MemberSubTab =
  | 'all'
  | 'active'
  | 'private'
  | 'renew'
  | 'silent'
  | 'frozen'
  | 'birthday'
  | 'lost';

/** 学员子筛选选项（减轻视觉权重） */
const MEMBER_SUB_TAB_OPTIONS: { key: MemberSubTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '在籍' },
  { key: 'private', label: '私教' },
  { key: 'renew', label: '续卡' },
  { key: 'silent', label: '沉默' },
  { key: 'frozen', label: '冻卡' },
  { key: 'birthday', label: '生日' },
  { key: 'lost', label: '流失' },
];

/** 计算学生剩余课时汇总 */
function calcRemainingHours(packages?: Student['course_packages']): number {
  if (!packages) return 0;
  return packages.reduce((sum, p) => sum + (p.remaining_hours || 0), 0);
}

/** 课包标签颜色映射（使用 UnoCSS Token 类名） */
const TAG_COLOR_MAP: Record<PackageTag['color'], { bg: string; text: string }> = {
  primary: { bg: 'bg-success-bg', text: 'text-success' },
  amber: { bg: 'bg-warning-bg', text: 'text-amber' },
  danger: { bg: 'bg-destructive-5', text: 'text-destructive' },
  purple: { bg: 'bg-accent-bg', text: 'text-accent' },
  accent: { bg: 'bg-primary-bg', text: 'text-primary' },
  info: { bg: 'bg-info-bg', text: 'text-info' },
};

const Students: React.FC = () => {
  const { profile, session, loading: authLoading } = useAuth();
  const currentRole = profile?.currentContext?.role;
  const isTeacher = isStaffRole(currentRole);
  /** 校区数据源统一（2026-09-24）：全站统一入口，选中校区优先、身份校区兜底 */
  const effectiveCampusId = useCurrentCampusId();

  // 导航栏与「我的」/数据页同款弥散渐变顶部色无缝衔接
  useThemedNavigationBar((themeHex) => ({
    backgroundColor: themeHex.primarySoftBg,
    frontColor: '#000000',
  }));

  // ====== 主 Tab 状态 ======
  const [mainTab, setMainTab] = useState<MainTab>('member');

  // ====== 学员 Tab 状态 ======
  const [students, setStudents] = useState<Student[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<StudentSort>('default');
  const [memberSubTab, setMemberSubTab] = useState<MemberSubTab>('all');
  const [sortOpen, setSortOpen] = useState(false);
  // 会话 token 恢复可能早于 /auth/me 的 Profile 恢复。
  // 此时不能把 session.user 当成已经确定的家长/教职工身份，否则
  // query 会先按 parent 分支请求并缓存空列表，随后遮住真实的教职工列表。
  const { actorId, enabled: canLoadStudents } = resolveStudentQueryGate({
    profileId: profile?.id,
    sessionUserId: session?.user.id,
    role: currentRole,
  });

  useEffect(() => {
    reportLocalDebug({
      hypothesisId: 'students-query-gate',
      location: 'students/index.tsx:students-state',
      msg: '学员页已挂载并计算列表请求条件',
      data: {
        authLoading,
        hasProfile: Boolean(profile),
        profileId: actorId || null,
        role: currentRole || null,
        campusId: effectiveCampusId || null,
        canLoadStudents,
      },
    });
  }, [authLoading, actorId, currentRole, profile, canLoadStudents, effectiveCampusId]);

  /**
   * P0 诊断：`queryFnRuns=0` 证明 queryFn 从未执行 —— query 在 `fetch()` 标记 fetching 之后、
   * 调用 queryFn 之前被 cancel。TanStack Query v5 中 cancel 只有两个来源：
   *   ① 该 query 的最后一个 observer 被移除（即本组件卸载）
   *   ② enabled 翻转导致 observer 重新订阅 in-flight query
   * 下面把这两个来源都记进日志，一次运行即可判定是哪一个。
   */
  const canLoadStudentsRef = useRef(canLoadStudents);
  useEffect(() => {
    reportLocalDebug({
      hypothesisId: 'students-lifecycle',
      location: 'students/index.tsx:mount',
      msg: '学员页组件已挂载',
      data: { canLoadStudents },
    });
    return () => {
      reportLocalDebug({
        hypothesisId: 'students-lifecycle',
        location: 'students/index.tsx:unmount',
        msg: '学员页组件已卸载（会使 in-flight query 被 cancel）',
        data: { canLoadStudents },
      });
    };
    // 只关心挂载/卸载本身
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (canLoadStudentsRef.current !== canLoadStudents) {
      reportLocalDebug({
        hypothesisId: 'students-lifecycle',
        location: 'students/index.tsx:enabled-flip',
        msg: `canLoadStudents 翻转 ${canLoadStudentsRef.current} -> ${canLoadStudents}（enabled 翻转会 cancel in-flight fetch）`,
        data: {
          from: canLoadStudentsRef.current,
          to: canLoadStudents,
          actorId: actorId || null,
        },
      });
      canLoadStudentsRef.current = canLoadStudents;
    }
  }, [canLoadStudents, actorId]);

  // 搜索防抖必须参与分页 query key，搜索条件变化时从第一页重新加载。
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedKeyword(keyword), 300);
    return () => clearTimeout(debounceTimer.current);
  }, [keyword]);

  const queryClient = useQueryClient();
  /**
   * 学员列表接入 TanStack Query（B9-1）：
   * 原走 useStudentStore（TTL.list=5min）手写缓存；现统一到与首页（B8）一致的缓存层，
   * 由 query 拥有缓存 / 去重 / 写后失效。queryKey 包含角色、profile、校区和搜索条件，staleTime 沿用 TTL.list。
   */
  // queryKey 一旦在首帧内抖动，TanStack Query 会取消旧 query 并重建，
  // queryFn 就永远没机会执行（表现为列表空白且后端完全没有 /students）。
  // 故把 key 提取为变量并打进日志，用于判定取消是否由 key 抖动引起。
  const studentsQueryKey = [
    'students',
    isTeacher ? 'teacher' : 'parent',
    actorId,
    effectiveCampusId,
    debouncedKeyword.trim(),
  ];
  const queryFnRunsRef = useRef(0);
  const studentsQuery = useInfiniteQuery({
    queryKey: studentsQueryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      queryFnRunsRef.current += 1;
      reportLocalDebug({
        hypothesisId: 'students-query-start',
        location: 'students/index.tsx:queryFn',
        msg: '学员列表 queryFn 已开始执行',
        data: {
          role: currentRole || null,
          actorId: actorId || null,
          campusId: effectiveCampusId || null,
          keyword: debouncedKeyword,
          pageParam,
        },
      });
      if (!actorId) {
        return Promise.resolve({
          list: [],
          pagination: { page: 1, pageSize: API_PAGE_SIZE_BATCH, total: 0, totalPages: 0 },
        });
      }
      return isTeacher
        ? studentService.getPageByTeacher(
            actorId,
            pageParam,
            API_PAGE_SIZE_BATCH,
            effectiveCampusId,
            debouncedKeyword,
          )
        : studentService.getPageByParent(actorId, pageParam, API_PAGE_SIZE_BATCH, debouncedKeyword);
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
    // 这里刻意不设 `enabled`。
    // `enabled` 依赖推导值（actorId 由 profile/session 推导）会在首帧波动，
    // 而 v5 中 enabled 翻转会让 observer 重新订阅 in-flight query 并使其被 cancel；
    // 表现就是 fetchStatus 从 fetching 掉回 idle、queryFn 一次都没执行（queryFnRuns=0）、
    // 列表永久空白且后端收不到任何 /students。
    // queryFn 内部已有 `if (!actorId) return 空列表` 兜底，且 queryKey 含 actorId，
    // profile 恢复后 actorId 变化会自然产生新 query 重新拉取，无需 enabled 把关。
    // 进入独立页面时强制确认一次首屏数据，避免旧的空缓存掩盖真实学员。
    refetchOnMount: 'always',
    staleTime: TTL.list,
  });

  // 用 ref 持有最新的 query 对象与 queryKey：两者每次渲染都是新引用，若写进 effect 依赖
  // 会让 effect 每渲染重跑（自伤）；v5 的 useInfiniteQuery result 也不暴露 queryKey，故单独存。
  const studentsQueryRef = useRef(studentsQuery);
  studentsQueryRef.current = studentsQuery;
  const studentsQueryKeyRef = useRef(studentsQueryKey);
  studentsQueryKeyRef.current = studentsQueryKey;

  useEffect(() => {
    reportLocalDebug({
      hypothesisId: 'students-query-result',
      location: 'students/index.tsx:query-result',
      msg: '学员列表 query 状态发生变化',
      data: {
        status: studentsQuery.status,
        fetchStatus: studentsQuery.fetchStatus,
        isError: studentsQuery.isError,
        error: studentsQuery.error instanceof Error ? studentsQuery.error.message : null,
        pageCount: studentsQuery.data?.pages.length || 0,
        queryKey: JSON.stringify(studentsQueryKeyRef.current),
        queryFnRuns: queryFnRunsRef.current,
        // v5 在「signal 已被消费(#abortSignalConsumed) 且 observers 归零」时，会对 in-flight
        // fetch 执行 cancel({ revert: true }) 并【不重发】，query 永久停在 pending/idle、
        // queryFn 一次都不执行。observers 数量是判定是否命中该路径的关键证据。
        observerCount:
          queryClient
            .getQueryCache()
            .find({ queryKey: studentsQueryKeyRef.current })
            ?.getObserversCount?.() ?? -1,
        studentCount:
          studentsQuery.data?.pages.reduce((sum, page) => sum + page.list.length, 0) || 0,
      },
    });
  }, [
    studentsQuery.status,
    studentsQuery.fetchStatus,
    studentsQuery.isError,
    studentsQuery.error,
    studentsQuery.data,
    queryClient,
  ]);

  /**
   * P0 兜底（安全网）：query 卡死在 `status='pending' + fetchStatus='idle'` 时主动补拉。
   *
   * 根因已定位并修复：微信小程序运行时缺 `AbortController`，而 `@tanstack/query-core` 的
   * `Query.fetch()` 第一行就是 `new AbortController()`，缺失会直接抛 `ReferenceError`，
   * 使 `queryFn` 永不执行、fetchStatus 永久停在 idle（见 `src/utils/abort-controller-polyfill.ts`，
   * 已在 `src/app.tsx` 首行 import 修复）。
   *
   * 这里保留兜底而非删掉，是因为该状态「既不报错也不重试」——一旦再次出现就是永久空白。
   * 最多补拉 1 次；仍停滞则脱离 query 状态机直接走 service 拉首屏写入缓存，保证列表可用。
   */
  const stallRecoveryRef = useRef(0);
  const directFetchRef = useRef<() => Promise<unknown>>(async () => null);
  directFetchRef.current = async () => {
    if (!actorId) return null;
    return isTeacher
      ? studentService.getPageByTeacher(
          actorId,
          1,
          API_PAGE_SIZE_BATCH,
          effectiveCampusId,
          debouncedKeyword,
        )
      : studentService.getPageByParent(actorId, 1, API_PAGE_SIZE_BATCH, debouncedKeyword);
  };

  useEffect(() => {
    const stalled = studentsQuery.status === 'pending' && studentsQuery.fetchStatus === 'idle';
    if (!stalled) {
      stallRecoveryRef.current = 0;
      return;
    }
    const tick = () => {
      if (stallRecoveryRef.current >= 2) {
        return;
      }
      stallRecoveryRef.current += 1;
      const attempt = stallRecoveryRef.current;
      const key = studentsQueryKeyRef.current;
      reportLocalDebug({
        hypothesisId: 'students-query-stall',
        location: 'students/index.tsx:stall-recovery',
        msg: `检测到 query 停滞(pending/idle)，补拉第 ${attempt} 次`,
        data: {
          attempt,
          queryFnRuns: queryFnRunsRef.current,
          observerCount:
            queryClient.getQueryCache().find({ queryKey: key })?.getObserversCount?.() ?? -1,
          // 复发时用它一眼分辨两种机制：
          // false → AbortController 缺失（polyfill 未生效）
          // true  → AbortController 正常，说明是「cancel 早于 queryFn → signal 已 abort →
          //          infinite fetchFn 直接跳过 queryFn」这条路径（靠下面的兜底直取救场）
          hasAbortController: typeof AbortController !== 'undefined',
          queryKey: JSON.stringify(key),
        },
      });
      if (attempt === 1) {
        void studentsQueryRef.current.refetch();
        return;
      }
      // 第 2 次仍停滞：状态机确实不可用，直接拉数写缓存，避免永久空白。
      void directFetchRef
        .current()
        .then((page) => {
          if (!page) return;
          queryClient.setQueryData(key, () => ({ pages: [page], pageParams: [1] }) as never);
          reportLocalDebug({
            hypothesisId: 'students-direct-fallback',
            location: 'students/index.tsx:direct-fallback',
            msg: 'query 状态机不可用，改为直接拉数写入缓存',
            data: {
              attempt,
              count: (page as { list?: unknown[] }).list?.length ?? -1,
              queryFnRuns: queryFnRunsRef.current,
            },
          });
        })
        .catch((err: unknown) => {
          reportLocalDebug({
            hypothesisId: 'students-direct-fallback',
            location: 'students/index.tsx:direct-fallback',
            msg: '兜底直取也失败',
            data: { attempt, errMessage: String(err) },
          });
        });
    };

    const timer = setTimeout(tick, 600);
    const interval = setInterval(tick, 2000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [studentsQuery.status, studentsQuery.fetchStatus, queryClient]);

  // 软删除（后端 status → INACTIVE）的学员后端仍会返回，必须在这里剔除，
  // 否则删除后列表依旧显示该学员。判定口径统一走 filterActiveStudents。
  const pagedStudents = useMemo(
    () => filterActiveStudents(studentsQuery.data?.pages.flatMap((page) => page.list) ?? []),
    [studentsQuery.data],
  );
  useEffect(() => {
    setStudents(pagedStudents);
  }, [pagedStudents]);
  useEffect(() => {
    setLoading(studentsQuery.isFetching);
  }, [studentsQuery.isFetching]);

  // 同步当前校区课时预警阈值（卡片黄标依赖）
  useEffect(() => {
    const campusId = effectiveCampusId;
    if (!campusId) return;
    void campusService
      .getById(campusId)
      .then((campus) => {
        if (campus) {
          syncAlertThresholdFromCampus({
            hoursAlertThreshold: campus.hoursAlertThreshold,
            daysAlertThreshold: campus.daysAlertThreshold,
            amountAlertThreshold: campus.amountAlertThreshold,
          });
        }
      })
      .catch((err) => logError('sync alert threshold', err));
  }, [effectiveCampusId]);

  // ====== 线索 Tab 状态 ======
  const teacherId = session?.user.id || '';
  const {
    cache: leadCache,
    loading: leadLoading,
    activeFilterTab,
    fetchCards,
    fetchSummary,
    setActiveFilterTab,
    invalidate,
  } = useLeadStore();

  // 当前 tab 的缓存 key（L2：含校区，与 store 内 key 规则一致）
  const leadCacheKey = `${teacherId}::${effectiveCampusId || 'all'}::${activeFilterTab}`;
  const leadList = useMemo(() => leadCache[leadCacheKey] || [], [leadCache, leadCacheKey]);
  const isLeadLoading = leadLoading[leadCacheKey];

  // 加载线索数据（L3：显式传当前校区）
  const loadLeads = useCallback(async () => {
    if (!teacherId) return;
    fetchCards(teacherId, activeFilterTab, false, effectiveCampusId);
    fetchSummary(teacherId);
  }, [teacherId, activeFilterTab, fetchCards, fetchSummary, effectiveCampusId]);

  // 切校区后按新校区重拉线索（学员列表靠 queryKey 自动重拉，线索走 store 缓存需显式触发）
  useEffect(() => {
    if (mainTab !== 'lead') return;
    loadLeads();
  }, [mainTab, loadLeads]);

  // ====== 公共生命周期 ======
  useDidShow(() => {
    if (mainTab === 'member') {
      const forceStudents = consumeRefreshSignal(REFRESH_SIGNAL.students);
      // 写后（student-form 已 emitRefreshSignal）：失效列表 query，触发刷新
      // 旧缓存可能是错误的空列表，空缓存也必须重新请求一次；已有数据不因每次进页重复拉取。
      if (forceStudents) {
        void queryClient.invalidateQueries({
          queryKey: ['students', isTeacher ? 'teacher' : 'parent', actorId],
        });
      } else if (
        actorId &&
        studentsQuery.status === 'success' &&
        students.length === 0 &&
        !studentsQuery.isFetching
      ) {
        // 只在「已有数据但为空」时补拉。首屏 pending 期间不要 refetch：
        // refetch 会取消 in-flight 的首屏 fetch，导致 queryFn 永远没机会执行
        // （列表空白 + 后端无任何 /students）。首屏强制刷新已由 refetchOnMount:'always' 保证。
        void studentsQuery.refetch();
      }
    } else {
      loadLeads();
    }
  });

  // 下拉刷新
  usePullDownRefresh(async () => {
    if (mainTab === 'member') {
      await queryClient.invalidateQueries({
        queryKey: ['students', isTeacher ? 'teacher' : 'parent', actorId],
      });
    } else {
      if (teacherId) {
        invalidate(teacherId);
        await Promise.all([
          fetchCards(teacherId, activeFilterTab, true),
          fetchSummary(teacherId, true),
        ]);
      }
    }
    Taro.stopPullDownRefresh();
  });

  // 关闭所有下拉
  const closeAllDropdowns = useCallback(() => {
    setSortOpen(false);
  }, []);

  // Tab 切换时清空搜索和子筛选
  const handleMainTabChange = useCallback(
    (tab: MainTab) => {
      setMainTab(tab);
      setKeyword('');
      setDebouncedKeyword('');
      setMemberSubTab('all');
      closeAllDropdowns();
      if (tab === 'lead') {
        loadLeads();
      }
    },
    [loadLeads, closeAllDropdowns],
  );

  // 学员子 Tab 切换
  const handleMemberSubTabChange = useCallback((tab: MemberSubTab) => {
    setMemberSubTab(tab);
  }, []);

  // 筛选 + 排序后的列表
  const filteredStudents = useMemo(() => {
    let result = [...students];

    // 搜索过滤
    if (debouncedKeyword) {
      const kw = debouncedKeyword.toLowerCase();
      result = result.filter(
        (s) => (s.name || '').toLowerCase().includes(kw) || (s.phone || '').includes(kw),
      );
    }

    // 学员子 Tab 筛选（基于现有数据做简化映射）
    if (memberSubTab !== 'all') {
      const today = dayjs();
      result = result.filter((s) => {
        const packages = s.course_packages || [];
        const hasActive = packages.some((p) => p.status === 'active');
        const hasFrozen = packages.some((p) => p.status === 'frozen');
        const cardStatus = getStudentCardStatus(s);
        const isBirthdayMonth = s.birthday ? dayjs(s.birthday).month() === today.month() : false;

        switch (memberSubTab) {
          case 'active':
            return hasActive;
          case 'private':
            // 私教课包：通过课包名称关键词识别（数据完善后可改用类型字段）
            return packages.some((p) => (p.name || '').includes('私教'));
          case 'renew':
            return cardStatus === 'low' || cardStatus === 'expiring' || cardStatus === 'owe';
          case 'silent':
            // 沉默学员：有有效课包且剩余课时较多（数据完善后可改用最近消课时间）
            return hasActive && calcRemainingHours(packages) >= 10;
          case 'frozen':
            return hasFrozen;
          case 'birthday':
            return isBirthdayMonth;
          case 'lost':
            return !hasActive && !hasFrozen;
          default:
            return true;
        }
      });
    }

    // 排序
    if (sortBy !== 'default') {
      result.sort((a, b) => {
        switch (sortBy) {
          case 'hours-desc':
            return calcRemainingHours(b.course_packages) - calcRemainingHours(a.course_packages);
          case 'hours-asc':
            return calcRemainingHours(a.course_packages) - calcRemainingHours(b.course_packages);
          case 'name-asc':
            return (a.name || '').localeCompare(b.name || '', 'zh');
          case 'name-desc':
            return (b.name || '').localeCompare(a.name || '', 'zh');
          default:
            return 0;
        }
      });
    }

    return result;
  }, [students, debouncedKeyword, memberSubTab, sortBy]);

  // ====== 分批渲染（P-02）：长列表首屏仅渲染前 50 条，上拉追加 ======
  const {
    visibleList: visibleStudents,
    hasMore: hasMoreRenderedStudents,
    onScrollToLower: onStudentsScrollToLower,
    reset: resetStudentBatch,
  } = useBatchRender(filteredStudents);
  // 筛选/搜索/排序变化时重置回首批（避免旧批次残留）
  useEffect(() => {
    resetStudentBatch();
  }, [debouncedKeyword, memberSubTab, sortBy, resetStudentBatch]);

  const hasMoreStudents = hasMoreRenderedStudents || studentsQuery.hasNextPage;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = studentsQuery;
  const onStudentsListScrollToLower = useCallback(() => {
    onStudentsScrollToLower();
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [onStudentsScrollToLower, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ====== 线索 Tab：搜索过滤 ======
  const filteredLeads = useMemo(() => {
    if (!debouncedKeyword) return leadList;
    const kw = debouncedKeyword.toLowerCase();
    return leadList.filter(
      (item) =>
        (item.child_name || '').toLowerCase().includes(kw) ||
        (item.parent_phone || '').includes(kw),
    );
  }, [leadList, debouncedKeyword]);

  // ====== 学员 Tab：下拉菜单 ======
  const goToDetail = (id: string) => {
    Taro.navigateTo({
      url: `/package-student/pages/student-detail/index?id=${encodeURIComponent(id)}`,
    });
  };

  const [memberActionVisible, setMemberActionVisible] = useState(false);

  // R1：老生历史课时录入（先选学员，再按科目录入）
  const [legacyVisible, setLegacyVisible] = useState(false);
  const [legacyStudentId, setLegacyStudentId] = useState('');
  const [legacyStudentName, setLegacyStudentName] = useState('');
  const [legacyQuery, setLegacyQuery] = useState('');
  const [legacyResults, setLegacyResults] = useState<Student[]>([]);
  const [legacySearching, setLegacySearching] = useState(false);

  const handleImportHistory = useCallback(() => {
    setLegacyStudentId('');
    setLegacyStudentName('');
    setLegacyQuery('');
    setLegacyResults([]);
    setLegacyVisible(true);
  }, []);

  const handleLegacySearch = useCallback(async () => {
    const legacyKeyword = legacyQuery.trim();
    if (!legacyKeyword) {
      Taro.showToast({ title: '请输入姓名或手机号', icon: 'none' });
      return;
    }
    setLegacySearching(true);
    try {
      const list = await studentService.search('', legacyKeyword);
      setLegacyResults(list.filter((item) => item.status !== 'deleted').slice(0, 8));
      if (list.length === 0) Taro.showToast({ title: '未找到学员', icon: 'none' });
    } catch {
      Taro.showToast({ title: '搜索失败，请重试', icon: 'none' });
    } finally {
      setLegacySearching(false);
    }
  }, [legacyQuery]);

  const handleLegacyPickStudent = useCallback((student: Student) => {
    setLegacyStudentId(student.id);
    setLegacyStudentName(student.name);
  }, []);

  const handleOpenMemberAction = useCallback(() => {
    setMemberActionVisible(true);
  }, []);

  const handleCloseMemberAction = useCallback(() => {
    setMemberActionVisible(false);
  }, []);

  const handleNewCard = useCallback(() => {
    Taro.navigateTo({ url: '/package-student/pages/student-form/index' });
  }, []);

  const handleBatchExtend = useCallback(() => {
    Taro.showToast({ title: '批量延期功能开发中', icon: 'none' });
  }, []);

  const handleBlacklist = useCallback(() => {
    Taro.showToast({ title: '门店黑名单功能开发中', icon: 'none' });
  }, []);

  const handleSortSelect = (value: StudentSort) => {
    setSortBy(value);
    setSortOpen(false);
  };

  const toggleSort = () => {
    const next = !sortOpen;
    closeAllDropdowns();
    setSortOpen(next);
  };

  // ====== 线索 Tab：事件处理 ======
  const handleLeadTabChange = useCallback(
    (tab: LeadFilterTab) => {
      setActiveFilterTab(tab);
      if (teacherId) {
        fetchCards(teacherId, tab);
      }
    },
    [teacherId, setActiveFilterTab, fetchCards],
  );

  const handleAddLead = useCallback(() => {
    Taro.navigateTo({ url: '/package-lead/pages/lead-form/index' });
  }, []);

  return (
    <View className="min-h-screen bg-background flex flex-col">
      {/* ====== 搜索栏紧贴原生导航（同「我的」/数据页弥散渐变） ====== */}
      <View className="bg-gradient-diffuse-top px-[32rpx] pt-[16rpx] pb-[20rpx] flex-shrink-0 relative overflow-hidden">
        <View className="flex items-center gap-[16rpx] relative z-10">
          <View className="flex-1 rounded-full px-[24rpx] py-[12rpx] flex items-center gap-[10rpx] bg-card/90 shadow-card">
            <Icon name="mdi-magnify" size={20} color="#9ca3af" />
            <Input
              className="flex-1 text-[26rpx] text-foreground"
              placeholder={mainTab === 'member' ? '搜索学员姓名或手机号' : '搜索线索姓名或手机号'}
              placeholderStyle="color:#9ca3af"
              value={keyword}
              onInput={(e) => setKeyword(e.detail.value || '')}
              confirmType="search"
            />
            {keyword && (
              <View
                className="w-[36rpx] h-[36rpx] rounded-full bg-muted center"
                onClick={() => setKeyword('')}
              >
                <Icon name="mdi-close" size="xxs" color="white" />
              </View>
            )}
          </View>
          {/* 排序 */}
          <View className="relative flex-shrink-0">
            <View
              className={cn(
                'flex items-center gap-[6rpx] px-[20rpx] py-[14rpx] rounded-full bg-card/80 shadow-card',
                sortBy !== 'default' ? 'text-primary font-semibold' : 'text-foreground-secondary',
              )}
              onClick={toggleSort}
            >
              <Text className="text-[24rpx]">
                {SORT_OPTIONS.find((o) => o.value === sortBy)?.label || '排序'}
              </Text>
              <Icon name="mdi-chevron-down" size={24} color="muted" />
            </View>
            {sortOpen && (
              <View className="absolute top-full right-0 mt-[12rpx] bg-white rounded-[24rpx] shadow-float py-[12rpx] min-w-[240rpx] z-100">
                {SORT_OPTIONS.map((opt) => (
                  <View
                    key={opt.value}
                    className={cn(
                      'flex items-center px-[24rpx] py-[20rpx] mx-[12rpx] rounded-[16rpx]',
                      sortBy === opt.value ? 'bg-primary-bg text-primary' : 'text-foreground',
                    )}
                    onClick={() => handleSortSelect(opt.value)}
                  >
                    <Text
                      className={cn(
                        'text-[26rpx] flex-1',
                        sortBy === opt.value ? 'font-semibold text-primary' : '',
                      )}
                    >
                      {opt.label}
                    </Text>
                    {sortBy === opt.value && <Icon name="mdi-check" size="xs" color="success" />}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ====== Tab 切换：学员 / 客资（白色背景区域） ====== */}
      <View className="bg-white flex-shrink-0 px-[32rpx] pt-[20rpx] pb-[16rpx]">
        <View className="flex justify-center">
          <View className="flex items-center gap-[8rpx] bg-muted/40 rounded-full p-[6rpx]">
            <View
              className={cn(
                'px-[48rpx] py-[12rpx] rounded-full',
                mainTab === 'member' ? 'bg-primary shadow-elegant' : '',
              )}
              onClick={() => handleMainTabChange('member')}
            >
              <Text
                className={cn(
                  'text-[28rpx] font-medium',
                  mainTab === 'member' ? 'text-white' : 'text-muted-foreground',
                )}
              >
                学员
              </Text>
            </View>
            <View
              className={cn(
                'px-[48rpx] py-[12rpx] rounded-full',
                mainTab === 'lead' ? 'bg-primary shadow-elegant' : '',
              )}
              onClick={() => handleMainTabChange('lead')}
            >
              <Text
                className={cn(
                  'text-[28rpx] font-medium',
                  mainTab === 'lead' ? 'text-white' : 'text-muted-foreground',
                )}
              >
                客资
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ====== 学员 Tab：轻量子筛选标签 + 统计 ====== */}
      {mainTab === 'member' && (
        <View className="bg-white flex-shrink-0">
          <ScrollView scrollX className="whitespace-nowrap px-[24rpx] pb-[16rpx]">
            <View className="inline-flex gap-[12rpx]">
              {MEMBER_SUB_TAB_OPTIONS.map((tab) => (
                <View
                  key={tab.key}
                  className={cn(
                    'px-[20rpx] py-[10rpx] rounded-full',
                    memberSubTab === tab.key
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted/50 text-muted-foreground',
                  )}
                  onClick={() => handleMemberSubTabChange(tab.key)}
                >
                  <Text
                    className={cn(
                      'text-[24rpx]',
                      memberSubTab === tab.key ? 'font-semibold text-primary' : 'font-medium',
                    )}
                  >
                    {tab.label}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <View className="px-[32rpx] pb-[16rpx]">
            <Text className="text-[24rpx] text-muted-foreground">
              共{' '}
              <Text className="text-[28rpx] font-bold text-foreground">
                {filteredStudents.length}
              </Text>{' '}
              位学员
            </Text>
          </View>
        </View>
      )}

      {/* ====== 线索 Tab：筛选标签（下划线样式，平均分布） ====== */}
      {mainTab === 'lead' && (
        <View className="px-[32rpx] pt-[24rpx] pb-[16rpx] flex-shrink-0 bg-white">
          <View className="flex">
            {LEAD_FILTER_TAB_OPTIONS.map((tab) => (
              <View
                key={tab.key}
                className="flex-1 relative pb-[12rpx] center"
                onClick={() => handleLeadTabChange(tab.key)}
              >
                <Text
                  className={cn(
                    'text-[28rpx]',
                    activeFilterTab === tab.key
                      ? 'text-primary font-semibold'
                      : 'text-muted-foreground font-medium',
                  )}
                >
                  {tab.label}
                </Text>
                {activeFilterTab === tab.key && (
                  <View className="absolute bottom-0 left-[20%] right-[20%] h-[4rpx] rounded-full bg-primary" />
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ====== 会员 Tab：学员卡片列表 ====== */}
      {mainTab === 'member' && (
        <ScrollView scrollY className="flex-1" onScrollToLower={onStudentsListScrollToLower}>
          <View className="px-[32rpx] pt-[24rpx] pb-[24rpx]">
            {visibleStudents.map((student) => {
              const cardStatus = getStudentCardStatus(student);
              const borderColorClass = getCardBorderColorClass(cardStatus);
              const progress = calcStudentProgress(student);
              const tags = generatePackageTags(student);
              const remainingHours = calcRemainingHours(student.course_packages);
              const hoursColorClass = getHoursColorClass(remainingHours);
              return (
                <View
                  key={student.id}
                  className={cn(
                    'bg-white rounded-[32rpx] p-[32rpx] shadow-soft mb-[24rpx] press-scale',
                    borderColorClass,
                  )}
                  onClick={() => goToDetail(student.id)}
                >
                  {/* 上部：头像 + 信息 + 课时 */}
                  <View className="flex items-center gap-[24rpx]">
                    {/* 头像 */}
                    <StudentAvatar name={student.name} src={student.avatar_url} size="md" />
                    {/* 信息 */}
                    <View className="flex-1 min-w-0">
                      <Text className="text-[32rpx] font-semibold text-foreground">
                        {student.name}
                      </Text>
                      {(student.nickname || student.phone || student.birthday) && (
                        <View className="flex items-center gap-[12rpx] mt-[4rpx]">
                          {student.nickname ? (
                            <Text className="text-[24rpx] text-muted-foreground">
                              {student.nickname}
                            </Text>
                          ) : null}
                          {student.nickname && student.phone ? (
                            <View className="w-[6rpx] h-[6rpx] rounded-full bg-muted-foreground/40" />
                          ) : null}
                          {student.phone && (
                            <>
                              <Text className="text-[24rpx] text-muted-foreground">
                                {student.phone}
                              </Text>
                              <View className="w-[6rpx] h-[6rpx] rounded-full bg-muted-foreground/40" />
                            </>
                          )}
                          <Text className="text-[24rpx] text-muted-foreground">
                            {student.birthday || '暂无生日'}
                          </Text>
                        </View>
                      )}
                    </View>
                    {/* 课时 */}
                    <View className="flex items-center gap-[16rpx] flex-shrink-0">
                      <View className="text-right">
                        <Text className={cn('text-[40rpx] font-bold block', hoursColorClass)}>
                          {remainingHours}
                        </Text>
                        <Text className="text-[22rpx] text-muted-foreground">课时</Text>
                      </View>
                      <Icon name="mdi-chevron-right" size="sm" color="mutedForeground" />
                    </View>
                  </View>

                  {/* 课包标签行 */}
                  {tags.length > 0 && (
                    <View className="flex gap-[12rpx] mt-[20rpx] flex-wrap">
                      {tags.map((tag, i) => (
                        <View
                          key={i}
                          className={cn(
                            'py-[6rpx] px-[16rpx] rounded-[12rpx]',
                            TAG_COLOR_MAP[tag.color].bg,
                          )}
                        >
                          <Text
                            className={cn(
                              'text-[22rpx] font-medium',
                              TAG_COLOR_MAP[tag.color].text,
                            )}
                          >
                            {tag.name} {tag.remainingHours}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* 进度条 */}
                  {progress.total > 0 && (
                    <View className="mt-[20rpx]">
                      <View className="h-[8rpx] bg-border rounded-[4rpx] overflow-hidden">
                        <View
                          className={cn(
                            'h-full rounded-[4rpx]',
                            getProgressGradientClass(cardStatus),
                          )}
                          style={{
                            width: `${Math.min(progress.percentage, 100)}%`,
                          }}
                        />
                      </View>
                      <View className="flex justify-between mt-[8rpx]">
                        <Text className="text-[22rpx] text-muted-foreground">
                          已用 {progress.used} 课时
                        </Text>
                        <Text className="text-[22rpx] text-muted-foreground">
                          共 {progress.total} 课时
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* 课时不足 / 无可用课包 → 去充值 */}
                  {(cardStatus === 'low' ||
                    cardStatus === 'expiring' ||
                    cardStatus === 'expired' ||
                    cardStatus === 'owe') && (
                    <View
                      className={cn(
                        'mt-[20rpx] flex items-center justify-between px-[20rpx] py-[16rpx] rounded-[16rpx]',
                        cardStatus === 'expired' || cardStatus === 'owe'
                          ? 'bg-destructive/10'
                          : 'bg-warning/10',
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        Taro.navigateTo({
                          url: `/package-course/pages/package-form/index?studentId=${student.id}`,
                        });
                      }}
                    >
                      <Text
                        className={cn(
                          'text-[24rpx]',
                          cardStatus === 'expired' || cardStatus === 'owe'
                            ? 'text-destructive'
                            : 'text-warning',
                        )}
                      >
                        {cardStatus === 'expired'
                          ? '暂无可用课包，请尽快充值'
                          : cardStatus === 'owe'
                            ? '课时透支，请尽快充值'
                            : cardStatus === 'expiring'
                              ? '课包即将到期，建议续费'
                              : '课时不足，建议充值'}
                      </Text>
                      <View
                        className={cn(
                          'px-[20rpx] py-[8rpx] rounded-[8rpx]',
                          cardStatus === 'expired' || cardStatus === 'owe'
                            ? 'bg-destructive/20'
                            : 'bg-warning/20',
                        )}
                      >
                        <Text
                          className={cn(
                            'text-[24rpx] font-medium',
                            cardStatus === 'expired' || cardStatus === 'owe'
                              ? 'text-destructive'
                              : 'text-warning',
                          )}
                        >
                          去充值
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* 请求失败不能伪装成空列表，便于真机直接识别加载链路问题 */}
            {studentsQuery.isError && !loading && (
              <Empty description="学员加载失败，请下拉刷新重试" />
            )}

            {/* 空状态 */}
            {filteredStudents.length === 0 && !loading && !studentsQuery.isError && (
              <>
                <Empty
                  description={
                    // actorId 为空 ⇒ 会话/profile 尚未恢复，此时 query 被 enabled=false 挡住、
                    // 不会发任何请求。若仍显示「暂无学员」，会把登录态故障伪装成"没有数据"。
                    !actorId
                      ? '登录态恢复中…'
                      : debouncedKeyword
                        ? '未找到匹配的学员'
                        : isTeacher
                          ? '暂无学员，点击上方添加'
                          : '暂无关联学员'
                  }
                />
              </>
            )}

            {/* 分批渲染：还有更多时显示加载提示（上拉自动追加） */}
            {hasMoreStudents && (
              <View className="py-[24rpx] text-center text-[24rpx] text-muted-foreground">
                {studentsQuery.isFetchingNextPage ? '正在加载下一页…' : '上拉加载更多…'}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ====== 线索 Tab：线索卡片列表 ====== */}
      {mainTab === 'lead' && (
        <ScrollView scrollY className="flex-1">
          <View className="px-[32rpx] pt-[24rpx] pb-[200rpx]">
            {/* 加载中 */}
            {isLeadLoading && filteredLeads.length === 0 && (
              <View className="py-20 center">
                <Text className="text-[26rpx] text-muted-foreground">加载中...</Text>
              </View>
            )}

            {/* 空状态 */}
            {!isLeadLoading && filteredLeads.length === 0 && (
              <View className="py-20 center flex-col gap-3">
                <Icon name="mdi-account-search" size={64} className="text-muted-foreground" />
                <Text className="text-[28rpx] text-muted-foreground">
                  {debouncedKeyword ? '未找到匹配的线索' : '暂无线索'}
                </Text>
              </View>
            )}

            {/* 线索卡片 */}
            <View className="flex flex-col gap-3">
              {filteredLeads.map((item) => (
                <LeadCard key={item.id} data={item} />
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* 点击空白关闭排序下拉 */}
      {sortOpen && (
        <View className="fixed inset-0 z-50 bg-transparent" onClick={closeAllDropdowns} />
      )}

      {/* 悬浮添加按钮 - 参考图片胶囊风格 */}
      {isTeacher && (
        <View
          className="fixed bottom-[160rpx] right-[32rpx] z-100"
          onClick={mainTab === 'member' ? handleOpenMemberAction : handleAddLead}
        >
          <View className="flex items-center gap-[8rpx] px-[28rpx] py-[18rpx] rounded-full bg-gradient-primary shadow-schedule-fab">
            <Icon name="mdi-plus" size="sm" color="white" />
            <Text className="text-[28rpx] text-white font-medium">
              {mainTab === 'member' ? '学员操作' : '客资录入'}
            </Text>
          </View>
        </View>
      )}

      {/* 学员操作弹窗 */}
      <MemberActionSheet
        visible={memberActionVisible}
        onClose={handleCloseMemberAction}
        onNewCard={handleNewCard}
        onImportHistory={handleImportHistory}
        onBatchExtend={handleBatchExtend}
        onBlacklist={handleBlacklist}
      />

      {/* R1：老生历史课时录入（先选学员，再按科目录入） */}
      <Dialog
        visible={legacyVisible}
        onClose={() => setLegacyVisible(false)}
        className="w-[86vw] max-h-[80vh] overflow-y-auto bg-card rounded-[24rpx] p-[32rpx]"
      >
        {legacyStudentId ? (
          <View>
            <Text className="text-[34rpx] font-bold text-foreground block">
              录入历史课时：{legacyStudentName}
            </Text>
            <LegacyPackagesEditor
              studentId={legacyStudentId}
              onSubmitted={() => setLegacyVisible(false)}
              onCancel={() => setLegacyVisible(false)}
            />
          </View>
        ) : (
          <View>
            <Text className="text-[34rpx] font-bold text-foreground block mb-[16rpx]">
              选择学员
            </Text>
            <View className="flex gap-[16rpx] mb-[16rpx]">
              <Input
                className="flex-1 border border-border rounded-[12rpx] p-[18rpx]"
                type="text"
                placeholder="姓名或手机号"
                value={legacyQuery}
                onInput={(event) => setLegacyQuery(event.detail.value)}
              />
              <Button
                type="primary"
                size="default"
                loading={legacySearching}
                disabled={legacySearching}
                onClick={handleLegacySearch}
              >
                搜索
              </Button>
            </View>
            {legacyResults.map((item) => (
              <View
                key={item.id}
                className="bg-muted rounded-[20rpx] p-[24rpx] mb-[16rpx] flex items-center justify-between"
                onClick={() => handleLegacyPickStudent(item)}
              >
                <Text className="text-foreground">{item.name}</Text>
                <Text className="text-muted-foreground text-[24rpx]">
                  {item.phone || '无手机号'}
                </Text>
              </View>
            ))}
            {legacyResults.length === 0 && !legacySearching && (
              <Text className="text-muted-foreground text-[24rpx] block">
                输入关键词后点击搜索，点选学员开始录入
              </Text>
            )}
          </View>
        )}
      </Dialog>
    </View>
  );
};

export default withRouteGuard(Students);
