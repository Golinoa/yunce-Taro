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
import type { Schedule } from '@/types/schedule';
import type { TeacherUIModel } from '@/types/teacher';
import type { TemporaryReschedule } from '@/types/temporary-reschedule';
import type { UserRole } from '@/types/profile';
import type { BookableVenue } from '@/types/venue-booking';
import { logError } from '@/utils/logger';
import type { ScheduleCardStudentAvatar } from '@/utils/schedule-card-build';

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
      if (viewMode !== 'schedule' || scheduleSubMode !== 'open') {
        return;
      }
      const openClasses = filteredClasses.filter((item) => item.schedule_mode === 'open');
      const dateStr = targetDate.format('YYYY-MM-DD');

      // 正在加载中，避免重复请求
      if (loadingOpenSlotDatesRef.current.has(dateStr)) {
        return;
      }

      // 已缓存且非错误状态，直接复用（force 可跳过缓存用于重试）
      if (
        !force &&
        Object.prototype.hasOwnProperty.call(openClassSlotsRef.current, dateStr) &&
        !errorOpenSlotDatesRef.current.has(dateStr)
      ) {
        return;
      }

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
    const openClasses = filteredClasses.filter((item) => item.schedule_mode === 'open');
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
          const startDate = date.startOf('month').subtract(7, 'day').format('YYYY-MM-DD');
          const endDate = date.endOf('month').add(7, 'day').format('YYYY-MM-DD');
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

  const loadBaseData = useCallback(async () => {
    if (!currentUserId) {
      return;
    }
    setLoading(true);
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
        const scheduleList = await scheduleService.listForParent([...classIdSet], currentCampusId);
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
        // 试听标签按「当天有效预约」判定，含 pending/confirmed（后端新建默认可为 pending）
        leadService.getLeadBookingsByTeacher(currentTeacherId),
        fetchCategories(),
      ]);
      await studentService.getByTeacher(currentUserId, currentCampusId);
      const classStudentsList = await Promise.all(
        classList.map(async (classItem) => ({
          classId: classItem.id,
          students: await classService.getStudents(classItem.id),
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
      const nextTrialBookingKeys = new Set<string>(
        leadBookings
          .filter(
            (b) =>
              b.class_id && b.lesson_date && (b.status === 'pending' || b.status === 'confirmed'),
          )
          .map((b) => `${b.class_id}|${b.lesson_date}`),
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
      setLoading(false);
    }
  }, [
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
  ]);

  const loadMonthRecords = useCallback(async () => {
    if (!currentUserId) {
      return;
    }
    try {
      const startDate = selectedDate.startOf('month').subtract(7, 'day').format('YYYY-MM-DD');
      const endDate = selectedDate.endOf('month').add(7, 'day').format('YYYY-MM-DD');
      const list = await lessonRecordService.getByTeacherAndRange(
        currentUserId,
        startDate,
        endDate,
        currentCampusId,
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
      const startDate = selectedDate.startOf('month').subtract(7, 'day').format('YYYY-MM-DD');
      const endDate = selectedDate.endOf('month').add(7, 'day').format('YYYY-MM-DD');
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

  return {
    loadVenues,
    loadOpenClassSlots,
    loadOpenSlotDates,
    loadBaseData,
    loadMonthRecords,
    loadTemporaryReschedules,
    refreshDateData,
    lastScheduleAuxFetchAtRef,
  };
}
