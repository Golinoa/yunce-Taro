/**
 * 点名页弹层集合（学员多选 / 编辑 / Picker / 日期，从 lesson-form 抽出，Q2-2）
 */
import React, { useMemo } from 'react';
import DatePickerSheet from '@/components/DatePickerSheet';
import PickerSheet, { type PickerOption } from '@/components/PickerSheet';
import StudentMultiSelectSheet from '@/components/StudentMultiSelectSheet';
import type { CampusUIModel, Room, Subject } from '@/types/campus';
import type { Class } from '@/types/class';
import type { CoursePackage } from '@/types/course-package';
import type { Student } from '@/types/student';
import type { TeacherUIModel } from '@/types/teacher';
import StudentEditSheet, { type StudentEditSheetTarget } from './StudentEditSheet';

export type LessonFormSelectorType = 'teacher' | 'campus' | 'room' | 'package' | null;

export interface LessonFormSheetsProps {
  showStudentPicker: boolean;
  allStudents: Student[];
  selectedStudent: Student | null;
  subjectOptions: Subject[];
  onCloseStudentPicker: () => void;
  onConfirmSingleStudent: (ids: string[]) => void;

  showAddStudentSheet: boolean;
  addableStudents: Student[];
  selectedClass: Class | null | undefined;
  addStudentSheetPurpose: 'attendance' | 'supplement';
  onCloseAddStudentSheet: () => void;
  onConfirmAddStudents: (ids: string[]) => void;

  showStudentDetailSheet: boolean;
  detailSheetTarget: StudentEditSheetTarget | null;
  detailSheetRemark: string;
  classes: Class[];
  selectedClassId: string;
  onRemarkChange: (value: string) => void;
  onCloseStudentDetailSheet: () => void;
  onTransferStudent: (student: Student, targetClassId: string) => void;
  onRemoveStudent: (student: Student) => void;
  onConfirmStudentRemark: () => void | Promise<void>;

  selector: { visible: boolean; type: LessonFormSelectorType };
  teacherOptions: TeacherUIModel[];
  campusOptions: CampusUIModel[];
  rooms: Room[];
  studentActivePackages: CoursePackage[];
  selectedTeachingTeacherId: string;
  campusId: string;
  matchedPackageId: string;
  room: string;
  onCloseSelector: () => void;
  onConfirmSelector: (value: string) => void;

  lessonDatePickerVisible: boolean;
  lessonDate: string;
  onCloseLessonDatePicker: () => void;
  onConfirmLessonDate: (date: string) => void;
}

const LessonFormSheets: React.FC<LessonFormSheetsProps> = ({
  showStudentPicker,
  allStudents,
  selectedStudent,
  subjectOptions,
  onCloseStudentPicker,
  onConfirmSingleStudent,
  showAddStudentSheet,
  addableStudents,
  selectedClass,
  addStudentSheetPurpose,
  onCloseAddStudentSheet,
  onConfirmAddStudents,
  showStudentDetailSheet,
  detailSheetTarget,
  detailSheetRemark,
  classes,
  selectedClassId,
  onRemarkChange,
  onCloseStudentDetailSheet,
  onTransferStudent,
  onRemoveStudent,
  onConfirmStudentRemark,
  selector,
  teacherOptions,
  campusOptions,
  rooms,
  studentActivePackages,
  selectedTeachingTeacherId,
  campusId,
  matchedPackageId,
  room,
  onCloseSelector,
  onConfirmSelector,
  lessonDatePickerVisible,
  lessonDate,
  onCloseLessonDatePicker,
  onConfirmLessonDate,
}) => {
  const selectorTitle = useMemo(() => {
    if (selector.type === 'teacher') return '选择主讲老师';
    if (selector.type === 'campus') return '选择校区';
    if (selector.type === 'package') return '选择消课课包';
    return '选择教室';
  }, [selector.type]);

  const selectorOptions = useMemo((): PickerOption[] => {
    if (selector.type === 'teacher') {
      return teacherOptions.map((t) => ({ label: t.name, value: t.id }));
    }
    if (selector.type === 'campus') {
      return [
        { label: '请选择', value: '' },
        ...campusOptions.map((c) => ({ label: c.name, value: c.id })),
      ];
    }
    if (selector.type === 'package') {
      return studentActivePackages.map((p) => ({
        label: `${p.name}（剩 ${p.remaining_hours} 课时）`,
        value: p.id,
      }));
    }
    return [
      { label: '请选择', value: '' },
      ...rooms.filter((r) => r.status === 'active').map((r) => ({ label: r.name, value: r.name })),
    ];
  }, [campusOptions, rooms, selector.type, studentActivePackages, teacherOptions]);

  const selectorValue = useMemo(() => {
    if (selector.type === 'teacher') return selectedTeachingTeacherId;
    if (selector.type === 'campus') return campusId;
    if (selector.type === 'package') return matchedPackageId;
    return room;
  }, [campusId, matchedPackageId, room, selectedTeachingTeacherId, selector.type]);

  return (
    <>
      {/* ====== 学员选择弹窗：与课程管理 ClassStudentsCard「选择上课学员」同款 ====== */}
      <StudentMultiSelectSheet
        visible={showStudentPicker}
        students={allStudents}
        selectedIds={selectedStudent ? [selectedStudent.id] : []}
        subjects={subjectOptions}
        maxSelectable={1}
        showUnscheduledFilter
        title="选择上课学员"
        onClose={onCloseStudentPicker}
        onConfirm={onConfirmSingleStudent}
      />

      <StudentMultiSelectSheet
        visible={showAddStudentSheet}
        students={addableStudents}
        selectedIds={[]}
        subjects={subjectOptions}
        subjectId={selectedClass?.subject_id}
        title={addStudentSheetPurpose === 'supplement' ? '选择补录学员' : '添加学员到点名名单'}
        onClose={onCloseAddStudentSheet}
        onConfirm={onConfirmAddStudents}
      />

      {/* ====== 学员编辑弹窗 ====== */}
      <StudentEditSheet
        visible={showStudentDetailSheet}
        target={detailSheetTarget}
        remark={detailSheetRemark}
        classes={classes}
        selectedClassId={selectedClassId}
        onRemarkChange={onRemarkChange}
        onClose={onCloseStudentDetailSheet}
        onTransfer={onTransferStudent}
        onRemove={onRemoveStudent}
        onConfirm={onConfirmStudentRemark}
      />

      {/* 统一弹窗选择器（PickerSheet 标准组件） */}
      <PickerSheet
        visible={selector.visible}
        title={selectorTitle}
        options={selectorOptions}
        value={selectorValue}
        onClose={onCloseSelector}
        onConfirm={onConfirmSelector}
      />

      <DatePickerSheet
        visible={lessonDatePickerVisible}
        title="选择上课日期"
        value={lessonDate}
        onClose={onCloseLessonDatePicker}
        onConfirm={onConfirmLessonDate}
      />
    </>
  );
};

export default LessonFormSheets;
