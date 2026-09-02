/**
 * 课程表单 · 高级设置区块（W2 拆页）
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React from 'react';
import Card from '@/components/Card';
import ClassStudentsCard from '@/components/course/ClassStudentsCard';
import CourseImageUploader from '@/components/CourseImageUploader';
import FormInput from '@/components/FormInput';
import FormRow from '@/components/FormRow';
import {
  AGE_GROUP_OPTIONS,
  CHECKIN_ROLE_OPTIONS,
  DEADLINE_OPTIONS,
  STUDENT_SELF_CHECKIN_OPTIONS,
} from '@/constants/course-template-ui';
import type { Subject } from '@/types/campus';
import { CLASS_LEVEL_BADGE_WRAP, CLASS_LEVEL_BADGE_TEXT, CLASS_LEVEL_LABELS } from '@/types/class';
import type { CheckinRole } from '@/types/course-template';
import type { Student } from '@/types/student';
import type { TeacherUIModel } from '@/types/teacher';
import { TOOLTIPS, type FormErrors, type PickerType } from './course-form-constants';
import SectionTitle from './SectionTitle';

export interface CourseFormAdvancedPanelProps {
  isClassMode: boolean;
  isGroupMode: boolean;
  teacherId: string;
  assistantId: string;
  teachers: TeacherUIModel[];
  hoursPerLesson: string;
  feePerLesson: string;
  color: string;
  ageGroup: string;
  level: string;
  studentIds: string[];
  selectedStudents: Student[];
  studentList: Student[];
  subjectId: string;
  subjects: Subject[];
  capacity: string;
  experiencePrice: string;
  price: string;
  minOpenCount: string;
  bookingDeadline: string;
  cancelQueueTime: string;
  nonCancelTime: string;
  autoCheckin: string;
  studentSelfCheckin: string;
  allowCheckinRoles: CheckinRole[];
  description: string;
  backgroundImage: string;
  homeImage: string;
  errors: FormErrors;
  scrollTopRef: React.MutableRefObject<number>;
  onOpenPicker: (type: PickerType) => void;
  onOpenColorPicker: () => void;
  onOpenRolePicker: () => void;
  onHoursPerLessonInput: (value: string) => void;
  onFeePerLessonInput: (value: string) => void;
  onExperiencePriceInput: (value: string) => void;
  onPriceInput: (value: string) => void;
  onMinOpenCountInput: (value: string) => void;
  onDescriptionInput: (value: string) => void;
  onHomeImageChange: (value: string) => void;
  onStudentIdsChange: (ids: string[]) => void;
  onScrollRestore: (top: number) => void;
}

const CourseFormAdvancedPanel: React.FC<CourseFormAdvancedPanelProps> = ({
  isClassMode,
  isGroupMode,
  teacherId,
  assistantId,
  teachers,
  hoursPerLesson,
  feePerLesson,
  color,
  ageGroup,
  level,
  studentIds,
  selectedStudents,
  studentList,
  subjectId,
  subjects,
  capacity,
  experiencePrice,
  price,
  minOpenCount,
  bookingDeadline,
  cancelQueueTime,
  nonCancelTime,
  autoCheckin,
  studentSelfCheckin,
  allowCheckinRoles,
  description,
  backgroundImage,
  homeImage,
  errors,
  scrollTopRef,
  onOpenPicker,
  onOpenColorPicker,
  onOpenRolePicker,
  onHoursPerLessonInput,
  onFeePerLessonInput,
  onExperiencePriceInput,
  onPriceInput,
  onMinOpenCountInput,
  onDescriptionInput,
  onHomeImageChange,
  onStudentIdsChange,
  onScrollRestore,
}) => (
  <View className="flex flex-col gap-[24rpx]">
    {isClassMode && (
      <Card className="p-[32rpx]">
        <SectionTitle title="班课信息" />
        <View className="flex flex-col">
          <FormRow label="授课老师" onClick={() => onOpenPicker('teacher')} border>
            <Text
              className={cn(
                'text-[30rpx]',
                teacherId ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {teacherId ? teachers.find((t) => t.id === teacherId)?.name : '请选择'}
            </Text>
          </FormRow>
          <FormRow label="助教" onClick={() => onOpenPicker('assistant')} border>
            <Text
              className={cn(
                'text-[30rpx]',
                assistantId ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {assistantId ? teachers.find((t) => t.id === assistantId)?.name : '请选择'}
            </Text>
          </FormRow>
          <FormRow
            label="消耗课时"
            editable
            placeholder="请输入"
            value={hoursPerLesson}
            onInput={(e) => onHoursPerLessonInput(e.detail.value)}
            inputType="digit"
            suffix="课时"
            border
          />
          <FormRow
            label="授课扣费"
            editable
            placeholder="请输入"
            value={feePerLesson}
            onInput={(e) => onFeePerLessonInput(e.detail.value)}
            inputType="digit"
            suffix="元"
            border={false}
          />
        </View>
      </Card>
    )}

    <Card className="p-[32rpx]">
      <SectionTitle title="课程展示" />
      <View className="flex flex-col">
        <FormRow label="课程颜色" hint={TOOLTIPS.color} onClick={onOpenColorPicker}>
          {color ? (
            <View className="flex flex-row items-center gap-[12rpx]">
              <View
                className="w-[32rpx] h-[32rpx] rounded-[8rpx]"
                style={{ backgroundColor: color }}
              />
              <Text className="text-[30rpx] text-foreground">已选择</Text>
            </View>
          ) : (
            <Text className="text-[30rpx] text-muted-foreground">请选择</Text>
          )}
        </FormRow>
        <FormRow label="年龄组" onClick={() => onOpenPicker('ageGroup')} border>
          <Text className="text-[30rpx] text-foreground">
            {ageGroup.startsWith('custom:')
              ? ageGroup.slice('custom:'.length)
              : AGE_GROUP_OPTIONS.find((a) => a.value === ageGroup)?.label}
          </Text>
        </FormRow>
        <FormRow label="课程难度" onClick={() => onOpenPicker('level')} border={false}>
          <View className={CLASS_LEVEL_BADGE_WRAP}>
            <Text className={CLASS_LEVEL_BADGE_TEXT}>
              {level.startsWith('custom:')
                ? level.slice('custom:'.length)
                : CLASS_LEVEL_LABELS[level as keyof typeof CLASS_LEVEL_LABELS]}
            </Text>
          </View>
        </FormRow>
      </View>
    </Card>

    {/*
      上课学员：仅班课展示。
      团课为预约制，暂无「固定参团」概念 → 页面隐藏；组件与状态保留便于日后开通。
      恢复：去掉外层 isClassMode 条件即可（或改为 isClassMode || SHOW_GROUP_ROSTER）。
    */}
    {isClassMode && (
      <ClassStudentsCard
        studentIds={studentIds}
        students={selectedStudents}
        allStudents={studentList}
        subjectId={subjectId}
        subjects={subjects}
        maxSelectable={Number(capacity) > 0 ? Number(capacity) : undefined}
        onChange={onStudentIdsChange}
      />
    )}
    {false && isGroupMode && (
      // 团课上课学员（固定参团）— 产品未上线，勿删，仅作占位保留
      <ClassStudentsCard
        studentIds={studentIds}
        students={selectedStudents}
        allStudents={studentList}
        subjectId={subjectId}
        subjects={subjects}
        maxSelectable={Number(capacity) > 0 ? Number(capacity) : undefined}
        onChange={onStudentIdsChange}
      />
    )}

    {!isClassMode && (
      <>
        <Card className="p-[32rpx]">
          <SectionTitle title="开课与价格" />
          <View className="flex flex-col">
            <FormRow
              label="新客体验价"
              editable
              placeholder="必填项"
              value={experiencePrice}
              onInput={(e) => onExperiencePriceInput(e.detail.value)}
              inputType="digit"
              suffix="元"
              error={errors.experiencePrice}
              border
            />
            <FormRow
              label="单价"
              hint={TOOLTIPS.price}
              editable
              placeholder="必填项"
              value={price}
              onInput={(e) => onPriceInput(e.detail.value)}
              inputType="digit"
              suffix="元"
              error={errors.price}
              border
            />
            <FormRow
              label="最低开课人数"
              editable
              placeholder="请选择"
              value={minOpenCount}
              onInput={(e) => onMinOpenCountInput(e.detail.value)}
              inputType="number"
              border={false}
            />
          </View>
        </Card>

        <Card className="p-[32rpx]">
          <SectionTitle title="预约规则" />
          <View className="flex flex-col">
            <FormRow label="截止预约时间" onClick={() => onOpenPicker('deadline')} border>
              <Text className="text-[30rpx] text-foreground">
                {DEADLINE_OPTIONS.find((d) => String(d.value) === bookingDeadline)?.label}
              </Text>
            </FormRow>
            <FormRow label="取消排队时间" onClick={() => onOpenPicker('cancelQueue')} border>
              <Text className="text-[30rpx] text-foreground">
                {DEADLINE_OPTIONS.find((d) => String(d.value) === cancelQueueTime)?.label}
              </Text>
            </FormRow>
            <FormRow label="不可取消时间" onClick={() => onOpenPicker('nonCancel')} border={false}>
              <Text className="text-[30rpx] text-foreground">
                {DEADLINE_OPTIONS.find((d) => String(d.value) === nonCancelTime)?.label}
              </Text>
            </FormRow>
          </View>
        </Card>

        <Card className="p-[32rpx]">
          <SectionTitle title="签到规则" />
          <View className="flex flex-col">
            <FormRow
              label="自动签到"
              hint={TOOLTIPS.autoCheckin}
              onClick={() => onOpenPicker('autoCheckin')}
              border
            >
              <Text className="text-[30rpx] text-foreground">
                {STUDENT_SELF_CHECKIN_OPTIONS.find((s) => s.value === autoCheckin)?.label}
              </Text>
            </FormRow>
            <FormRow
              label="学员自助签到"
              hint={TOOLTIPS.selfCheckin}
              onClick={() => onOpenPicker('selfCheckin')}
              border
            >
              <Text className="text-[30rpx] text-foreground">
                {STUDENT_SELF_CHECKIN_OPTIONS.find((s) => s.value === studentSelfCheckin)?.label}
              </Text>
            </FormRow>
            <FormRow
              label="允许签到角色"
              hint={TOOLTIPS.allowCheckinRoles}
              onClick={onOpenRolePicker}
              border={false}
            >
              <Text className="text-[30rpx] text-foreground">
                {allowCheckinRoles.length > 0
                  ? allowCheckinRoles
                      .map((r) => CHECKIN_ROLE_OPTIONS.find((o) => o.value === r)?.label)
                      .filter(Boolean)
                      .join('、')
                  : '请选择'}
              </Text>
            </FormRow>
          </View>
        </Card>
      </>
    )}

    <Card className="p-[32rpx]">
      <SectionTitle title="课程介绍" />
      <FormInput
        label="课程简介"
        placeholder="暂无"
        value={description}
        onInput={(e) => onDescriptionInput(e.detail.value)}
        multiline
        minHeight="200rpx"
      />
    </Card>

    <Card className="p-[32rpx]">
      <SectionTitle title="课程图片" />
      <View className="flex flex-col gap-[40rpx]">
        <View className="flex flex-col gap-[16rpx]">
          <View className="flex flex-row items-center gap-[12rpx]">
            <Text className="text-[30rpx] font-medium text-foreground">课程背景图</Text>
            <View className="px-[16rpx] py-[6rpx] rounded-full bg-primary/10">
              <Text className="text-[22rpx] text-primary font-medium">约课首页</Text>
            </View>
            <View className="px-[16rpx] py-[6rpx] rounded-full bg-muted">
              <Text className="text-[22rpx] font-medium text-muted-foreground">敬请期待</Text>
            </View>
          </View>
          <Text className="text-[24rpx] text-muted-foreground leading-relaxed">
            显示在首页课程卡底尾。建议使用 405×190 横图，未上传将使用默认背景。
          </Text>
          <View className="relative opacity-55">
            <CourseImageUploader
              value={backgroundImage}
              onChange={() => undefined}
              title="上传背景图"
              subtitle="功能即将开放"
              layout="fullWidth"
              scrollTopRef={scrollTopRef}
              onScrollRestore={onScrollRestore}
            />
            <View
              className="absolute inset-0 z-10"
              onClick={() => Taro.showToast({ title: '敬请期待', icon: 'none' })}
            />
          </View>
        </View>

        <View className="h-[1rpx] bg-border/30" />

        <View className="flex flex-col gap-[16rpx]">
          <View className="flex flex-row items-center gap-[12rpx]">
            <Text className="text-[30rpx] font-medium text-foreground">课程封面</Text>
            <View className="px-[16rpx] py-[6rpx] rounded-full bg-primary/10">
              <Text className="text-[22rpx] text-primary font-medium">分享使用</Text>
            </View>
          </View>
          <View className="flex flex-row items-start gap-[24rpx]">
            <View className="flex-1 min-w-0">
              <Text className="text-[24rpx] text-muted-foreground leading-relaxed">
                用于分享课程、生成课表推荐等场景，推荐清晰方图。未上传不影响首页背景图。
              </Text>
            </View>
            <CourseImageUploader
              value={homeImage}
              onChange={(v) => onHomeImageChange(v ?? '')}
              title="上传封面"
              layout="square"
              squareSizeRpx={200}
              scrollTopRef={scrollTopRef}
              onScrollRestore={onScrollRestore}
            />
          </View>
        </View>
      </View>
    </Card>
  </View>
);

export default CourseFormAdvancedPanel;
