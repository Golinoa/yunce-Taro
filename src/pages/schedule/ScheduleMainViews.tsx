/**
 * 课表页主内容区：日 Swiper / 开放列表 / 私教 / 场地 / FAB / 约试听（Q2-1）
 */
import { ScrollView, Swiper, SwiperItem } from '@tarojs/components';
import dayjs from 'dayjs';
import React from 'react';
import DraggableFab from '@/components/DraggableFab';
import BookTrialByClassSheet from '@/components/lead/BookTrialByClassSheet';
import TrialBookingView from '@/components/lead/TrialBookingView';
import type { Class, ClassBookingSlot } from '@/types/class';
import type { TeacherUIModel } from '@/types/teacher';
import type { BookableVenue } from '@/types/venue-booking';
import type { LessonSharePayload } from '@/utils/lesson-share';
import type { ScheduleCardItem, ScheduleCardStudentAvatar } from '@/utils/schedule-card-build';
import type { DangerActionMeta, ScheduleDangerActionType } from '@/utils/schedule-danger-meta';
import OpenClassScheduleList from './OpenClassScheduleList';
import ScheduleBatchSheets, {
  type ScheduleBatchActionType as BatchActionType,
  type ScheduleBatchClassOption,
} from './ScheduleBatchSheets';
import ScheduleDaySwiperItem, { type ScheduleDaySummary } from './ScheduleDaySwiperItem';
import ScheduleVenueTab from './ScheduleVenueTab';
import type { ScheduleTabItem } from './use-schedule-derived';

const SCHEDULE_CARD_SWIPER_DURATION = 260;

interface ScheduleDateSwiperProps {
  dates: dayjs.Dayjs[];
  current: number;
  onChange: (e: { detail?: { current?: number; source?: string } }) => void;
  onAnimationFinish: (e: { detail?: { current?: number; source?: string } }) => void;
  children: (date: dayjs.Dayjs) => React.ReactNode;
}

/**
 * 日期 Swiper 容器：班课 / 团课 / 场地三个视图共用同一套滑动配置。
 *
 * 原来三处各写一遍 Swiper（配置项逐字相同），改动画参数或加属性容易只改一处。
 * 注意这里**不内置 ScrollView**：三个视图的内容组件自带滚动容器，
 * 再套一层会产生双滚动条并吃掉垂直手势（与 CalendarSwiper 的差异点，故未直接复用它）。
 */
const ScheduleDateSwiper: React.FC<ScheduleDateSwiperProps> = ({
  dates,
  current,
  onChange,
  onAnimationFinish,
  children,
}) => (
  <Swiper
    className="bg-schedule-page"
    style={{ flex: 1, minHeight: 0 }}
    current={current}
    duration={SCHEDULE_CARD_SWIPER_DURATION}
    easingFunction="easeOutCubic"
    skipHiddenItemLayout
    onChange={onChange}
    onAnimationFinish={onAnimationFinish}
  >
    {dates.map((date) => (
      <SwiperItem key={date.format('YYYY-MM-DD')} itemId={date.format('YYYY-MM-DD')}>
        {children(date)}
      </SwiperItem>
    ))}
  </Swiper>
);

export interface ScheduleMainViewsProps {
  activeTab?: ScheduleTabItem;
  activeTabKey: string;
  tabs: ScheduleTabItem[];
  isParent: boolean;
  selectedDate: dayjs.Dayjs;
  currentTime: dayjs.Dayjs;
  loading: boolean;
  swiperCurrent: number;
  scheduleDateWindow: dayjs.Dayjs[];
  openCardId: string | null;
  onOpenCardIdChange: (id: string | null) => void;
  currentCampusId: string;
  currentTeacherId: string;
  currentUserId: string;
  profileId?: string;
  profileCampusId?: string;
  pausedClasses: Class[];
  filteredClasses: Class[];
  teacherById: Record<string, TeacherUIModel>;
  classStudentAvatars: Record<string, ScheduleCardStudentAvatar[]>;
  openClassSlots: Record<string, Record<string, ClassBookingSlot[]>>;
  loadingOpenSlotDates: Set<string>;
  errorOpenSlotDates: Set<string>;
  venues: BookableVenue[];
  loadingVenues: boolean;
  teacherSwitchSheetVisible: boolean;
  onSwitchSheetClose: () => void;
  batchActionSheetVisible: boolean;
  batchClassSheetVisible: boolean;
  batchActionType: BatchActionType;
  batchClassOptions: ScheduleBatchClassOption[];
  batchSelectedClassIds: string[];
  /** 批量提交进行中，见 ScheduleBatchSheets 同名 prop 说明 */
  submitting: boolean;
  dangerActionMeta: DangerActionMeta | null;
  dangerDialogVisible: boolean;
  dangerActionSubmitting: boolean;
  bookSheetVisible: boolean;
  bookSheetItem: ScheduleCardItem | null;
  renderDateCards: (date: dayjs.Dayjs) => {
    cards: ScheduleCardItem[];
    summary: ScheduleDaySummary;
  };
  onPrepareShare: (payload: LessonSharePayload) => void;
  onRunCardButtonAction: (action: () => void) => void;
  onSwiperChange: (e: { detail?: { current?: number; source?: string } }) => void;
  onSwiperFinish: (e: { detail?: { current?: number; source?: string } }) => void;
  onMainTabChange: (tabKey: string, tabIndex: number) => void;
  onLoadOpenClassSlots: (date: dayjs.Dayjs, force?: boolean) => void;
  onOpenBookSheet: (item: ScheduleCardItem) => void;
  onPrimaryAction: (item: ScheduleCardItem, date: dayjs.Dayjs) => void;
  onRollCall: (item: ScheduleCardItem, date: dayjs.Dayjs) => void;
  onSupplement: (item: ScheduleCardItem, date: dayjs.Dayjs) => void;
  onEditSchedule: (item: ScheduleCardItem) => void;
  onClassReschedule: (item: ScheduleCardItem) => void;
  onCancelLesson: (item: ScheduleCardItem) => void;
  onRestoreLesson: (item: ScheduleCardItem) => void;
  onSuspendLesson: (item: ScheduleCardItem) => void;
  onScheduleRuleAction: (
    item: ScheduleCardItem,
    action: Extract<ScheduleDangerActionType, 'pause-rule' | 'resume-rule' | 'stop-rule'>,
  ) => void;
  onResumeClass: (classId: string, className: string) => void;
  onOpenClassSlotConfig: (classId: string, dateStr: string) => void;
  onProxyBooking: (slot: ClassBookingSlot) => void;
  onOpenSlotRollCall: (slot: ClassBookingSlot) => void;
  onEditOpenSlot: (slot: ClassBookingSlot) => void;
  onCancelOpenSlot: (slot: ClassBookingSlot) => void;
  onRestoreOpenSlot: (slot: ClassBookingSlot) => void;
  onSuspendOpenSlot: (slot: ClassBookingSlot, className: string) => void;
  onParentBookOpenSlot: (slot: ClassBookingSlot) => void;
  onParentCancelOpenSlot: (slot: ClassBookingSlot) => void;
  onCloseBatchActionSheet: () => void;
  onChooseBatchType: (type: BatchActionType) => void;
  onCloseBatchClassSheet: () => void;
  onSelectAllBatchClasses: () => void;
  onToggleBatchClassSelection: (classId: string) => void;
  onConfirmBatchClassSelection: () => void;
  onCloseDangerDialog: () => void;
  onConfirmDangerAction: () => void;
  onCreateSchedule: () => void;
  onManageBookingConfig: () => void;
  onCloseBookSheet: () => void;
  onBookTrialByClassSuccess: (payload: { classId: string; lessonDate: string }) => void;
}

const ScheduleMainViews: React.FC<ScheduleMainViewsProps> = (props) => {
  const {
    activeTab,
    activeTabKey,
    tabs,
    isParent,
    selectedDate,
    currentTime,
    loading,
    swiperCurrent,
    scheduleDateWindow,
    openCardId,
    onOpenCardIdChange,
    currentCampusId,
    currentTeacherId,
    currentUserId,
    profileId,
    profileCampusId,
    pausedClasses,
    filteredClasses,
    teacherById,
    classStudentAvatars,
    openClassSlots,
    loadingOpenSlotDates,
    errorOpenSlotDates,
    venues,
    loadingVenues,
    teacherSwitchSheetVisible,
    onSwitchSheetClose,
    batchActionSheetVisible,
    batchClassSheetVisible,
    batchActionType,
    batchClassOptions,
    batchSelectedClassIds,
    submitting,
    dangerActionMeta,
    dangerDialogVisible,
    dangerActionSubmitting,
    bookSheetVisible,
    bookSheetItem,
    renderDateCards,
    onPrepareShare,
    onRunCardButtonAction,
    onSwiperChange,
    onSwiperFinish,
    onMainTabChange,
    onLoadOpenClassSlots,
    onOpenBookSheet,
    onPrimaryAction,
    onRollCall,
    onSupplement,
    onEditSchedule,
    onClassReschedule,
    onCancelLesson,
    onRestoreLesson,
    onSuspendLesson,
    onScheduleRuleAction,
    onResumeClass,
    onOpenClassSlotConfig,
    onProxyBooking,
    onOpenSlotRollCall,
    onEditOpenSlot,
    onCancelOpenSlot,
    onRestoreOpenSlot,
    onSuspendOpenSlot,
    onParentBookOpenSlot,
    onParentCancelOpenSlot,
    onCloseBatchActionSheet,
    onChooseBatchType,
    onCloseBatchClassSheet,
    onSelectAllBatchClasses,
    onToggleBatchClassSelection,
    onConfirmBatchClassSelection,
    onCloseDangerDialog,
    onConfirmDangerAction,
    onCreateSchedule,
    onManageBookingConfig,
    onCloseBookSheet,
    onBookTrialByClassSuccess,
  } = props;

  return (
    <>
      {activeTab?.mode === 'class' && activeTab?.type === 'category' && (
        <ScheduleDateSwiper
          dates={scheduleDateWindow}
          current={swiperCurrent}
          onChange={onSwiperChange}
          onAnimationFinish={onSwiperFinish}
        >
          {(date) => {
            const { cards, summary } = renderDateCards(date);
            return (
              <ScheduleDaySwiperItem
                date={date}
                cards={cards}
                summary={summary}
                loading={loading}
                currentTime={currentTime}
                openCardId={openCardId}
                onOpenCardIdChange={onOpenCardIdChange}
                isParent={isParent}
                currentCampusId={currentCampusId}
                currentTeacherId={currentTeacherId}
                currentUserId={currentUserId}
                profileCampusId={profileCampusId}
                pausedClasses={pausedClasses}
                onPrepareShare={onPrepareShare}
                onRunCardButtonAction={onRunCardButtonAction}
                onOpenBookSheet={onOpenBookSheet}
                onPrimaryAction={onPrimaryAction}
                onRollCall={onRollCall}
                onSupplement={onSupplement}
                onEditSchedule={onEditSchedule}
                onClassReschedule={onClassReschedule}
                onCancelLesson={onCancelLesson}
                onRestoreLesson={onRestoreLesson}
                onSuspendLesson={onSuspendLesson}
                onScheduleRuleAction={onScheduleRuleAction}
                onResumeClass={onResumeClass}
              />
            );
          }}
        </ScheduleDateSwiper>
      )}

      {activeTab?.mode === 'group' && activeTab?.type === 'category' && (
        <ScheduleDateSwiper
          dates={scheduleDateWindow}
          current={swiperCurrent}
          onChange={onSwiperChange}
          onAnimationFinish={onSwiperFinish}
        >
          {(date) => (
            <OpenClassScheduleList
              date={date}
              filteredClasses={filteredClasses}
              openClassSlots={openClassSlots}
              loadingOpenSlotDates={loadingOpenSlotDates}
              errorOpenSlotDates={errorOpenSlotDates}
              openCardId={openCardId}
              onOpenCardIdChange={onOpenCardIdChange}
              teacherById={teacherById}
              currentTime={currentTime}
              isParent={isParent}
              currentCampusId={currentCampusId}
              currentTeacherId={currentTeacherId}
              currentUserId={currentUserId}
              profileId={profileId}
              profileCampusId={profileCampusId}
              classStudentAvatars={classStudentAvatars}
              onLoadOpenClassSlots={onLoadOpenClassSlots}
              onOpenClassSlotConfig={onOpenClassSlotConfig}
              onProxyBooking={onProxyBooking}
              onOpenSlotRollCall={onOpenSlotRollCall}
              onEditOpenSlot={onEditOpenSlot}
              onCancelOpenSlot={onCancelOpenSlot}
              onRestoreOpenSlot={onRestoreOpenSlot}
              onSuspendOpenSlot={onSuspendOpenSlot}
              onResumeClass={onResumeClass}
              onRunCardButtonAction={onRunCardButtonAction}
              onParentBookOpenSlot={onParentBookOpenSlot}
              onParentCancelOpenSlot={onParentCancelOpenSlot}
              onPrepareShare={onPrepareShare}
            />
          )}
        </ScheduleDateSwiper>
      )}

      {(activeTab?.mode === 'class' || activeTab?.mode === 'group') &&
        activeTab?.type === 'category' && (
          <ScheduleBatchSheets
            batchActionSheetVisible={batchActionSheetVisible}
            onCloseBatchActionSheet={onCloseBatchActionSheet}
            onChooseBatchType={onChooseBatchType}
            batchClassSheetVisible={batchClassSheetVisible}
            onCloseBatchClassSheet={onCloseBatchClassSheet}
            batchActionType={batchActionType}
            batchClassOptions={batchClassOptions}
            batchSelectedClassIds={batchSelectedClassIds}
            submitting={submitting}
            onSelectAllBatchClasses={onSelectAllBatchClasses}
            onToggleBatchClassSelection={onToggleBatchClassSelection}
            onConfirmBatchClassSelection={onConfirmBatchClassSelection}
            dangerActionMeta={dangerActionMeta}
            dangerDialogVisible={dangerDialogVisible}
            dangerActionSubmitting={dangerActionSubmitting}
            onCloseDangerDialog={onCloseDangerDialog}
            onConfirmDangerAction={onConfirmDangerAction}
          />
        )}

      {activeTab?.mode === 'private' && activeTab?.type === 'category' && (
        <TrialBookingView
          className="min-h-0 flex-1"
          isParent={isParent}
          onSuccess={() => {
            const firstClassTab = tabs.find((item) => item.mode === 'class');
            const targetKey = firstClassTab?.key || tabs[0]?.key || '';
            const targetIndex = tabs.findIndex((item) => item.key === targetKey);
            onMainTabChange(targetKey, Math.max(0, targetIndex));
          }}
          switchSheetVisible={teacherSwitchSheetVisible}
          onSwitchSheetClose={onSwitchSheetClose}
        />
      )}

      {activeTab?.type === 'venue' && (
        <ScheduleDateSwiper
          dates={scheduleDateWindow}
          current={swiperCurrent}
          onChange={onSwiperChange}
          onAnimationFinish={onSwiperFinish}
        >
          {() => (
            <ScrollView className="h-full bg-schedule-page" scrollY enhanced showScrollbar={false}>
              <ScheduleVenueTab loadingVenues={loadingVenues} venues={venues} />
            </ScrollView>
          )}
        </ScheduleDateSwiper>
      )}

      {!isParent &&
        (activeTab?.mode === 'class' ||
          activeTab?.mode === 'group' ||
          activeTab?.mode === 'private') &&
        activeTab?.type === 'category' && (
          <DraggableFab
            containerSelector="#schedule-page-root"
            storageKey={`schedule-fab-position-${activeTab.mode}`}
            variant="pill"
            label="排课"
            defaultBottomRpx={160}
            defaultRightRpx={32}
            layoutKey={`${activeTabKey}-${activeTab.mode}`}
            onClick={activeTab.mode === 'private' ? onManageBookingConfig : onCreateSchedule}
          />
        )}

      <BookTrialByClassSheet
        visible={bookSheetVisible}
        classId={bookSheetItem?.classId}
        campusId={bookSheetItem?.campusId}
        className={bookSheetItem?.className}
        lessonDate={bookSheetItem ? selectedDate.format('YYYY-MM-DD') : ''}
        startTime={bookSheetItem?.startTime || ''}
        endTime={bookSheetItem?.endTime || ''}
        teacherId={currentTeacherId}
        teacherName={bookSheetItem?.leadTeacherName}
        onClose={onCloseBookSheet}
        onSuccess={onBookTrialByClassSuccess}
      />
    </>
  );
};

export default ScheduleMainViews;
