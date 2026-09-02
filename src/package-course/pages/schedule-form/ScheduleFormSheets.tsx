/**
 * 排课表单：底部弹层与冲突对话框（Q2-3）
 */
import dayjs from 'dayjs';
import React from 'react';
import CalendarMonthSheet from '@/components/CalendarMonthSheet';
import type { CalendarDotType } from '@/components/CalendarWeekSelector';
import ClassPickerSheet from '@/components/course/ClassPickerSheet';
import PickerSheet, { PickerOption } from '@/components/PickerSheet';
import ScheduleConflictDialog from '@/components/schedule/ScheduleConflictDialog';
import TimePickerSheet from '@/components/TimePickerSheet';
import type { Room } from '@/types/campus';
import type { Class, ClassLevel } from '@/types/class';
import { CLASS_LEVEL_LABELS } from '@/types/class';
import type { DayOfWeek } from '@/types/schedule';
import type { ScheduleConflictItem } from '@/types/schedule-conflict';
import type { TeacherUIModel } from '@/types/teacher';
import { END_MODE_OPTIONS, type EndMode } from './schedule-form-constants';

export type ScheduleFormSheetsProps = {
  calendarVisible: boolean;
  startDate: string;
  onCloseCalendar: () => void;
  onSelectStartDate: (date: string, dayOfWeek: DayOfWeek) => void;
  getDateDotType: (date: dayjs.Dayjs) => CalendarDotType;

  endDateCalendarVisible: boolean;
  endDate: string;
  onCloseEndDateCalendar: () => void;
  onSelectEndDate: (date: string) => void;

  freeCalendarVisible: boolean;
  freeDates: string[];
  onCloseFreeCalendar: () => void;
  onSelectFreeDates: (dates: string[]) => void;

  typePickerVisible: boolean;
  isGroupMode: boolean;
  onCloseTypePicker: () => void;
  onConfirmType: (next: 'class' | 'group') => void;

  classPickerVisible: boolean;
  classes: Class[];
  scheduledClassIds: Set<string> | string[];
  classId: string;
  onCloseClassPicker: () => void;
  onConfirmClass: (id: string) => void;

  roomPickerVisible: boolean;
  rooms: Room[];
  room: string;
  onCloseRoomPicker: () => void;
  onConfirmRoom: (value: string) => void;

  endModePickerVisible: boolean;
  endMode: EndMode;
  onCloseEndModePicker: () => void;
  onConfirmEndMode: (value: EndMode) => void;

  teacherPickerVisible: boolean;
  teachers: TeacherUIModel[];
  selectedTeachingTeacherId: string;
  onCloseTeacherPicker: () => void;
  onConfirmTeacher: (id: string) => void;

  assistantPickerVisible: boolean;
  selectedAssistantTeacherId: string;
  onCloseAssistantPicker: () => void;
  onConfirmAssistant: (id: string) => void;

  levelPickerVisible: boolean;
  courseLevel: ClassLevel;
  onCloseLevelPicker: () => void;
  onConfirmLevel: (level: ClassLevel) => void;

  timePickerVisible: boolean;
  timePickerTitle: string;
  timePickerValue: string;
  onCloseTimePicker: () => void;
  onConfirmTime: (value: string) => void;

  conflictDialogVisible: boolean;
  conflictSummary: string;
  conflicts: ScheduleConflictItem[];
  onConflictModify: () => void;
  onConflictIgnore: () => void;
};

const ScheduleFormSheets: React.FC<ScheduleFormSheetsProps> = ({
  calendarVisible,
  startDate,
  onCloseCalendar,
  onSelectStartDate,
  getDateDotType,
  endDateCalendarVisible,
  endDate,
  onCloseEndDateCalendar,
  onSelectEndDate,
  freeCalendarVisible,
  freeDates,
  onCloseFreeCalendar,
  onSelectFreeDates,
  typePickerVisible,
  isGroupMode,
  onCloseTypePicker,
  onConfirmType,
  classPickerVisible,
  classes,
  scheduledClassIds,
  classId,
  onCloseClassPicker,
  onConfirmClass,
  roomPickerVisible,
  rooms,
  room,
  onCloseRoomPicker,
  onConfirmRoom,
  endModePickerVisible,
  endMode,
  onCloseEndModePicker,
  onConfirmEndMode,
  teacherPickerVisible,
  teachers,
  selectedTeachingTeacherId,
  onCloseTeacherPicker,
  onConfirmTeacher,
  assistantPickerVisible,
  selectedAssistantTeacherId,
  onCloseAssistantPicker,
  onConfirmAssistant,
  levelPickerVisible,
  courseLevel,
  onCloseLevelPicker,
  onConfirmLevel,
  timePickerVisible,
  timePickerTitle,
  timePickerValue,
  onCloseTimePicker,
  onConfirmTime,
  conflictDialogVisible,
  conflictSummary,
  conflicts,
  onConflictModify,
  onConflictIgnore,
}) => (
  <>
    {/* 开始日期 */}
    <CalendarMonthSheet
      visible={calendarVisible}
      title="选择开始日期"
      selectedDate={dayjs(startDate)}
      onClose={onCloseCalendar}
      onSelect={(d) => {
        onSelectStartDate(d.format('YYYY-MM-DD'), (d.day() || 7) as DayOfWeek);
      }}
      getDateDotType={getDateDotType}
      disablePastDates
    />

    {/* 结束日期 */}
    <CalendarMonthSheet
      visible={endDateCalendarVisible}
      title="选择结束日期"
      selectedDate={dayjs(endDate)}
      onClose={onCloseEndDateCalendar}
      onSelect={(d) => onSelectEndDate(d.format('YYYY-MM-DD'))}
      disablePastDates
    />

    {/* 自由排课：课表同款月历多选 */}
    <CalendarMonthSheet
      visible={freeCalendarVisible}
      title="选择上课日期"
      selectedDate={dayjs(freeDates[freeDates.length - 1] || startDate)}
      selectedDates={freeDates}
      multiSelect
      onClose={onCloseFreeCalendar}
      onSelect={() => undefined}
      onSelectMulti={onSelectFreeDates}
      getDateDotType={getDateDotType}
      disablePastDates
    />

    <PickerSheet
      visible={typePickerVisible}
      title="课程类型"
      options={[
        { label: '班课', value: 'class' },
        { label: '团课', value: 'group' },
      ]}
      value={isGroupMode ? 'group' : 'class'}
      onClose={onCloseTypePicker}
      onConfirm={(v) => {
        onConfirmType(v === 'group' ? 'group' : 'class');
      }}
    />

    <ClassPickerSheet
      visible={classPickerVisible}
      title={isGroupMode ? '选择团课班级' : '选择班级'}
      courseMode={isGroupMode ? 'group' : 'class'}
      classes={classes}
      scheduledClassIds={scheduledClassIds}
      value={classId}
      onClose={onCloseClassPicker}
      onConfirm={onConfirmClass}
    />

    <PickerSheet
      visible={roomPickerVisible}
      title="选择上课教室"
      options={[
        { label: '不指定教室', value: '' },
        ...rooms.map((r): PickerOption => ({ label: r.name, value: r.id || r.name })),
      ]}
      value={room}
      onClose={onCloseRoomPicker}
      onConfirm={onConfirmRoom}
    />

    <PickerSheet
      visible={endModePickerVisible}
      title="结束方式"
      options={END_MODE_OPTIONS.map((o): PickerOption => ({ label: o.label, value: o.value }))}
      value={endMode}
      onClose={onCloseEndModePicker}
      onConfirm={(v) => onConfirmEndMode(v as EndMode)}
    />

    <PickerSheet
      visible={teacherPickerVisible}
      title="选择老师"
      options={[
        { label: '请选择', value: '' },
        ...teachers
          .filter((t) => t.role !== 'assist' || t.id === selectedTeachingTeacherId)
          .map((t): PickerOption => ({ label: t.name, value: t.id })),
      ]}
      value={selectedTeachingTeacherId}
      onClose={onCloseTeacherPicker}
      onConfirm={onConfirmTeacher}
    />

    <PickerSheet
      visible={assistantPickerVisible}
      title="选择助教"
      options={[
        { label: '未安排', value: '' },
        ...teachers
          .filter(
            (t) =>
              t.id !== selectedTeachingTeacherId &&
              (t.role === 'assist' || t.id === selectedAssistantTeacherId),
          )
          .map((t): PickerOption => ({ label: t.name, value: t.id })),
      ]}
      value={selectedAssistantTeacherId}
      onClose={onCloseAssistantPicker}
      onConfirm={onConfirmAssistant}
    />

    <PickerSheet
      visible={levelPickerVisible}
      title="课程难度"
      options={(Object.keys(CLASS_LEVEL_LABELS) as ClassLevel[]).map(
        (k): PickerOption => ({ label: CLASS_LEVEL_LABELS[k], value: k }),
      )}
      value={courseLevel}
      onClose={onCloseLevelPicker}
      onConfirm={(v) => onConfirmLevel(v as ClassLevel)}
    />

    <TimePickerSheet
      visible={timePickerVisible}
      title={timePickerTitle}
      value={timePickerValue}
      onClose={onCloseTimePicker}
      onConfirm={onConfirmTime}
    />

    <ScheduleConflictDialog
      visible={conflictDialogVisible}
      conflictSummary={conflictSummary}
      conflicts={conflicts}
      onModify={onConflictModify}
      onIgnore={onConflictIgnore}
    />
  </>
);

export default ScheduleFormSheets;
