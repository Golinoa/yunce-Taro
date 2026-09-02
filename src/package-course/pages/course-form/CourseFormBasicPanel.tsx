/**
 * 课程表单 · 基础信息卡片（W2 拆页）
 */
import { Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Card from '@/components/Card';
import FormRow from '@/components/FormRow';
import Switch from '@/components/Switch';
import type { Subject } from '@/types/campus';
import type { CourseCategoryConfig } from '@/types/course-category';
import type { FormErrors, PickerType } from './course-form-constants';

export interface CourseFormBasicPanelProps {
  name: string;
  selectedCategory?: CourseCategoryConfig;
  isClassMode: boolean;
  subjectId: string;
  subjects: Subject[];
  duration: string;
  capacity: string;
  endClassEnabled: boolean;
  maxLessons: string;
  errors: FormErrors;
  onNameInput: (value: string) => void;
  onDurationInput: (value: string) => void;
  onCapacityInput: (e: { detail: { value: string } }) => void;
  onMaxLessonsInput: (value: string) => void;
  onEndClassChange: (on: boolean) => void;
  onOpenPicker: (type: PickerType) => void;
}

const CourseFormBasicPanel: React.FC<CourseFormBasicPanelProps> = ({
  name,
  selectedCategory,
  isClassMode,
  subjectId,
  subjects,
  duration,
  capacity,
  endClassEnabled,
  maxLessons,
  errors,
  onNameInput,
  onDurationInput,
  onCapacityInput,
  onMaxLessonsInput,
  onEndClassChange,
  onOpenPicker,
}) => (
  <Card className="p-[32rpx]">
    <FormRow
      label="课程名称"
      required
      editable
      placeholder="请输入课程名称"
      value={name}
      onInput={(e) => onNameInput(e.detail.value)}
      error={errors.name}
    />

    <FormRow
      label="所属分类"
      required
      onClick={() => onOpenPicker('category')}
      error={errors.categoryId}
    >
      <Text
        className={cn(
          'text-[30rpx]',
          selectedCategory ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {selectedCategory?.name ?? '请选择'}
      </Text>
    </FormRow>

    {isClassMode && (
      <FormRow
        label="所属科目"
        required
        onClick={() => onOpenPicker('subject')}
        error={errors.subjectId}
      >
        <Text
          className={cn('text-[30rpx]', subjectId ? 'text-foreground' : 'text-muted-foreground')}
        >
          {subjectId ? subjects.find((s) => s.id === subjectId)?.name : '请选择'}
        </Text>
      </FormRow>
    )}

    <FormRow
      label="课程时长（分）"
      required
      editable
      placeholder="请输入课程时长"
      value={duration}
      onInput={(e) => onDurationInput(e.detail.value)}
      inputType="number"
      error={errors.duration}
    />

    <FormRow
      label="容纳人数（人）"
      editable
      placeholder="留空不限制人数"
      value={capacity}
      onInput={onCapacityInput}
      inputType="number"
      error={errors.capacity}
    />

    {isClassMode ? (
      <>
        <FormRow label="结束班级" border={false}>
          <Switch checked={endClassEnabled} onChange={onEndClassChange} />
        </FormRow>
        {endClassEnabled ? (
          <FormRow
            label="上限课时"
            required
            editable
            placeholder="上完这么多课即结束"
            value={maxLessons}
            onInput={(e) => onMaxLessonsInput(e.detail.value)}
            inputType="number"
            error={errors.maxLessons}
            helperText="与排课「限日期/按次数」同时生效，先到先结束"
          />
        ) : null}
      </>
    ) : null}
  </Card>
);

export default CourseFormBasicPanel;
