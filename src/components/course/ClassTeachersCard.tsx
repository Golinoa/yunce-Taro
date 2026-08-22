/**
 * ClassTeachersCard - 班课信息卡片（授课老师 / 助教）
 *
 * 从 course-form「班课信息」区块抽离，行内展示授课老师/助教，
 * 行点击通过 onPickTeacher / onPickAssistant 回调由父组件打开 PickerSheet。
 *
 * 未传入回调时为只读展示。
 */
import { Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Card from '@/components/Card';
import FormRow from '@/components/FormRow';

export interface ClassTeachersCardProps {
  /** 授课老师姓名 */
  teacherName?: string;
  /** 助教姓名 */
  assistantName?: string;
  /** 点击「授课老师」行回调（不传则只读） */
  onPickTeacher?: () => void;
  /** 点击「助教」行回调（不传则只读） */
  onPickAssistant?: () => void;
}

const ClassTeachersCard: React.FC<ClassTeachersCardProps> = ({
  teacherName,
  assistantName,
  onPickTeacher,
  onPickAssistant,
}) => (
  <Card className="p-[32rpx]">
    <FormRow label="授课老师" onClick={onPickTeacher} border>
      <Text
        className={cn('text-[30rpx]', teacherName ? 'text-foreground' : 'text-muted-foreground')}
      >
        {teacherName || '请选择'}
      </Text>
    </FormRow>
    <FormRow label="助教" onClick={onPickAssistant} border={false}>
      <Text
        className={cn('text-[30rpx]', assistantName ? 'text-foreground' : 'text-muted-foreground')}
      >
        {assistantName || '请选择'}
      </Text>
    </FormRow>
  </Card>
);

export default ClassTeachersCard;
