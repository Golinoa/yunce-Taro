/**
 * 单人消课表单面板（从 lesson-form 抽出，Q2-2）
 */
import { View, Text, Picker, Textarea, Image } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Card from '@/components/Card';
import FormRow from '@/components/FormRow';
import Icon from '@/components/Icon';
import StarRating from '@/components/StarRating';
import Stepper from '@/components/Stepper';
import StudentAvatar from '@/components/student/StudentAvatar';
import type { CampusUIModel, Subject } from '@/types/campus';
import type { CoursePackage } from '@/types/course-package';
import type { Student } from '@/types/student';
import type { TeacherUIModel } from '@/types/teacher';

export interface SingleLessonPanelProps {
  selectedStudent: Student | null;
  studentActivePackages: CoursePackage[];
  matchedPackage: CoursePackage | null | undefined;
  matchedSubject: Subject | null | undefined;
  hoursUsed: number;
  lessonDate: string;
  lessonTime: string;
  campusId: string;
  campusOptions: CampusUIModel[];
  room: string;
  selectedTeachingTeacher: TeacherUIModel | null | undefined;
  profileName?: string;
  content: string;
  performance: number;
  homework: string;
  homeworkImages: string[];
  uploading: boolean;
  onOpenStudentPicker: () => void;
  onOpenPackageSelector: () => void;
  onOpenTeacherSelector: () => void;
  onHoursChange: (value: number) => void;
  onOpenDatePicker: () => void;
  onLessonTimeChange: (value: string) => void;
  onOpenCampusSelector: () => void;
  onOpenRoomSelector: () => void;
  onContentChange: (value: string) => void;
  onPerformanceChange: (value: number) => void;
  onHomeworkChange: (value: string) => void;
  onRemoveImage: (index: number) => void;
  onUploadImage: () => void | Promise<void>;
}

const SingleLessonPanel: React.FC<SingleLessonPanelProps> = ({
  selectedStudent,
  studentActivePackages,
  matchedPackage,
  matchedSubject,
  hoursUsed,
  lessonDate,
  lessonTime,
  campusId,
  campusOptions,
  room,
  selectedTeachingTeacher,
  profileName,
  content,
  performance,
  homework,
  homeworkImages,
  uploading,
  onOpenStudentPicker,
  onOpenPackageSelector,
  onOpenTeacherSelector,
  onHoursChange,
  onOpenDatePicker,
  onLessonTimeChange,
  onOpenCampusSelector,
  onOpenRoomSelector,
  onContentChange,
  onPerformanceChange,
  onHomeworkChange,
  onRemoveImage,
  onUploadImage,
}) => {
  return (
    <View className="px-[32rpx] py-[24rpx] pb-[32rpx] flex flex-col gap-[24rpx]">
      {/* 选择学员 */}
      <Card className="p-[32rpx]" marginBottom={false}>
        <FormRow label="选择学员" required border={false} onClick={onOpenStudentPicker}>
          {selectedStudent ? (
            <View className="flex flex-row items-center gap-[12rpx] min-w-0">
              <StudentAvatar
                name={selectedStudent.name}
                src={selectedStudent.avatar_url}
                size="sm"
              />
              <View className="min-w-0 flex-1">
                <Text className="block text-[30rpx] text-foreground truncate">
                  {selectedStudent.name}
                  {selectedStudent.nickname ? `（${selectedStudent.nickname}）` : ''}
                </Text>
              </View>
              <Text className="text-[24rpx] text-primary shrink-0">更换</Text>
            </View>
          ) : (
            <Text className="text-[30rpx] text-muted-foreground">请选择学员</Text>
          )}
        </FormRow>
      </Card>

      {/* 消课信息（选学员后显示） */}
      {selectedStudent ? (
        <>
          <Card className="p-[32rpx]" marginBottom={false}>
            <FormRow
              label="消课课包"
              required
              border
              helperText={
                studentActivePackages.length > 1
                  ? `该学员有 ${studentActivePackages.length} 个课包，请选择本次消课课包`
                  : undefined
              }
              onClick={studentActivePackages.length > 1 ? onOpenPackageSelector : undefined}
            >
              {matchedPackage ? (
                <View className="min-w-0 flex-1">
                  <Text className="block text-[30rpx] text-foreground truncate text-right">
                    {matchedPackage.name}
                  </Text>
                  <Text className="block text-[22rpx] text-muted-foreground text-right mt-[4rpx]">
                    {matchedSubject?.name ? `${matchedSubject.name} · ` : ''}
                    剩余 {matchedPackage.remaining_hours} 课时
                    {matchedPackage.remaining_hours < hoursUsed ? ' · 将欠课' : ''}
                  </Text>
                </View>
              ) : (
                <Text className="text-[30rpx] text-destructive">无可用课包</Text>
              )}
            </FormRow>

            <FormRow label="主讲老师" required border onClick={onOpenTeacherSelector}>
              <Text className="text-[30rpx] text-foreground truncate">
                {selectedTeachingTeacher?.name || profileName || '请选择'}
              </Text>
            </FormRow>

            <FormRow label="消课课时" required border>
              <Stepper value={hoursUsed} min={0.5} step={0.5} onChange={onHoursChange} />
            </FormRow>

            <FormRow label="上课日期" border onClick={onOpenDatePicker}>
              <View className="flex flex-row items-center gap-[8rpx]">
                <Text className="text-[30rpx] text-foreground">{lessonDate}</Text>
                <Icon name="mdi-calendar" size="sm" color="muted" />
              </View>
            </FormRow>

            <FormRow label="上课时间" border>
              <Picker
                mode="time"
                value={lessonTime}
                onChange={(e) => onLessonTimeChange(e.detail.value || lessonTime)}
              >
                <View className="flex flex-row items-center gap-[8rpx]">
                  <Text className="text-[30rpx] text-foreground">{lessonTime}</Text>
                  <Icon name="mdi-clock-outline" size="sm" color="muted" />
                </View>
              </Picker>
            </FormRow>

            <FormRow label="上课校区" border onClick={onOpenCampusSelector}>
              <Text className="text-[30rpx] text-foreground truncate">
                {campusOptions.find((item) => item.id === campusId)?.name || '请选择'}
              </Text>
            </FormRow>

            <FormRow label="上课教室" border={false} onClick={onOpenRoomSelector}>
              <Text
                className={cn(
                  'text-[30rpx] truncate',
                  room ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {room || '请选择'}
              </Text>
            </FormRow>
          </Card>

          <Card className="p-[32rpx]" marginBottom={false}>
            <View className="pb-[24rpx] border-b-[2rpx] border-border/30">
              <Text className="mb-[12rpx] block text-[30rpx] text-foreground">教学内容</Text>
              <Textarea
                className="w-full p-[16rpx] bg-background rounded-[16rpx] text-[28rpx] text-foreground min-h-[100rpx]"
                placeholder="选填"
                value={content}
                onInput={(e) => onContentChange(e.detail.value || '')}
              />
            </View>

            <View className="py-[24rpx] border-b-[2rpx] border-border/30">
              <Text className="mb-[12rpx] block text-[30rpx] text-foreground">学生表现</Text>
              <StarRating value={performance} onChange={onPerformanceChange} />
            </View>

            <View className="pt-[24rpx]">
              <Text className="mb-[12rpx] block text-[30rpx] text-foreground">课后作业</Text>
              <Textarea
                className="w-full p-[16rpx] bg-background rounded-[16rpx] text-[28rpx] text-foreground min-h-[100rpx]"
                placeholder="选填"
                value={homework}
                onInput={(e) => onHomeworkChange(e.detail.value || '')}
              />
              <View className="flex flex-wrap gap-3 mt-3">
                {homeworkImages.map((img, idx) => (
                  <View key={idx} className="relative w-[120rpx] h-[120rpx]">
                    <Image
                      src={img}
                      mode="aspectFill"
                      className="w-[120rpx] h-[120rpx] rounded-xl"
                      lazyLoad
                    />
                    <View
                      className="absolute -top-2 -right-2 w-[36rpx] h-[36rpx] rounded-full bg-destructive flex items-center justify-center"
                      onClick={() => onRemoveImage(idx)}
                    >
                      <Text className="text-white text-xs">×</Text>
                    </View>
                  </View>
                ))}
                {homeworkImages.length < 3 && (
                  <View
                    className={`w-[120rpx] h-[120rpx] rounded-xl border-2 border-dashed border-input flex items-center justify-center bg-background ${uploading ? 'state-loading' : 'press-scale'}`}
                    onClick={uploading ? undefined : onUploadImage}
                  >
                    <Text className="text-xl text-muted-foreground">
                      {uploading ? '...' : '+'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Card>
        </>
      ) : null}
    </View>
  );
};

export default SingleLessonPanel;
