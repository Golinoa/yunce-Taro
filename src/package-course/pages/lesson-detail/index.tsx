import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import React, { useState, useCallback, useEffect } from 'react';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import PickerItem from '@/components/PickerItem';
import { classService, lessonRecordService, scheduleService } from '@/services';
import { useStudentStore } from '@/stores';
import type { Class } from '@/types/class';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { Student } from '@/types/student';
import { isStaffRole, useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

/** 教师 24h 内可撤销，校长 7 天内可撤销 */
const REVOKE_LIMIT_HOURS_TEACHER = 24;
const REVOKE_LIMIT_HOURS_PRINCIPAL = 24 * 7;
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;
const DETAIL_SECTION_TITLE_CLASS =
  'mb-[10rpx] block px-[6rpx] text-[22rpx] font-medium text-muted-foreground';
const DETAIL_CARD_CLASS = 'overflow-hidden rounded-[20rpx] border border-border bg-card';
const DETAIL_ROW_CLASS = 'flex items-start gap-[24rpx] px-[24rpx] py-[18rpx]';
const DETAIL_LABEL_CLASS =
  'w-[132rpx] flex-shrink-0 text-[24rpx] leading-[34rpx] text-muted-foreground';
const DETAIL_VALUE_CLASS = 'flex-1 text-right text-[26rpx] leading-[36rpx] text-foreground';

interface DetailFieldProps {
  label: string;
  value: React.ReactNode;
  multiline?: boolean;
  tone?: 'default' | 'danger' | 'muted' | 'success';
}

const DETAIL_TONE_CLASS_MAP: Record<NonNullable<DetailFieldProps['tone']>, string> = {
  default: 'text-foreground',
  danger: 'text-destructive',
  muted: 'text-muted-foreground',
  success: 'text-success',
};

const DetailField: React.FC<DetailFieldProps> = ({
  label,
  value,
  multiline = false,
  tone = 'default',
}) => (
  <View className={DETAIL_ROW_CLASS}>
    <Text className={DETAIL_LABEL_CLASS}>{label}</Text>
    <View className={`flex-1 ${multiline ? '' : 'min-w-0'}`}>
      <Text
        className={`${DETAIL_VALUE_CLASS} ${multiline ? 'text-left' : 'truncate'} ${DETAIL_TONE_CLASS_MAP[tone]}`}
      >
        {value}
      </Text>
    </View>
  </View>
);

/** 判断消课记录是否可撤销 */
function canRevoke(record: LessonRecord, role?: string): { allowed: boolean; reason?: string } {
  if (record.revoke_status === 'revoked') {
    return { allowed: false, reason: '该记录已撤销' };
  }
  if (!record.created_at) {
    return { allowed: false, reason: '无法确定创建时间' };
  }
  const created = new Date(record.created_at).getTime();
  const now = Date.now();
  const hoursDiff = (now - created) / (1000 * 60 * 60);

  if (role === 'principal') {
    if (hoursDiff > REVOKE_LIMIT_HOURS_PRINCIPAL) {
      return { allowed: false, reason: `已超过${REVOKE_LIMIT_HOURS_PRINCIPAL / 24}天撤销时限` };
    }
  } else {
    if (hoursDiff > REVOKE_LIMIT_HOURS_TEACHER) {
      return { allowed: false, reason: `已超过${REVOKE_LIMIT_HOURS_TEACHER}小时撤销时限` };
    }
  }
  return { allowed: true };
}

const LessonDetail: React.FC = () => {
  const { profile } = useAuth();
  const isTeacher = isStaffRole(profile?.currentContext?.role);
  const currentTeacherId = profile?.teacher_profile?.id || profile?.id || '';
  const invalidateStudents = useStudentStore((state) => state.invalidate);
  const routeParams = Taro.getCurrentInstance().router?.params || {};

  const recordId = routeParams.id ? decodeURIComponent(routeParams.id) : '';
  const detailMode = routeParams.mode ? decodeURIComponent(routeParams.mode) : '';
  const classIdParam = routeParams.classId ? decodeURIComponent(routeParams.classId) : '';
  const classNameParam = routeParams.className ? decodeURIComponent(routeParams.className) : '';
  const lessonDateParam = routeParams.lessonDate ? decodeURIComponent(routeParams.lessonDate) : '';
  const lessonTimeParam = routeParams.lessonTime ? decodeURIComponent(routeParams.lessonTime) : '';
  const leadTeacherNameParam = routeParams.leadTeacherName
    ? decodeURIComponent(routeParams.leadTeacherName)
    : '';
  const assistantTeacherNameParam = routeParams.assistantTeacherName
    ? decodeURIComponent(routeParams.assistantTeacherName)
    : '';
  const scheduleIdParam = routeParams.scheduleId ? decodeURIComponent(routeParams.scheduleId) : '';
  const startTimeParam = routeParams.startTime ? decodeURIComponent(routeParams.startTime) : '';
  const endTimeParam = routeParams.endTime ? decodeURIComponent(routeParams.endTime) : '';
  const statusParam = routeParams.status ? decodeURIComponent(routeParams.status) : '';
  const hasTrialStudentParam = routeParams.hasTrialStudent
    ? decodeURIComponent(routeParams.hasTrialStudent)
    : '';
  const isCancelledDetailMode =
    detailMode === 'cancelled' && Boolean(classIdParam && lessonDateParam);
  const isPreviewMode = detailMode === 'preview' && Boolean(scheduleIdParam && lessonDateParam);

  const [record, setRecord] = useState<LessonRecord | null>(null);
  const [relatedRecords, setRelatedRecords] = useState<LessonRecord[]>([]);
  const [previewSchedule, setPreviewSchedule] = useState<Schedule | null>(null);
  const [previewClass, setPreviewClass] = useState<Class | null>(null);
  const [previewStudents, setPreviewStudents] = useState<Student[]>([]);
  const { loading, setLoading } = useDelayedLoading();
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [showRevokeSheet, setShowRevokeSheet] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  const loadRecord = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setNotFound(false);

    if (!recordId && !isCancelledDetailMode && !isPreviewMode) {
      setRecord(null);
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      if (isPreviewMode) {
        const [schedule, records] = await Promise.all([
          scheduleService.getById(scheduleIdParam),
          currentTeacherId
            ? lessonRecordService.getByTeacherAndRange(
                currentTeacherId,
                lessonDateParam,
                lessonDateParam,
              )
            : lessonRecordService.getAll(),
        ]);
        const targetClassId = classIdParam || schedule?.class_id || '';
        const [classInfo, students] = await Promise.all(
          targetClassId
            ? [classService.getById(targetClassId), classService.getStudents(targetClassId)]
            : [Promise.resolve(null), Promise.resolve([])],
        );

        const lessonRecords = records.filter(
          (item) => item.class_id === targetClassId && item.lesson_date === lessonDateParam,
        );
        const checkedRecords = lessonRecords.filter((item) =>
          ['normal', 'makeup'].includes(item.status || 'normal'),
        );
        const cancelledRecords = lessonRecords.filter((item) => item.status === 'cancelled');

        setPreviewSchedule(schedule);
        setPreviewClass(classInfo);
        setPreviewStudents(students);

        // 若这节课已有消课或取消记录，优先展示详情；否则作为纯预览页
        if (checkedRecords.length > 0) {
          setRecord(checkedRecords[0]);
          setRelatedRecords(checkedRecords);
        } else if (cancelledRecords.length > 0) {
          setRecord(cancelledRecords[0]);
          setRelatedRecords(cancelledRecords);
        } else {
          setRecord(null);
          setRelatedRecords([]);
        }
        return;
      }

      if (isCancelledDetailMode) {
        const allRecords = currentTeacherId
          ? await lessonRecordService.getByTeacher(currentTeacherId)
          : await lessonRecordService.getAll();

        let cancelledRecords = allRecords.filter((item) => {
          if (item.class_id !== classIdParam) {
            return false;
          }
          if (item.lesson_date !== lessonDateParam) {
            return false;
          }
          if (item.status !== 'cancelled') {
            return false;
          }
          if (lessonTimeParam && item.content?.includes(lessonTimeParam) === false) {
            return false;
          }
          return true;
        });

        if (cancelledRecords.length === 0 && recordId) {
          const singleRecord = await lessonRecordService.getById(recordId);
          if (singleRecord?.status === 'cancelled') {
            cancelledRecords = [singleRecord];
          }
        }

        if (cancelledRecords.length === 0) {
          setRecord(null);
          setRelatedRecords([]);
          setNotFound(true);
          return;
        }

        const sortedRecords = [...cancelledRecords].sort((left, right) =>
          (left.student?.name || '').localeCompare(right.student?.name || ''),
        );
        setRecord(sortedRecords[0]);
        setRelatedRecords(sortedRecords);
        return;
      }

      const data = await lessonRecordService.getById(recordId);
      if (!data) {
        setRecord(null);
        setNotFound(true);
        return;
      }

      setRecord(data);
      setRelatedRecords([]);
    } catch (err) {
      logError('load record', err);
      setRecord(null);
      setRelatedRecords([]);
      setLoadError(
        isCancelledDetailMode || isPreviewMode
          ? '课程详情加载失败，请稍后重试'
          : '消课详情加载失败，请稍后重试',
      );
    } finally {
      setLoading(false);
    }
  }, [
    classIdParam,
    currentTeacherId,
    isCancelledDetailMode,
    isPreviewMode,
    lessonDateParam,
    lessonTimeParam,
    recordId,
    scheduleIdParam,
  ]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  const navigationTitle = isCancelledDetailMode
    ? classNameParam || record?.class_name || '未命名班级'
    : isPreviewMode
      ? '课程预览'
      : '消课详情';

  useEffect(() => {
    Taro.setNavigationBarTitle({
      title: navigationTitle,
    }).catch(() => {});
  }, [navigationTitle]);

  // 撤销消课
  const handleRevoke = useCallback(async () => {
    if (!revokeReason.trim()) {
      Taro.showToast({ title: '请填写撤销原因', icon: 'none' });
      return;
    }
    setRevoking(true);
    try {
      await lessonRecordService.revoke(recordId, profile?.id || '', revokeReason.trim());
      if (profile?.id) invalidateStudents(profile.id);
      Taro.showToast({ title: '已撤销', icon: 'success' });
      setShowRevokeSheet(false);
      setRevokeReason('');
      // 刷新记录
      await loadRecord();
    } catch (err) {
      logError('revoke lesson record', err);
      Taro.showToast({ title: '撤销失败', icon: 'none' });
    } finally {
      setRevoking(false);
    }
  }, [recordId, profile, revokeReason, invalidateStudents, loadRecord]);

  if (loading) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-50">
          <Loading text="加载消课详情中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-gradient-subtle px-8 flex items-center justify-center">
          <Empty
            icon="mdi-alert-circle"
            description={loadError}
            actionText="重新加载"
            onAction={loadRecord}
          />
        </View>
      </PageContainer>
    );
  }

  // 课程预览模式：尚未生成消课记录时展示课程信息和学员列表
  if (isPreviewMode && !record) {
    const previewClassName =
      classNameParam || previewClass?.name || previewSchedule?.class_info?.name || '未命名班级';
    const previewDateText = dayjs(lessonDateParam).isValid()
      ? `${lessonDateParam}(${WEEKDAY_LABELS[dayjs(lessonDateParam).day()]})`
      : lessonDateParam;
    const previewTimeText =
      startTimeParam && endTimeParam
        ? `${startTimeParam}-${endTimeParam}`
        : previewSchedule
          ? `${previewSchedule.start_time}-${previewSchedule.end_time}`
          : '-';
    const previewTeacher = leadTeacherNameParam || previewSchedule?.teacher_name || '未分配';
    const previewAssistant =
      assistantTeacherNameParam || previewSchedule?.assistant_teacher_name || '无';
    const previewStatus = statusParam || 'upcoming';
    const statusLabelMap: Record<string, string> = {
      urgent: '即将上课',
      upcoming: '待上课',
      active: '上课中',
      done: '已完成',
      ended: '已下课',
      cancelled: '已取消',
    };
    const statusColorMap: Record<string, string> = {
      urgent: 'text-warning bg-warning/10',
      upcoming: 'text-primary bg-primary/10',
      active: 'text-success bg-success/10',
      done: 'text-success bg-success/10',
      ended: 'text-muted-foreground bg-muted',
      cancelled: 'text-destructive bg-destructive/10',
    };

    const handleGoCheckin = () => {
      const url =
        `/package-course/pages/lesson-form/index?scheduleId=${encodeURIComponent(scheduleIdParam)}` +
        `&classId=${encodeURIComponent(classIdParam || previewSchedule?.class_id || '')}` +
        `&lessonDate=${encodeURIComponent(lessonDateParam)}` +
        `&hasTrialStudent=${hasTrialStudentParam === '1' ? '1' : '0'}`;
      void Taro.navigateTo({ url });
    };

    const handleGoSupplement = () => {
      const url =
        `/package-course/pages/lesson-supplement/index?classId=${encodeURIComponent(classIdParam || previewSchedule?.class_id || '')}` +
        `&scheduleId=${encodeURIComponent(scheduleIdParam)}` +
        `&className=${encodeURIComponent(previewClassName)}` +
        `&lessonDate=${encodeURIComponent(lessonDateParam)}` +
        `&lessonTime=${encodeURIComponent(previewTimeText)}` +
        `&leadTeacherName=${encodeURIComponent(previewTeacher)}` +
        `&assistantTeacherName=${encodeURIComponent(previewAssistant)}`;
      void Taro.navigateTo({ url });
    };

    const handleGoEditSchedule = () => {
      const url = `/package-course/pages/schedule-form/index?id=${encodeURIComponent(scheduleIdParam)}`;
      void Taro.navigateTo({ url });
    };

    return (
      <PageContainer>
        <View className="min-h-screen bg-background px-[24rpx] pt-[24rpx] pb-[220rpx]">
          <View className="rounded-[20rpx] border border-mint-border bg-mint px-[24rpx] py-[22rpx]">
            <View className="flex items-start justify-between gap-[16rpx]">
              <View className="min-w-0 flex-1">
                <Text className="block truncate text-[34rpx] font-semibold text-foreground">
                  {previewClassName}
                </Text>
              </View>
              <View
                className={`rounded-full px-[18rpx] py-[10rpx] ${statusColorMap[previewStatus] || statusColorMap.upcoming}`}
              >
                <Text className="text-[24rpx] font-medium">
                  {statusLabelMap[previewStatus] || '待上课'}
                </Text>
              </View>
            </View>
            <View className="mt-[16rpx] flex flex-col gap-[8rpx]">
              <View className="flex items-center gap-[8rpx]">
                <Text className="flex-shrink-0 text-[24rpx] text-muted-foreground">时间</Text>
                <Text className="text-[24rpx] text-foreground">
                  {previewDateText} {previewTimeText}
                </Text>
              </View>
              <View className="flex items-center gap-[8rpx]">
                <Text className="flex-shrink-0 text-[24rpx] text-muted-foreground">老师</Text>
                <Text className="text-[24rpx] text-foreground">
                  {previewTeacher}
                  {previewAssistant && previewAssistant !== '无'
                    ? ` / 助教 ${previewAssistant}`
                    : ''}
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-[20rpx]">
            <Text className={DETAIL_SECTION_TITLE_CLASS}>
              学员列表
              <Text className="ml-[8rpx] text-[20rpx]">({previewStudents.length}人)</Text>
            </Text>
            <View className={DETAIL_CARD_CLASS}>
              {previewStudents.length > 0 ? (
                previewStudents.map((student) => (
                  <PickerItem
                    key={student.id}
                    iconType="avatar"
                    avatarUrl={student.avatar_url}
                    avatarChar={student.name || '学'}
                    title={student.name || '未命名学员'}
                  />
                ))
              ) : (
                <View className="py-[40rpx] text-center">
                  <Text className="text-[24rpx] text-foreground-secondary">暂无学员</Text>
                </View>
              )}
            </View>
          </View>

          <View className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white px-[24rpx] py-[24rpx] pb-[40rpx] safe-area-bottom">
            <View className="flex gap-[16rpx]">
              <View
                className="flex h-[84rpx] flex-1 items-center justify-center rounded-[14rpx] border border-border bg-muted press-scale"
                onClick={handleGoEditSchedule}
              >
                <Text className="text-[28rpx] font-medium text-foreground">编辑排课</Text>
              </View>
              {(previewStatus === 'upcoming' ||
                previewStatus === 'urgent' ||
                previewStatus === 'active') && (
                <View
                  className="flex h-[84rpx] flex-1 items-center justify-center rounded-[14rpx] bg-primary press-scale"
                  onClick={handleGoCheckin}
                >
                  <Text className="text-[28rpx] font-semibold text-white">去点名</Text>
                </View>
              )}
              {previewStatus === 'ended' && (
                <View
                  className="flex h-[84rpx] flex-1 items-center justify-center rounded-[14rpx] bg-warning press-scale"
                  onClick={handleGoSupplement}
                >
                  <Text className="text-[28rpx] font-semibold text-white">补录</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </PageContainer>
    );
  }

  if (notFound || !record) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-gradient-subtle px-8 flex items-center justify-center">
          <Empty
            icon="mdi-clipboard-text"
            description={
              isCancelledDetailMode
                ? '取消详情不存在或已被删除'
                : isPreviewMode
                  ? '课程信息不存在或已被删除'
                  : '记录不存在或已被删除'
            }
            actionText="返回上一页"
            onAction={() => Taro.navigateBack()}
          />
        </View>
      </PageContainer>
    );
  }

  const studentName = record.student?.name || '学生';
  const packageName = record.course_package?.name || '课程';
  const cancelledStudentCount = relatedRecords.length;
  const cancelledOperatorTeacherName =
    record.operator_teacher?.name || record.teacher?.name || profile?.name || '未记录';
  const cancelledCreatedAt = record.created_at || '-';
  const cancelledCreatedAtText = dayjs(cancelledCreatedAt).isValid()
    ? dayjs(cancelledCreatedAt).format('YYYY-MM-DD HH:mm')
    : cancelledCreatedAt;
  const cancelRemarkText = `本次课已取消，不扣课时，取消原因：${cancelledOperatorTeacherName}手动取消开课，取消时间：${cancelledCreatedAtText}`;
  const cancelledLeadTeacherName = leadTeacherNameParam || record.teacher?.name || '未记录';
  const cancelledAssistantTeacherName =
    assistantTeacherNameParam || record.assistant_teacher?.name || '无';
  const cancelledDateWithWeekText = dayjs(lessonDateParam).isValid()
    ? `${lessonDateParam}(${WEEKDAY_LABELS[dayjs(lessonDateParam).day()]})`
    : lessonDateParam;
  const cancelledTeacherSummary =
    cancelledAssistantTeacherName && cancelledAssistantTeacherName !== '无'
      ? `${cancelledLeadTeacherName} / 助教 ${cancelledAssistantTeacherName}`
      : cancelledLeadTeacherName;

  const lessonDateText = dayjs(record.lesson_date).isValid()
    ? `${dayjs(record.lesson_date).format('YYYY-MM-DD')}(${WEEKDAY_LABELS[dayjs(record.lesson_date).day()]})`
    : record.lesson_date || '-';
  const checkinTimeText =
    record.created_at && dayjs(record.created_at).isValid()
      ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm')
      : record.created_at || '-';
  const leadTeacherName = record.teacher?.name || '未记录';
  const assistantTeacherName = record.assistant_teacher?.name || '无';
  const operatorTeacherName = record.operator_teacher?.name || leadTeacherName;
  const classNameText = record.class_name || '未关联班级';
  const statusText = record.revoke_status === 'revoked' ? '已撤销' : '正常';
  const statusTone: DetailFieldProps['tone'] =
    record.revoke_status === 'revoked' ? 'danger' : 'success';
  const courseContentText = record.content || '暂无';
  const teacherReviewText = record.performance || '暂无';
  const homeworkText = record.homework || '暂无';
  const crossSubjectText = `班级科目 ${record.class_subject || '通用'} / 课包科目 ${record.package_subject || '通用'}`;

  if (record?.status === 'cancelled') {
    return (
      <PageContainer>
        <View className="min-h-screen bg-background px-[24rpx] pt-[24rpx] pb-[40rpx]">
          <View className="relative overflow-hidden rounded-[18rpx] border border-border bg-card px-[24rpx] pb-[24rpx] pt-[20rpx]">
            <View className="absolute right-0 top-0 overflow-hidden rounded-tr-[18rpx]">
              <View className="rounded-bl-[18rpx] bg-destructive px-[22rpx] py-[12rpx]">
                <Text className="text-[22rpx] font-semibold tracking-[2rpx] text-white">取消</Text>
              </View>
            </View>

            <Text className="block pr-[96rpx] text-[34rpx] font-semibold text-foreground">
              {lessonTimeParam || `${startTimeParam}-${endTimeParam}`}
            </Text>
            <Text className="mt-[10rpx] block text-[26rpx] text-muted-foreground">
              {cancelledDateWithWeekText}
            </Text>
            <Text className="mt-[10rpx] block text-[26rpx] text-muted-foreground">
              老师:{cancelledTeacherSummary}
            </Text>

            <View className="mt-[24rpx]">
              <Text className="text-[26rpx] font-medium text-foreground">备注:</Text>
              <Text className="mt-[10rpx] text-[26rpx] leading-[40rpx] text-destructive">
                {cancelRemarkText}
              </Text>
            </View>
          </View>

          <View className="mt-[28rpx] rounded-[20rpx] bg-card px-[24rpx] py-[24rpx] shadow-card">
            <View className="mb-[16rpx] flex items-center justify-between">
              <Text className="text-[30rpx] font-semibold text-foreground">取消学员</Text>
              <Text className="text-[24rpx] text-foreground-secondary">
                共 {cancelledStudentCount} 人
              </Text>
            </View>

            <View className="flex flex-col gap-[8rpx]">
              {relatedRecords.map((item) => (
                <PickerItem
                  key={item.id}
                  iconType="avatar"
                  avatarUrl={item.student?.avatar_url}
                  avatarChar={item.student?.name || '学'}
                  title={item.student?.name || '未命名学员'}
                />
              ))}
              {relatedRecords.length === 0 ? (
                <View className="py-[40rpx] text-center">
                  <Text className="text-[24rpx] text-foreground-secondary">暂无学员记录</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View className="min-h-screen bg-background px-[24rpx] pt-[24rpx] pb-[220rpx]">
        <View className="rounded-[20rpx] border border-mint-border bg-mint px-[24rpx] py-[22rpx]">
          <View className="flex items-start justify-between gap-[16rpx]">
            <View className="min-w-0 flex-1">
              <Text className="block truncate text-[34rpx] font-semibold text-foreground">
                {classNameText}
              </Text>
            </View>
            <View className="rounded-full bg-mint-foreground/10 px-[18rpx] py-[10rpx]">
              <Text className="text-[24rpx] font-medium text-mint-foreground">
                {record.hours_used} 课时
              </Text>
            </View>
          </View>
          <View className="mt-[16rpx] flex flex-col gap-[8rpx]">
            <View className="flex items-center gap-[8rpx]">
              <Text className="flex-shrink-0 text-[24rpx] text-muted-foreground">学员</Text>
              <Text className="text-[24rpx] text-foreground">{studentName}</Text>
            </View>
            <View className="flex items-center gap-[8rpx]">
              <Text className="flex-shrink-0 text-[24rpx] text-muted-foreground">课包</Text>
              <Text className="text-[24rpx] text-foreground">{packageName}</Text>
            </View>
          </View>
        </View>

        <View className="mt-[20rpx]">
          <Text className={DETAIL_SECTION_TITLE_CLASS}>基础信息</Text>
          <View className={DETAIL_CARD_CLASS}>
            <DetailField label="课时套餐" value={packageName} />
            <DetailField label="记录状态" value={statusText} tone={statusTone} />
            {record.is_cross_subject ? (
              <DetailField label="跨科目消课" value={crossSubjectText} tone="danger" />
            ) : null}
          </View>
        </View>

        <View className="mt-[20rpx]">
          <Text className={DETAIL_SECTION_TITLE_CLASS}>老师与时间</Text>
          <View className={DETAIL_CARD_CLASS}>
            <DetailField label="授课老师" value={leadTeacherName} />
            <DetailField
              label="助教老师"
              value={assistantTeacherName}
              tone={assistantTeacherName === '无' ? 'muted' : 'default'}
            />
            <DetailField label="操作老师" value={operatorTeacherName} />
            <DetailField label="上课时间" value={lessonDateText} />
            <DetailField label="签到时间" value={checkinTimeText} />
          </View>
        </View>

        <View className="mt-[20rpx]">
          <Text className={DETAIL_SECTION_TITLE_CLASS}>课程记录</Text>
          <View className={DETAIL_CARD_CLASS}>
            <DetailField
              label="教学内容"
              value={courseContentText}
              multiline
              tone={record.content ? 'default' : 'muted'}
            />
            <DetailField
              label="老师评价"
              value={teacherReviewText}
              multiline
              tone={record.performance ? 'default' : 'muted'}
            />
            <DetailField
              label="课后作业"
              value={homeworkText}
              multiline
              tone={record.homework ? 'default' : 'muted'}
            />
          </View>
        </View>

        {/* 撤销按钮 */}
        {isTeacher &&
          record.revoke_status !== 'revoked' &&
          (() => {
            const revokeCheck = canRevoke(record, profile?.currentContext?.role);
            return (
              <View className="mt-[16rpx]">
                <View
                  className={`rounded-[18rpx] py-[22rpx] flex items-center justify-center press-scale ${
                    revokeCheck.allowed
                      ? 'bg-warning/10 border border-warning'
                      : 'bg-muted border border-border'
                  }`}
                  onClick={() => {
                    if (revokeCheck.allowed) {
                      setShowRevokeSheet(true);
                    } else {
                      Taro.showToast({ title: revokeCheck.reason || '不可撤销', icon: 'none' });
                    }
                  }}
                >
                  <Text
                    className={`text-[30rpx] font-semibold ${
                      revokeCheck.allowed ? 'text-warning' : 'text-muted-foreground'
                    }`}
                  >
                    {revokeCheck.allowed ? '撤销消课' : '已超过撤销时限'}
                  </Text>
                </View>
              </View>
            );
          })()}

        {/* 撤销确认弹窗 */}
        <BottomSheet
          visible={showRevokeSheet}
          title="撤销消课"
          onClose={() => setShowRevokeSheet(false)}
        >
          <View className="px-[32rpx] py-[32rpx]">
            <Text className="text-[28rpx] text-muted-foreground leading-relaxed">
              撤销后将恢复课包余额（购买{record.purchased_deduct || 0}课时 + 赠送
              {record.bonus_deduct || 0}课时），该操作不可逆。
            </Text>
            <View className="mt-[32rpx]">
              <Text className="text-[26rpx] text-muted-foreground mb-[16rpx] block">
                撤销原因 *
              </Text>
              <View className="bg-muted rounded-[24rpx] px-[24rpx] py-[24rpx]">
                <Input
                  className="text-[28rpx] text-foreground"
                  placeholder="请填写撤销原因"
                  value={revokeReason}
                  onInput={(e) => setRevokeReason(e.detail.value)}
                  maxlength={200}
                />
              </View>
            </View>
            <View className="flex gap-[24rpx] mt-[48rpx]">
              <View
                className="flex-1 py-[22rpx] rounded-[24rpx] bg-muted items-center press-scale"
                onClick={() => setShowRevokeSheet(false)}
              >
                <Text className="text-[30rpx] text-foreground">取消</Text>
              </View>
              <View
                className={`flex-1 py-[22rpx] rounded-[24rpx] items-center press-scale ${
                  revokeReason.trim() && !revoking ? 'bg-warning' : 'bg-muted'
                }`}
                onClick={revokeReason.trim() && !revoking ? handleRevoke : undefined}
              >
                <Text
                  className={`text-[30rpx] font-semibold ${
                    revokeReason.trim() && !revoking ? 'text-white' : 'text-muted-foreground'
                  }`}
                >
                  {revoking ? '撤销中...' : '确认撤销'}
                </Text>
              </View>
            </View>
          </View>
        </BottomSheet>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(LessonDetail);
