/**
 * 课表页主操作 / 导航编排：点名、补录、编辑、批量入口、约试听弹层（Q2-1）
 */
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { CourseCategoryMode } from '@/types/course-category';
import type { ScheduleCardItem } from '@/utils/schedule-card-build';
import { buildTrialLessonKey, buildTrialLessonScheduleKey } from '@/utils/schedule-card-build';
import { canOperateHistoricalLesson } from '@/utils/schedule-guard';
import {
  buildBatchRescheduleSelectPath,
  buildBookingPagePath,
  buildCheckinLessonFormPath,
  buildLessonFormPath,
  buildSupplementLessonFormPath,
  buildViewOnlyLessonFormPath,
  resolveSchedulePrimaryActionKind,
  validateRollCallNav,
  validateSupplementNav,
} from '@/utils/schedule-lesson-nav';
import type { ScheduleBatchActionType as BatchActionType } from './ScheduleBatchSheets';
import type { ScheduleDangerActionState } from './use-schedule-danger-actions';

export interface ScheduleBatchClassOptionLite {
  id: string;
}

export interface UseScheduleCardActionsParams {
  selectedDate: dayjs.Dayjs;
  currentTime: dayjs.Dayjs;
  selectedClassId: string;
  filterAllClassId: string;
  activeTabMode?: CourseCategoryMode;
  cardActionLockRef: MutableRefObject<boolean>;
  batchClassOptions: ScheduleBatchClassOptionLite[];
  batchSelectedClassIds: string[];
  loadBaseData: () => Promise<void> | void;
  /** 当前打开中的约试听/补课弹层对应的卡片（预约成功后取本节课导航信息） */
  bookSheetItem: ScheduleCardItem | null;
  setBookSheetItem: Dispatch<SetStateAction<ScheduleCardItem | null>>;
  setBookSheetVisible: Dispatch<SetStateAction<boolean>>;
  setTrialBookingKeys: Dispatch<SetStateAction<Set<string>>>;
  setTeacherSwitchSheetVisible: Dispatch<SetStateAction<boolean>>;
  setBatchSelectedClassIds: Dispatch<SetStateAction<string[]>>;
  setBatchActionSheetVisible: Dispatch<SetStateAction<boolean>>;
  setBatchActionType: Dispatch<SetStateAction<BatchActionType>>;
  setBatchClassSheetVisible: Dispatch<SetStateAction<boolean>>;
  setDangerActionState: Dispatch<SetStateAction<ScheduleDangerActionState>>;
}

export function useScheduleCardActions(params: UseScheduleCardActionsParams) {
  const {
    selectedDate,
    currentTime,
    selectedClassId,
    filterAllClassId,
    activeTabMode,
    cardActionLockRef,
    batchClassOptions,
    batchSelectedClassIds,
    loadBaseData,
    bookSheetItem,
    setBookSheetItem,
    setBookSheetVisible,
    setTrialBookingKeys,
    setTeacherSwitchSheetVisible,
    setBatchSelectedClassIds,
    setBatchActionSheetVisible,
    setBatchActionType,
    setBatchClassSheetVisible,
    setDangerActionState,
  } = params;

  const handleOpenBookSheet = useCallback(
    (item: ScheduleCardItem) => {
      setBookSheetItem(item);
      setBookSheetVisible(true);
    },
    [setBookSheetItem, setBookSheetVisible],
  );

  const handleCloseBookSheet = useCallback(() => {
    setBookSheetVisible(false);
    setBookSheetItem(null);
  }, [setBookSheetItem, setBookSheetVisible]);

  const handleBookTrialByClassSuccess = useCallback(
    ({
      classId,
      lessonDate,
      startTime,
      mode,
    }: {
      classId: string;
      lessonDate: string;
      /** 本次预约落在哪一节（时段）；缺省时退回触发弹层的卡片时段 */
      startTime?: string;
      mode: 'makeup' | 'trial';
    }) => {
      // 收口前先取本节课导航信息（scheduleId / 时段来自触发弹层的卡片）
      const navItem = bookSheetItem;
      // 子弹层会调用 onClose，但微信端在回调后可能仍保留父级 visible 状态；
      // 这里同步收口父级状态，避免预约成功后弹框残留。
      setBookSheetVisible(false);
      setBookSheetItem(null);
      // 预约成功后本地只标记「被预约的那一节课」为试听（班级+日期+时段），
      // 不能按整班/整天标记：同一班同一天可能有多节课，按天标记会让别的课也挂上试听。
      const lessonStartTime = startTime || navItem?.startTime;
      setTrialBookingKeys((prev) => {
        const next = new Set(prev);
        next.add(buildTrialLessonKey(classId, lessonDate, lessonStartTime));
        // 同时按「排课编号」标记：这节课以后被同日调课改了时段，角标也不会丢
        const scheduleId = navItem?.id;
        if (scheduleId) {
          next.add(buildTrialLessonScheduleKey(classId, lessonDate, scheduleId));
        }
        return next;
      });
      void loadBaseData();
      /**
       * 补课：弹层里已经完成「建预约 + 自动签到」（用户口径 2026-10-01）⇒
       * **不再跳详情页**（原来 `action=supplement` 那一步已被自动签到取代），只刷新课表。
       * 试听：仍沿用「约完进详情页签到」的老流程。
       */
      if (mode === 'makeup') {
        return;
      }
      // 引导进入这节课的详情页签到（用户口径 2026-09-30：过去课也允许约，
      // 约完直接去点名页——名单会自动带上刚约的补课/试听学员和已签到数据）。
      if (!classId || !lessonDate) return;
      if (!canOperateHistoricalLesson(dayjs(lessonDate), dayjs())) {
        Taro.showToast({
          title: '已超过 30 天补录期限，预约已保存，但无法再补签到',
          icon: 'none',
          duration: 2500,
        });
        return;
      }
      const lessonTime =
        navItem?.startTime && navItem?.endTime
          ? `${navItem.startTime}-${navItem.endTime}`
          : undefined;
      Taro.navigateTo({
        url: buildLessonFormPath({
          scheduleId: navItem?.id,
          classId,
          lessonDate,
          lessonTime,
          // 走到这里只剩试听（补课在上面已 return，改由弹层自动签到完成）：
          // 试听学员在这节课上签到即可，不需补录参数。
        }),
      });
    },
    [bookSheetItem, loadBaseData, setBookSheetItem, setBookSheetVisible, setTrialBookingKeys],
  );

  /** 卡片「补录」：仅历史课且 30 天内 */
  const handleSupplement = useCallback((item: ScheduleCardItem, actionDate: dayjs.Dayjs) => {
    const error = validateSupplementNav(item, actionDate, dayjs());
    if (error) {
      Taro.showToast({ title: error, icon: 'none' });
      return;
    }
    Taro.navigateTo({ url: buildSupplementLessonFormPath(item, actionDate) });
  }, []);

  /** 历史课超时：仅查看（不带补录 action） */
  const handleViewHistoricalLesson = useCallback(
    (item: ScheduleCardItem, actionDate: dayjs.Dayjs) => {
      if (!item.classId) {
        Taro.showToast({ title: '当前课程缺少班级信息', icon: 'none' });
        return;
      }
      Taro.navigateTo({ url: buildViewOnlyLessonFormPath(item, actionDate) });
    },
    [],
  );

  const handlePrimaryAction = useCallback(
    (item: ScheduleCardItem, actionDate: dayjs.Dayjs) => {
      // 子按钮（约试听等）已抢先处理时，忽略卡片主点击（微信 stopPropagation 不可靠）
      if (cardActionLockRef.current) {
        return;
      }
      const kind = resolveSchedulePrimaryActionKind(item, actionDate, dayjs());
      if (kind === 'booking') {
        Taro.navigateTo({
          url: buildBookingPagePath(actionDate.format('YYYY-MM-DD')),
        });
        return;
      }
      if (kind === 'supplement') {
        handleSupplement(item, actionDate);
        return;
      }
      if (kind === 'view') {
        handleViewHistoricalLesson(item, actionDate);
        return;
      }
      Taro.navigateTo({ url: buildCheckinLessonFormPath(item, actionDate) });
    },
    [cardActionLockRef, handleSupplement, handleViewHistoricalLesson],
  );

  /** 卡片「点名」：进 lesson-form 正常点名 */
  const handleRollCall = useCallback((item: ScheduleCardItem, actionDate: dayjs.Dayjs) => {
    const error = validateRollCallNav(item, actionDate, dayjs());
    if (error) {
      Taro.showToast({ title: error, icon: 'none' });
      return;
    }
    Taro.navigateTo({ url: buildCheckinLessonFormPath(item, actionDate) });
  }, []);

  const handleCreateSchedule = useCallback(
    (sourceMode?: string) => {
      const mode = sourceMode || activeTabMode || 'class';
      Taro.navigateTo({
        url: `/package-course/pages/schedule-form/index?sourceMode=${encodeURIComponent(mode)}`,
      });
    },
    [activeTabMode],
  );

  /** 预约视图：打开老师预约开关列表弹窗 */
  const handleManageBookingConfig = useCallback(() => {
    setTeacherSwitchSheetVisible(true);
  }, [setTeacherSwitchSheetVisible]);

  const handleBatchAction = useCallback(() => {
    const initialSelectedIds =
      selectedClassId && selectedClassId !== filterAllClassId ? [selectedClassId] : [];
    setBatchSelectedClassIds(initialSelectedIds);
    setBatchActionSheetVisible(true);
  }, [filterAllClassId, selectedClassId, setBatchActionSheetVisible, setBatchSelectedClassIds]);

  const toggleBatchClassSelection = useCallback(
    (classId: string) => {
      setBatchSelectedClassIds((prev) =>
        prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId],
      );
    },
    [setBatchSelectedClassIds],
  );

  const handleSelectAllBatchClasses = useCallback(() => {
    setBatchSelectedClassIds((prev) =>
      prev.length === batchClassOptions.length ? [] : batchClassOptions.map((item) => item.id),
    );
  }, [batchClassOptions, setBatchSelectedClassIds]);

  const handleChooseBatchType = useCallback(
    (type: BatchActionType) => {
      setBatchActionType(type);
      setBatchActionSheetVisible(false);
      if (type === 'reschedule') {
        if (selectedDate.isBefore(currentTime, 'day')) {
          Taro.showToast({ title: '过去的日期不能批量调课', icon: 'none' });
          return;
        }
        const date = selectedDate.format('YYYY-MM-DD');
        void Taro.navigateTo({
          url: buildBatchRescheduleSelectPath(date, selectedClassId || ''),
        });
        return;
      }
      setBatchClassSheetVisible(true);
    },
    [
      currentTime,
      selectedClassId,
      selectedDate,
      setBatchActionSheetVisible,
      setBatchActionType,
      setBatchClassSheetVisible,
    ],
  );

  const handleConfirmBatchClassSelection = useCallback(() => {
    if (batchSelectedClassIds.length === 0) {
      Taro.showToast({ title: '请至少选择一个班级', icon: 'none' });
      return;
    }

    setDangerActionState({
      visible: true,
      type: 'batch-delete',
    });
  }, [batchSelectedClassIds.length, setDangerActionState]);

  return {
    handleOpenBookSheet,
    handleCloseBookSheet,
    handleBookTrialByClassSuccess,
    handleSupplement,
    handleViewHistoricalLesson,
    handlePrimaryAction,
    handleRollCall,
    handleCreateSchedule,
    handleManageBookingConfig,
    handleBatchAction,
    toggleBatchClassSelection,
    handleSelectAllBatchClasses,
    handleChooseBatchType,
    handleConfirmBatchClassSelection,
  };
}
