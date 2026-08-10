import { ScrollView, Text, Textarea, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import StudentAvatar from '@/components/student/StudentAvatar';
import { followRecordService } from '@/services/follow-record';
import { studentService } from '@/services/student';
import type { FollowRecord } from '@/types/follow-record';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

const MAX_FOLLOW_LENGTH = 500;

/**
 * 跟进记录表单页
 *
 * 使用场景：
 * - 从学员详情页点击「写跟进」进入，新增一条跟进记录
 * - 长按学员详情页某条跟进记录进入，可编辑已有记录
 */
const FollowRecordFormPage: React.FC = () => {
  const { profile } = useAuth();
  const currentUserName = profile?.name || '';

  const { studentId, recordId } = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    const params = instance?.router?.params || {};
    return {
      studentId: decodeURIComponent(params.studentId || ''),
      recordId: decodeURIComponent(params.recordId || ''),
    };
  }, []);

  const isEdit = Boolean(recordId);

  const [student, setStudent] = useState<Student | null>(null);
  const [record, setRecord] = useState<FollowRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const stu = await studentService.getById(studentId);
      if (!stu) {
        setStudent(null);
        Taro.showToast({ title: '未找到学员信息', icon: 'none' });
        return;
      }
      setStudent(stu);

      if (isEdit) {
        const records = await followRecordService.getByStudent(studentId);
        const target = records.find((item) => item.id === recordId) || null;
        if (!target) {
          Taro.showToast({ title: '跟进记录不存在', icon: 'none' });
          return;
        }
        setRecord(target);
        setContent(target.content);
      }
    } catch (error) {
      logError('FollowRecordFormPage loadData', error);
      setLoadError('页面加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [studentId, recordId, isEdit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInput = useCallback((value: string) => {
    if (value.length <= MAX_FOLLOW_LENGTH) {
      setContent(value);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!student) return;
    const trimmed = content.trim();
    if (!trimmed) {
      Taro.showToast({ title: '请输入跟进内容', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && record) {
        const updated = await followRecordService.update(record.id, {
          content: trimmed,
          operatorName: currentUserName || record.operatorName,
        });
        // 通过事件通道返回更新后的记录，详情页可刷新列表
        const eventChannel = Taro.getCurrentInstance()?.page?.getOpenerEventChannel?.();
        if (eventChannel && typeof eventChannel.emit === 'function') {
          eventChannel.emit('followRecordUpdated', updated);
        }
        Taro.showToast({ title: '跟进记录已更新', icon: 'success' });
      } else {
        const created = await followRecordService.create({
          studentId: student.id,
          content: trimmed,
          operatorName: currentUserName || undefined,
        });
        const eventChannel = Taro.getCurrentInstance()?.page?.getOpenerEventChannel?.();
        if (eventChannel && typeof eventChannel.emit === 'function') {
          eventChannel.emit('followRecordCreated', created);
        }
        Taro.showToast({ title: '跟进记录已保存', icon: 'success' });
      }
      setTimeout(() => Taro.navigateBack(), 1200);
    } catch (error) {
      logError('FollowRecordFormPage submit', error);
      Taro.showToast({ title: isEdit ? '更新失败，请重试' : '保存失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [content, currentUserName, isEdit, record, student]);

  const handleCancel = useCallback(() => {
    Taro.navigateBack();
  }, []);

  const handleDelete = useCallback(async () => {
    if (!record) return;
    const { confirm } = await Taro.showModal({
      title: '确认删除',
      content: '删除后不可恢复，是否继续？',
      confirmColor: '#ef4444',
    });
    if (!confirm) return;
    try {
      await followRecordService.delete(record.id);
      const eventChannel = Taro.getCurrentInstance()?.page?.getOpenerEventChannel?.();
      if (eventChannel && typeof eventChannel.emit === 'function') {
        eventChannel.emit('followRecordDeleted', record.id);
      }
      Taro.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1200);
    } catch (error) {
      logError('FollowRecordFormPage delete', error);
      Taro.showToast({ title: '删除失败，请重试', icon: 'none' });
    }
  }, [record]);

  if (loading) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-background flex items-center justify-center">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-background px-[32rpx] flex items-center justify-center">
          <View className="center-col gap-[24rpx]">
            <Icon name="mdi-alert-circle" size={80} color="muted-foreground" />
            <Text className="text-[28rpx] text-muted-foreground">{loadError}</Text>
            <View
              className="px-[40rpx] py-[16rpx] rounded-[40rpx] bg-primary center press-scale"
              onClick={loadData}
            >
              <Text className="text-[28rpx] text-white font-medium">重新加载</Text>
            </View>
          </View>
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View className="min-h-screen bg-background flex flex-col">
        <ScrollView scrollY className="flex-1">
          <View className="px-[32rpx] pt-[32rpx] pb-[220rpx]">
            {/* 学员信息 */}
            {student && (
              <View className="bg-white rounded-[28rpx] p-[28rpx] shadow-soft flex items-center gap-[20rpx]">
                <StudentAvatar
                  name={student.name}
                  src={student.avatar_url}
                  size="md"
                  className="border-[4rpx] border-primary/20"
                />
                <View className="flex-1 min-w-0">
                  <Text className="text-[32rpx] font-bold text-foreground block">
                    {student.name}
                  </Text>
                  <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] block">
                    {isEdit ? '编辑跟进记录' : '添加跟进记录'}
                  </Text>
                </View>
              </View>
            )}

            {/* 输入区 */}
            <View className="bg-white rounded-[28rpx] p-[28rpx] shadow-soft mt-[24rpx]">
              <View className="flex items-center gap-[8rpx] mb-[20rpx]">
                <Icon name="mdi-text-box-outline" size={24} color="primary" />
                <Text className="text-[28rpx] font-bold text-foreground">跟进内容</Text>
              </View>
              <View className="bg-muted rounded-[20rpx] px-[24rpx] py-[24rpx]">
                <Textarea
                  className="w-full text-[28rpx] text-foreground min-h-[320rpx] leading-[1.6]"
                  placeholder="请输入跟进内容，如：电话沟通、到店咨询、意向跟踪等..."
                  placeholderClass="input-placeholder"
                  value={content}
                  onInput={(e) => handleInput(e.detail.value)}
                  maxlength={MAX_FOLLOW_LENGTH}
                  cursorSpacing={200}
                  autoHeight
                  disableDefaultPadding
                  focus
                />
                <View className="flex justify-end mt-[12rpx]">
                  <Text className="text-[24rpx] text-muted-foreground">
                    {content.length}/{MAX_FOLLOW_LENGTH}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* 底部按钮 */}
        <View className="fixed left-0 right-0 bottom-0 bg-white px-[32rpx] pt-[20rpx] pb-[calc(20rpx+env(safe-area-inset-bottom))] shadow-top">
          {isEdit ? (
            <View className="flex gap-[16rpx]">
              <View
                className="w-[140rpx] py-[24rpx] rounded-[40rpx] bg-destructive-10 center press-scale"
                onClick={handleDelete}
              >
                <Text className="text-[28rpx] font-medium text-destructive">删除</Text>
              </View>
              <View
                className="flex-1 py-[24rpx] rounded-[40rpx] border-[3rpx] border-border center press-scale"
                onClick={handleCancel}
              >
                <Text className="text-[28rpx] font-medium text-muted-foreground">取消</Text>
              </View>
              <View
                className={cn(
                  'flex-1 py-[24rpx] rounded-[40rpx] center press-scale',
                  content.trim() && !submitting ? 'bg-primary' : 'bg-border',
                )}
                onClick={content.trim() && !submitting ? handleSubmit : undefined}
              >
                <Text className="text-[28rpx] font-semibold text-white">
                  {submitting ? '保存中...' : '保存'}
                </Text>
              </View>
            </View>
          ) : (
            <View className="flex gap-[20rpx]">
              <View
                className="flex-1 py-[24rpx] rounded-[40rpx] border-[3rpx] border-border center press-scale"
                onClick={handleCancel}
              >
                <Text className="text-[28rpx] font-medium text-muted-foreground">取消</Text>
              </View>
              <View
                className={cn(
                  'flex-1 py-[24rpx] rounded-[40rpx] center press-scale',
                  content.trim() && !submitting ? 'bg-primary' : 'bg-border',
                )}
                onClick={content.trim() && !submitting ? handleSubmit : undefined}
              >
                <Text className="text-[28rpx] font-semibold text-white">
                  {submitting ? '提交中...' : '提交'}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(FollowRecordFormPage);
