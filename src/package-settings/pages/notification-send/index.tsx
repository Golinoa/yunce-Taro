import { View, Text, Input, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useEffect } from 'react';
import ActionButton from '@/components/ActionButton';
import Avatar from '@/components/Avatar';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { notificationService } from '@/services';
import { useStudentStore } from '@/stores';
import type { NotificationType } from '@/types/notification';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

/** 通知类型选项 */
const TYPE_OPTIONS: { key: NotificationType; label: string; emoji: string }[] = [
  { key: 'lesson_complete', label: '上课提醒', emoji: '📖' },
  { key: 'general', label: '作业通知', emoji: '📝' },
  { key: 'leave_response', label: '请假回复', emoji: '✉️' },
  { key: 'schedule_change', label: '排课变更', emoji: '📅' },
  { key: 'general', label: '系统通知', emoji: '🔔' },
];

// 去重（general 出现两次，用不同 label）
const UNIQUE_TYPES = TYPE_OPTIONS.reduce<{ key: NotificationType; label: string; emoji: string }[]>(
  (acc, cur) => {
    if (!acc.find((a) => a.label === cur.label)) acc.push(cur);
    return acc;
  },
  [],
);

const NotificationSendPage: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const fetchStudentsByTeacher = useStudentStore((state) => state.fetchByTeacher);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 学生列表
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 表单
  const [notifType, setNotifType] = useState<NotificationType>('lesson_complete');
  const [selectedTypeLabel, setSelectedTypeLabel] = useState('上课提醒');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // 加载学生列表
  const loadStudents = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const list = await fetchStudentsByTeacher(currentUserId);
      setStudents(list);
    } catch (err) {
      logError('load students', err);
      setErrorMsg('学生列表加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [currentUserId, fetchStudentsByTeacher]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // 切换学生选中
  const toggleStudent = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }, []);

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === students.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(students.map((s) => s.id));
    }
  }, [selectedIds, students]);

  const isAllSelected = selectedIds.length === students.length && students.length > 0;

  // 发送通知
  const handleSend = useCallback(async () => {
    if (selectedIds.length === 0) {
      Taro.showToast({ title: '请选择接收学生', icon: 'none' });
      return;
    }
    if (!title.trim()) {
      Taro.showToast({ title: '请输入通知标题', icon: 'none' });
      return;
    }

    setSending(true);
    try {
      // 获取选中学生及其家长信息
      const selected = students.filter((s) => selectedIds.includes(s.id));
      for (const stu of selected) {
        if (stu.parent_id) {
          await notificationService.send({
            sender_id: currentUserId,
            receiver_id: stu.parent_id,
            type: notifType,
            title: title.trim(),
            content: content.trim() || '无内容',
          });
        }
      }
      Taro.showToast({ title: '发送成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1500);
    } catch (err) {
      logError('send notification', err);
      Taro.showToast({ title: '发送失败，请重试', icon: 'none' });
    } finally {
      setSending(false);
    }
  }, [selectedIds, students, notifType, title, content, currentUserId]);

  if (loading) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-50">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  // 错误态：学生列表加载失败时展示重试入口
  if (errorMsg && students.length === 0) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-gradient-subtle flex flex-col items-center justify-center gap-[32rpx] px-8">
          <Empty icon="mdi-alert-circle" description={errorMsg} />
          <View
            className="bg-gradient-primary px-[48rpx] py-[16rpx] rounded-[16rpx] active:opacity-90"
            onClick={() => loadStudents()}
          >
            <Text className="text-[28rpx] text-white font-medium">重新加载</Text>
          </View>
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen bg-gradient-subtle pb-50">
        {/* 标题 */}
        <View className="px-8 pt-8 pb-4">
          <Text className="text-2xl font-bold text-foreground">发送通知</Text>
        </View>

        <View className="px-8">
          {/* ====== 通知类型 ====== */}
          <View className="mb-7">
            <Text className="text-lg text-foreground font-medium block mb-3">通知类型</Text>
            <View className="flex flex-wrap gap-3">
              {UNIQUE_TYPES.map((t) => (
                <View
                  key={t.label}
                  className={`py-4 px-6 rounded-2xl border border-input bg-white flex items-center gap-2 transition ${
                    selectedTypeLabel === t.label
                      ? 'border-primary bg-gradient-primary shadow-elegant'
                      : 'shadow-soft'
                  }`}
                  onClick={() => {
                    setNotifType(t.key);
                    setSelectedTypeLabel(t.label);
                  }}
                >
                  <Text className="text-xl">{t.emoji}</Text>
                  <Text
                    className={`text-base font-medium ${
                      selectedTypeLabel === t.label ? 'text-white' : 'text-muted-foreground'
                    }`}
                  >
                    {t.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ====== 标题 ====== */}
          <View className="mb-7">
            <View className="flex items-center gap-1 mb-2">
              <Text className="text-lg text-foreground">标题</Text>
              <Text className="text-lg text-destructive">*</Text>
            </View>
            <View className="border border-input rounded-3xl py-5 px-7 bg-white shadow-soft">
              <Input
                className="w-full text-lg text-foreground"
                placeholder="请输入通知标题"
                value={title}
                onInput={(e) => setTitle(e.detail.value || '')}
              />
            </View>
          </View>

          {/* ====== 内容 ====== */}
          <View className="mb-7">
            <Text className="text-lg text-foreground font-medium block mb-3">内容</Text>
            <View className="border border-input rounded-3xl py-5 px-7 bg-white shadow-soft">
              <Textarea
                className="w-full text-lg text-foreground leading-relaxed min-h-50"
                placeholder="请输入通知内容（可选）"
                value={content}
                onInput={(e) => setContent(e.detail.value || '')}
                maxlength={500}
              />
            </View>
          </View>

          {/* ====== 选择学生 ====== */}
          <View className="mb-7">
            <View className="flex items-center justify-between mb-3">
              <Text className="text-lg text-foreground font-medium">选择学生</Text>
              <View className="py-2 px-5 rounded-2xl bg-primary-10" onClick={handleSelectAll}>
                <Text className="text-sm text-primary font-medium">
                  {isAllSelected ? '取消全选' : '全选'}
                </Text>
              </View>
            </View>
            {students.length === 0 ? (
              <View className="py-8 text-center bg-muted rounded-3xl">
                <Text className="text-base text-muted-foreground">暂无学生</Text>
              </View>
            ) : (
              <View className="flex flex-col gap-2">
                {students.map((stu) => {
                  const isSelected = selectedIds.includes(stu.id);
                  return (
                    <View
                      key={stu.id}
                      className={`flex items-center gap-4 py-5 px-6 rounded-2xl border transition ${isSelected ? 'border-primary bg-primary-5' : 'border-input bg-white'}`}
                      onClick={() => toggleStudent(stu.id)}
                    >
                      {/* 复选框 */}
                      <View
                        className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 transition ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}
                      >
                        {isSelected && <Text className="text-white text-xl font-bold">✓</Text>}
                      </View>
                      {/* 头像 */}
                      <Avatar name={stu.name} avatarUrl={stu.avatar_url} size="lg" />
                      {/* 姓名 */}
                      <Text className="flex-1 text-lg text-foreground font-medium">{stu.name}</Text>
                      {/* 家长标识 */}
                      {stu.parent_id && (
                        <Text className="text-xs text-primary bg-primary-10 py-1 px-3 rounded-lg">
                          有家长
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
            {selectedIds.length > 0 && (
              <Text className="text-sm text-primary block mt-2 text-right">
                已选 {selectedIds.length} 人
              </Text>
            )}
          </View>
        </View>

        {/* 底部发送按钮 */}
        <View className="fixed bottom-0 left-0 right-0 py-6 px-8 bg-white/95 backdrop-blur-sm border-t border-input pb-safe-bar">
          <ActionButton
            text={
              sending
                ? '发送中...'
                : `发送通知${selectedIds.length > 0 ? `（${selectedIds.length}人）` : ''}`
            }
            onClick={handleSend}
            disabled={sending}
          />
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(NotificationSendPage);
