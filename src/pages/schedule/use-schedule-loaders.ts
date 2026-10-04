/**
 * 课表页数据加载：场地 / 开放时段 / 基础排课 / 月度消课与临调
 */
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import {
  calendarSyncService,
  classBookingService,
  classService,
  leadService,
  lessonRecordService,
  scheduleService,
  studentService,
  teacherService,
  temporaryRescheduleService,
  venueBookingService,
} from '@/services';
import type { Class, ClassBookingSlot } from '@/types/class';
import type { LessonRecord } from '@/types/lesson-record';
import type { UserRole } from '@/types/profile';
import type { Schedule } from '@/types/schedule';
import type { TeacherUIModel } from '@/types/teacher';
import type { TemporaryReschedule } from '@/types/temporary-reschedule';
import type { BookableVenue } from '@/types/venue-booking';
import { logError } from '@/utils/logger';
import type { ScheduleCardStudentAvatar } from '@/utils/schedule-card-build';
import {
  buildMonthAuxDateRange,
  buildTrialBookingKeys,
  filterOpenClasses,
  shouldSkipOpenSlotLoad,
} from './schedule-loaders-logic';

export interface UseScheduleLoadersParams {
  currentUserId: string;
  currentTeacherId: string;
  currentCampusId: string;
  currentRole: UserRole | null;
  isParent: boolean;
  profileId?: string;
  fetchCategories: () => void | Promise<unknown>;
  filteredClasses: Class[];
  viewMode: 'schedule' | 'booking';
  scheduleSubMode: 'fixed' | 'open';
  selectedDate: dayjs.Dayjs;
  setParentClassIds: Dispatch<SetStateAction<Set<string>>>;
  setVenues: Dispatch<SetStateAction<BookableVenue[]>>;
  setLoadingVenues: Dispatch<SetStateAction<boolean>>;
  setOpenClassSlots: Dispatch<SetStateAction<Record<string, Record<string, ClassBookingSlot[]>>>>;
  setLoadingOpenSlotDates: Dispatch<SetStateAction<Set<string>>>;
  setErrorOpenSlotDates: Dispatch<SetStateAction<Set<string>>>;
  setOpenSlotDates: Dispatch<SetStateAction<Set<string>>>;
  setSchedules: Dispatch<SetStateAction<Schedule[]>>;
  setClasses: Dispatch<SetStateAction<Class[]>>;
  setTeachers: Dispatch<SetStateAction<TeacherUIModel[]>>;
  setClassStudentAvatars: Dispatch<SetStateAction<Record<string, ScheduleCardStudentAvatar[]>>>;
  setTrialBookingKeys: Dispatch<SetStateAction<Set<string>>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setLessonRecords: Dispatch<SetStateAction<LessonRecord[]>>;
  setTemporaryReschedules: Dispatch<SetStateAction<TemporaryReschedule[]>>;
}

export function useScheduleLoaders(params: UseScheduleLoadersParams) {
  const {
    currentUserId,
    currentTeacherId,
    currentCampusId,
    currentRole,
    isParent,
    profileId,
    fetchCategories,
    filteredClasses,
    viewMode,
    scheduleSubMode,
    selectedDate,
    setParentClassIds,
    setVenues,
    setLoadingVenues,
    setOpenClassSlots,
    setLoadingOpenSlotDates,
    setErrorOpenSlotDates,
    setOpenSlotDates,
    setSchedules,
    setClasses,
    setTeachers,
    setClassStudentAvatars,
    setTrialBookingKeys,
    setLoading,
    setLessonRecords,
    setTemporaryReschedules,
  } = params;

  /** 开放预约时段加载防抖 timer */
  const openSlotLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 开放预约加载状态 ref（避免 loadOpenClassSlots 因 state 变化频繁重建） */
  const loadingOpenSlotDatesRef = useRef<Set<string>>(new Set());
  /** 开放预约错误状态 ref */
  const errorOpenSlotDatesRef = useRef<Set<string>>(new Set());
  /** 开放预约数据缓存 ref */
  const openClassSlotsRef = useRef<Record<string, Record<string, ClassBookingSlot[]>>>({});
  /** 消课/临调辅助数据上次拉取时间（Tab 切换 TTL） */
  const lastScheduleAuxFetchAtRef = useRef(0);

  /** 加载可预约场地列表 */
  const loadVenues = useCallback(async () => {
    setLoadingVenues(true);
    try {
      const data = await venueBookingService.getBookableVenues(currentCampusId);
      setVenues(data);
    } catch (err) {
      logError('SchedulePage loadVenues', err);
      Taro.showToast({ title: '场地加载失败', icon: 'none' });
    } finally {
      setLoadingVenues(false);
    }
  }, [currentCampusId, setLoadingVenues, setVenues]);

  const loadOpenClassSlots = useCallback(
    async (targetDate: dayjs.Dayjs, force = false) => {
      const dateStr = targetDate.format('YYYY-MM-DD');
      if (
        shouldSkipOpenSlotLoad({
          viewMode,
          scheduleSubMode,
          dateStr,
          force,
          loadingDates: loadingOpenSlotDatesRef.current,
          cachedDates: openClassSlotsRef.current,
          errorDates: errorOpenSlotDatesRef.current,
        })
      ) {
        return;
      }

      const openClasses = filterOpenClasses(filteredClasses);

      if (openClasses.length === 0) {
        openClassSlotsRef.current = { ...openClassSlotsRef.current, [dateStr]: {} };
        setOpenClassSlots(openClassSlotsRef.current);
        return;
      }

      loadingOpenSlotDatesRef.current = new Set(loadingOpenSlotDatesRef.current).add(dateStr);
      setLoadingOpenSlotDates(loadingOpenSlotDatesRef.current);
      errorOpenSlotDatesRef.current = new Set(errorOpenSlotDatesRef.current);
      errorOpenSlotDatesRef.current.delete(dateStr);
      setErrorOpenSlotDates(errorOpenSlotDatesRef.current);

      try {
        const results = await Promise.all(
          openClasses.map(async (cls) => ({
            classId: cls.id,
            slots: await classBookingService.getSlotsByClass(cls.id, dateStr),
          })),
        );
        openClassSlotsRef.current = {
          ...openClassSlotsRef.current,
          [dateStr]: results.reduce<Record<string, ClassBookingSlot[]>>((acc, item) => {
            acc[item.classId] = item.slots;
            return acc;
          }, {}),
        };
        setOpenClassSlots(openClassSlotsRef.current);
        loadingOpenSlotDatesRef.current = new Set(loadingOpenSlotDatesRef.current);
        loadingOpenSlotDatesRef.current.delete(dateStr);
        setLoadingOpenSlotDates(loadingOpenSlotDatesRef.current);
      } catch (err) {
        logError('SchedulePage loadOpenClassSlots', err);
        loadingOpenSlotDatesRef.current = new Set(loadingOpenSlotDatesRef.current);
        loadingOpenSlotDatesRef.current.delete(dateStr);
        setLoadingOpenSlotDates(loadingOpenSlotDatesRef.current);
        errorOpenSlotDatesRef.current = new Set(errorOpenSlotDatesRef.current).add(dateStr);
        setErrorOpenSlotDates(errorOpenSlotDatesRef.current);

        // 失败时设置空数据，避免一直显示加载中；UI 提供手动重试入口
        openClassSlotsRef.current = { ...openClassSlotsRef.current, [dateStr]: {} };
        setOpenClassSlots(openClassSlotsRef.current);
      }
    },
    [
      filteredClasses,
      scheduleSubMode,
      setErrorOpenSlotDates,
      setLoadingOpenSlotDates,
      setOpenClassSlots,
      viewMode,
    ],
  );

  const loadOpenSlotDates = useCallback(async () => {
    const openClasses = filterOpenClasses(filteredClasses);
    if (openClasses.length === 0) {
      setOpenSlotDates(new Set());
      return;
    }
    try {
      const dates = await classBookingService.getOpenSlotDates(openClasses.map((cls) => cls.id));
      setOpenSlotDates(new Set(dates));
    } catch (err) {
      logError('SchedulePage loadOpenSlotDates', err);
    }
  }, [filteredClasses, setOpenSlotDates]);

  /**
   * 按目标日期刷新数据，绑定到日历切换事件上
   * 避免依赖 selectedDate 的 useEffect 在日期相同时跳过刷新
   */
  const refreshDateData = useCallback(
    (date: dayjs.Dayjs) => {
      if (openSlotLoadTimerRef.current) {
        clearTimeout(openSlotLoadTimerRef.current);
      }
      openSlotLoadTimerRef.current = setTimeout(() => {
        openSlotLoadTimerRef.current = null;
        if (viewMode === 'schedule' && scheduleSubMode === 'open') {
          void loadOpenClassSlots(date, true);
          void loadOpenClassSlots(date.add(1, 'day'), true);
          void loadOpenClassSlots(date.subtract(1, 'day'), true);
        }
        if (currentUserId) {
          const { startDate, endDate } = buildMonthAuxDateRange(date);
          void lessonRecordService
            .getByTeacherAndRange(currentUserId, startDate, endDate, currentCampusId)
            .then(setLessonRecords)
            .catch((err) => {
              logError('SchedulePage refreshDateData records', err);
              // 口径：无权限/失败 → 保留缓存或空白，不弹失败打断
            });
          void temporaryRescheduleService
            .getByTeacherAndRange(currentUserId, startDate, endDate)
            .then(setTemporaryReschedules)
            .catch((err) => {
              logError('SchedulePage refreshDateData reschedules', err);
            });
        }
      }, 150);
    },
    [
      currentCampusId,
      currentUserId,
      loadOpenClassSlots,
      scheduleSubMode,
      setLessonRecords,
      setTemporaryReschedules,
      viewMode,
    ],
  );

  /**
   * 基础数据加载（排课 / 班级 / 老师 / 学员头像 / 试听预约 / 分类）。
   *
   * `silent: true` 时不切全局 loading 骨架 —— 下拉刷新已由系统指示器给出反馈，
   * 再叠一层骨架会让列表闪一下。
   */
  const loadBaseData = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!currentUserId) {
        return;
      }
      if (!opts?.silent) {
        setLoading(true);
      }
      try {
        if (isParent) {
          const kids = await studentService.getByParent(profileId || currentUserId);
          const classIdSet = new Set<string>();
          kids.forEach((kid) => {
            (kid.class_ids || []).forEach((id) => classIdSet.add(id));
          });
          setParentClassIds(classIdSet);

          const classList = (
            await Promise.all([...classIdSet].map((id) => classService.getById(id)))
          ).filter(Boolean) as Class[];
          const scheduleList = await scheduleService.listForParent(
            [...classIdSet],
            currentCampusId,
          );
          const teacherList = await teacherService.getList(currentCampusId);

          const classStudentsList = await Promise.all(
            classList.map(async (classItem) => ({
              classId: classItem.id,
              students: kids.filter((kid) => (kid.class_ids || []).includes(classItem.id)),
            })),
          );
          const nextClassStudentAvatars: Record<string, ScheduleCardStudentAvatar[]> = {};
          classStudentsList.forEach((item) => {
            nextClassStudentAvatars[item.classId] = item.students.map((student) => ({
              id: student.id,
              name: student.name,
              avatar: student.avatar_url,
            }));
          });

          setSchedules(scheduleList);
          setClasses(classList);
          setTeachers(teacherList);
          setClassStudentAvatars(nextClassStudentAvatars);
          setTrialBookingKeys(new Set());
          return;
        }

        const [scheduleList, classList, teacherList, leadBookings] = await Promise.all([
          scheduleService.getByTeacher(currentUserId, currentCampusId),
          classService.getByTeacher(currentUserId, currentCampusId),
          teacherService.getList(currentCampusId),
          // 试听预约和分类是课表增强数据；失败时不得阻断核心课表渲染。
          leadService.getLeadBookingsByTeacher(currentTeacherId).catch((err) => {
            logError('SchedulePage load lead bookings', err);
            return [];
          }),
          Promise.resolve()
            .then(() => fetchCategories())
            .catch((err) => {
              logError('SchedulePage load categories', err);
              return undefined;
            }),
        ]);
        const classStudentsList = await Promise.all(
          classList.map(async (classItem) => ({
            classId: classItem.id,
            students: await classService.getStudents(classItem.id).catch((err) => {
              logError(`SchedulePage load class students: ${classItem.id}`, err);
              return [];
            }),
          })),
        );
        const nextClassStudentAvatars: Record<string, ScheduleCardStudentAvatar[]> = {};
        classStudentsList.forEach((item) => {
          nextClassStudentAvatars[item.classId] = item.students.map((student) => ({
            id: student.id,
            name: student.name,
            avatar: student.avatar_url,
          }));
        });
        const nextTrialBookingKeys = buildTrialBookingKeys(
          // 试听预约里「哪一节」的字段叫 reference_schedule_id，统一成 schedule_id
          leadBookings.map((b) => ({
            class_id: b.class_id,
            lesson_date: b.lesson_date,
            start_time: b.start_time,
            schedule_id: b.reference_schedule_id,
            status: b.status,
          })),
        );
        setSchedules(scheduleList);
        setClasses(classList);
        setTeachers(teacherList);
        setClassStudentAvatars(nextClassStudentAvatars);
        setTrialBookingKeys(nextTrialBookingKeys);
        void calendarSyncService.maybePromptOnSchedulePage({
          userId: currentUserId,
          teacherId: currentUserId,
          role: currentRole ?? undefined,
          campusId: currentCampusId,
          scheduleCount: scheduleList.length,
        });
      } catch (err) {
        logError('SchedulePage loadBaseData', err);
        // 口径：无权限/拉数失败 → 空白课表，不用失败 toast 打断
      } finally {
        if (!opts?.silent) {
          setLoading(false);
        }
      }
    },
    [
      currentCampusId,
      currentRole,
      currentTeacherId,
      currentUserId,
      fetchCategories,
      isParent,
      profileId,
      setClassStudentAvatars,
      setClasses,
      setLoading,
      setParentClassIds,
      setSchedules,
      setTeachers,
      setTrialBookingKeys,
    ],
  );

  const loadMonthRecords = useCallback(async () => {
    if (!currentUserId) {
      return;
    }
    try {
      const { startDate, endDate } = buildMonthAuxDateRange(selectedDate);
      const list = await lessonRecordService.getByTeacherAndRange(
        currentUserId,
        startDate,
        endDate,
        currentCampusId,
        // 连停课/请假/未到记录一起拿：卡片「停课」角标靠 cancelled 记录判定
        true,
      );
      setLessonRecords(list);
      lastScheduleAuxFetchAtRef.current = Date.now();
    } catch (err) {
      logError('SchedulePage loadMonthRecords', err);
      // 保留缓存；不反复 toast（Tab 切换会多次触发）
    }
  }, [currentCampusId, currentUserId, selectedDate, setLessonRecords]);

  const loadTemporaryReschedules = useCallback(async () => {
    if (!currentUserId) {
      return;
    }
    try {
      const { startDate, endDate } = buildMonthAuxDateRange(selectedDate);
      const list = await temporaryRescheduleService.getByTeacherAndRange(
        currentUserId,
        startDate,
        endDate,
      );
      setTemporaryReschedules(list);
      lastScheduleAuxFetchAtRef.current = Date.now();
    } catch (err) {
      logError('SchedulePage loadTemporaryReschedules', err);
      // 后端未挂载接口时 service 已降级本地；此处不再弹失败打断
    }
  }, [currentUserId, selectedDate, setTemporaryReschedules]);

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    // 日历切换已绑定到 onChange 回调主动刷新；这里负责初始加载及视图/模式切换后的兜底刷新
    refreshDateData(selectedDate);
    return () => {
      if (openSlotLoadTimerRef.current) {
        clearTimeout(openSlotLoadTimerRef.current);
        openSlotLoadTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshDateData]);

  useEffect(() => {
    void loadOpenSlotDates();
  }, [loadOpenSlotDates]);

  /**
   * 清空「开放时段」的内存缓存。
   *
   * 为什么需要：`loadOpenClassSlots` 内部有 `openClassSlotsRef` 缓存 + `force` 短路，
   * 下拉刷新只对**当前日期 ±1 天**传force 生效，日期窗口里其它已缓存的日期仍显示旧时段。
   * 下拉刷新语义是「全部回源」，所以先把缓存整体作废再重拉当前视图需要的日期。
   */
  const clearOpenSlotCache = useCallback(() => {
    openClassSlotsRef.current = {};
    loadingOpenSlotDatesRef.current = new Set();
    errorOpenSlotDatesRef.current = new Set();
    setOpenClassSlots({});
    setLoadingOpenSlotDates(new Set());
    setErrorOpenSlotDates(new Set());
  }, [setErrorOpenSlotDates, setLoadingOpenSlotDates, setOpenClassSlots]);

  /**
   * 下拉刷新：把「当前屏幕上看到的数据」整批重拉。
   *
   * 覆盖范围（对齐「下拉 = 看到的就是最新的」）：
   * - 基础数据（排课/班级/老师/学员头像/试听预约/分类）→ `loadBaseData({ silent: true })`
   *   （静默：下拉指示器已经给了反馈，不再切全局骨架，否则列表会闪一下）
   * - 点名统计与临时调课 → `loadMonthRecords` + `loadTemporaryReschedules`
   * - 团课视图（`open` 子模式）→ 作废开放时段缓存后重拉当前日期前后各一天 + 红点日期集合
   * - 场地视图 → `loadVenues`（由调用方按当前 Tab 传入 `withVenues`）
   *
   * 私教视图（`TrialBookingView`）的数据由它自己加载，页面通过其 `reloadToken` 触发，
   * 不在这里重复实现；调用方需自行 `await` 该视图的加载完成再收起指示器。
   */
  const pullRefresh = useCallback(
    async (opts?: { withVenues?: boolean }) => {
      // 场地列表是「当前 Tab 看得见」的数据，无论在哪个 Tab 都该刷：
      // 排课页顶部 Tab 的显示依赖它，跨 Tab 时列表虽不可见但缓存已是脏的。
      const tasks: Promise<unknown>[] = [
        loadBaseData({ silent: true }),
        loadMonthRecords(),
        loadTemporaryReschedules(),
      ];
      if (opts?.withVenues) {
        tasks.push(loadVenues());
      }
      if (viewMode === 'schedule' && scheduleSubMode === 'open') {
        clearOpenSlotCache();
        tasks.push(
          loadOpenClassSlots(selectedDate, true),
          loadOpenClassSlots(selectedDate.add(1, 'day'), true),
          loadOpenClassSlots(selectedDate.subtract(1, 'day'), true),
          loadOpenSlotDates(),
        );
      }
      await Promise.all(tasks);
    },
    [
      clearOpenSlotCache,
      loadBaseData,
      loadMonthRecords,
      loadOpenClassSlots,
      loadOpenSlotDates,
      loadTemporaryReschedules,
      loadVenues,
      scheduleSubMode,
      selectedDate,
      viewMode,
    ],
  );

  return {
    loadVenues,
    loadOpenClassSlots,
    loadOpenSlotDates,
    loadBaseData,
    loadMonthRecords,
    loadTemporaryReschedules,
    refreshDateData,
    pullRefresh,
    clearOpenSlotCache,
    lastScheduleAuxFetchAtRef,
  };
}
