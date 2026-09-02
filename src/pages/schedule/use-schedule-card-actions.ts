/**
 * 课表页主操作 / 导航编排：点名、补录、编辑、批量入口、约试听弹层（Q2-1）
 */
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { CourseCategoryMode } from '@/types/course-category';
import { getCardActionVisibility } from '@/utils/schedule-card-actions';
import type { ScheduleCardItem } from '@/utils/schedule-card-build';
import {
  buildBookingPagePath,
  buildCheckinLessonFormPath,
  buildScheduleFormEditPath,
  buildScheduleFormReschedulePath,
  buildSupplementLessonFormPath,
  buildViewOnlyLessonFormPath,
  resolveSchedulePrimaryActionKind,
  validateEditScheduleNav,
  validateRollCallNav,
  validateSupplementNav,
} from '@/utils/schedule-lesson-nav';
import type { ScheduleDangerActionState } from './use-schedule-danger-actions';
import type { ScheduleBatchActionType as BatchActionType } from './ScheduleBatchSheets';

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
    ({ classId, lessonDate }: { classId: string; lessonDate: string }) => {
      // 预约成功后本地标记该班级时段为试听，并刷新课表数据
      setTrialBookingKeys((prev) => {
        const next = new Set(prev);
        next.add(`${classId}|${lessonDate}`);
        return next;
      });
      void loadBaseData();
    },
    [loadBaseData, setTrialBookingKeys],
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

  const handleEditSchedule = useCallback(
    (item: ScheduleCardItem) => {
      const visibility = getCardActionVisibility(item, selectedDate, currentTime);
      const error = validateEditScheduleNav(item, selectedDate, currentTime, visibility);
      if (error) {
        Taro.showToast({ title: error, icon: 'none' });
        return;
      }
      Taro.navigateTo({
        url: buildScheduleFormEditPath(item.id),
      });
    },
    [currentTime, selectedDate],
  );

  /** 班级调课：这一天整班换到别的时间（仅本次），长期仍挂在原排课规则上 */
  const handleClassReschedule = useCallback(
    (item: ScheduleCardItem) => {
      const visibility = getCardActionVisibility(item, selectedDate, currentTime);
      if (!visibility.showEditAndReschedule) {
        Taro.showToast({ title: '过去日期课程不支持调课', icon: 'none' });
        return;
      }
      Taro.navigateTo({
        url: buildScheduleFormReschedulePath(item.id, selectedDate.format('YYYY-MM-DD')),
      });
    },
    [currentTime, selectedDate],
  );

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
  }, [
    filterAllClassId,
    selectedClassId,
    setBatchActionSheetVisible,
    setBatchSelectedClassIds,
  ]);

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
        const date = encodeURIComponent(selectedDate.format('YYYY-MM-DD'));
        const classId = encodeURIComponent(selectedClassId || '');
        void Taro.navigateTo({
          url: `/package-course/pages/batch-reschedule-select/index?date=${date}&classId=${classId}`,
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
      item: null,
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
    handleEditSchedule,
    handleClassReschedule,
    handleCreateSchedule,
    handleManageBookingConfig,
    handleBatchAction,
    toggleBatchClassSelection,
    handleSelectAllBatchClasses,
    handleChooseBatchType,
    handleConfirmBatchClassSelection,
  };
}
