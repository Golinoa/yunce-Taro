/**
 * 校区科目页 pages/campus-settings/subjects
 *
 * 科目卡片网格展示，支持添加/删除
 * 搞错了删了重新加，不需要编辑按钮
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useState, useCallback, useMemo } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { SUBJECT_ICONS } from '@/data/campus';
import { useCampusStore } from '@/stores/campus';

const Subjects: React.FC = () => {
  const { subjects, fetchSubjects, addSubject, deleteSubject } = useCampusStore();

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  // 表单
  const [form, setForm] = useState({
    name: '',
    iconIndex: 0,
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    await fetchSubjects();
    const nextError = useCampusStore.getState().error;
    if (nextError) {
      setLoadError(nextError);
    }
    setLoading(false);
  }, [fetchSubjects]);

  // 页面显示时加载数据
  Taro.useDidShow(() => {
    void reload();
  });

  // ============================================
  // 添加科目
  // ============================================
  const handleOpenAdd = useCallback(() => {
    setForm({ name: '', iconIndex: 0 });
    setShowAddSheet(true);
  }, []);

  const submitBlockedReason = useMemo(() => {
    if (!form.name.trim()) return '请输入科目名称';
    if (form.name.trim().length > 20) return '科目名称最多 20 个字';
    return '';
  }, [form.name]);

  const canSubmit = useMemo(() => !submitBlockedReason && !saving, [saving, submitBlockedReason]);

  const handleAddSubmit = useCallback(async () => {
    if (saving) return;
    if (submitBlockedReason) {
      Taro.showToast({ title: submitBlockedReason, icon: 'none' });
      return;
    }
    const iconItem = SUBJECT_ICONS[form.iconIndex] || SUBJECT_ICONS[0];
    setSaving(true);
    try {
      const result = await addSubject({
        name: form.name.trim(),
        icon: iconItem.icon,
        color: iconItem.color,
        iconGradient: iconItem.gradient,
      });
      if (!result) {
        Taro.showToast({ title: useCampusStore.getState().error || '添加科目失败', icon: 'none' });
        return;
      }
      setShowAddSheet(false);
      Taro.showToast({ title: '添加成功', icon: 'success' });
    } finally {
      setSaving(false);
    }
  }, [form, addSubject, saving, submitBlockedReason]);

  // ============================================
  // 删除科目
  // ============================================
  const handleDelete = useCallback(
    async (id: string) => {
      if (deletingId) return;
      const subject = subjects.find((s) => s.id === id);
      if (!subject) return;

      // 有关联课包时阻止删除
      if (subject.courseCount > 0) {
        Taro.showToast({
          title: `该科目下有 ${subject.courseCount} 个课包，无法删除`,
          icon: 'none',
          duration: 2500,
        });
        return;
      }

      const { confirm } = await Taro.showModal({
        title: '删除科目',
        content: `确定删除科目「${subject.name}」吗？删除后该科目数据将无法恢复`,
        confirmText: '删除',
        confirmColor: '#ef4444',
      });
      if (!confirm) return;
      setDeletingId(id);
      try {
        const success = await deleteSubject(id);
        if (!success) {
          Taro.showToast({ title: useCampusStore.getState().error || '删除科目失败', icon: 'none' });
          return;
        }
        Taro.showToast({ title: '删除成功', icon: 'success' });
      } finally {
        setDeletingId('');
      }
    },
    [subjects, deleteSubject, deletingId],
  );

  const updateForm = useCallback((field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  if (loading && !subjects.length) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载科目中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError && !subjects.length) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen px-[32rpx] flex items-center justify-center">
          <Empty
            icon="mdi-alert-circle"
            description={loadError}
            actionText="重新加载"
            onAction={() => void reload()}
          />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      {/* 添加按钮 */}
      <View className="px-[32rpx] pt-[24rpx] flex flex-row justify-end">
        <View
          className="flex flex-row items-center bg-primary/10 px-[28rpx] py-[14rpx] rounded-full gap-[6rpx]"
          onClick={handleOpenAdd}
        >
          <Icon name="mdi-plus" size={28} color="primary" />
          <Text className="text-[26rpx] text-primary font-semibold">添加科目</Text>
        </View>
      </View>

      {/* 科目列表卡片 — 对齐设计稿 subject-card */}
      {subjects.length > 0 ? (
        <View className="px-[32rpx] pt-[16rpx]">
          {deletingId ? (
            <View className="mb-[16rpx] px-[24rpx] py-[18rpx] rounded-[20rpx] bg-white shadow-soft">
              <Text className="text-[24rpx] text-muted-foreground">正在删除科目，请稍候...</Text>
            </View>
          ) : null}
          {subjects.map((subject) => (
            <View
              key={subject.id}
              className="bg-white rounded-[28rpx] shadow-soft px-[28rpx] py-[24rpx] mb-[16rpx] flex flex-row items-center gap-[20rpx]"
            >
              {/* 图标 */}
              <View
                className="w-[72rpx] h-[72rpx] rounded-[20rpx] flex items-center justify-center flex-shrink-0"
                style={{ background: subject.iconGradient }}
              >
                <Text className="text-[36rpx]">{subject.icon}</Text>
              </View>

              {/* 名称 + 统计信息分行 */}
              <View className="flex-1 min-w-0">
                <Text className="text-[28rpx] font-semibold text-foreground">{subject.name}</Text>
                <View className="flex flex-row gap-[16rpx] mt-[8rpx]">
                  <Text className="text-[22rpx] text-muted-foreground">
                    {subject.studentCount}学员
                  </Text>
                  <Text className="text-[22rpx] text-muted-foreground">
                    {subject.teacherCount}教师
                  </Text>
                  <Text className="text-[22rpx] text-muted-foreground">
                    {subject.courseCount}课包
                  </Text>
                </View>
              </View>

              {/* 删除按钮 */}
              <View
                className={cn(
                  'w-[56rpx] h-[56rpx] rounded-[12rpx] flex items-center justify-center flex-shrink-0',
                  deletingId === subject.id ? 'bg-muted' : 'bg-destructive/10',
                )}
                onClick={deletingId ? undefined : () => void handleDelete(subject.id)}
              >
                <Icon
                  name="mdi-delete-outline"
                  size={28}
                  color={deletingId === subject.id ? 'muted' : 'destructive'}
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className="px-[32rpx] pt-[180rpx]">
          <Empty
            icon="mdi-book-education-outline"
            description="暂无科目，点击右上角添加科目"
            actionText="添加科目"
            onAction={handleOpenAdd}
          />
        </View>
      )}

      {/* ============================================ */}
      {/* 添加科目弹窗 */}
      {/* ============================================ */}
      <BottomSheet
        visible={showAddSheet}
        title="添加科目"
        onClose={() => {
          if (saving) return;
          setShowAddSheet(false);
        }}
      >
        <View className="px-4 py-4">
          <FormInput
            label="科目名称"
            required
            placeholder="如：钢琴、舞蹈、美术"
            value={form.name}
            onInput={(e) => updateForm('name', e.detail.value)}
          />

          {/* 图标选择 */}
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground font-medium mb-2">科目图标</Text>
            <View className="flex flex-row flex-wrap gap-3">
              {SUBJECT_ICONS.map((item, idx) => (
                <View
                  key={idx}
                  className={cn(
                    'w-[72rpx] h-[72rpx] rounded-[20rpx] flex items-center justify-center border-[3rpx]',
                    form.iconIndex === idx ? 'border-primary' : 'border-transparent',
                  )}
                  style={{ background: item.gradient }}
                  onClick={() => updateForm('iconIndex', idx)}
                >
                  <Text className="text-[32rpx]">{item.icon}</Text>
                </View>
              ))}
            </View>
          </View>

          {!canSubmit && submitBlockedReason ? (
            <View className="mb-3">
              <Text className="text-sm text-muted-foreground">{submitBlockedReason}</Text>
            </View>
          ) : null}
          {/* 提交按钮 */}
          <View
            className={cn(
              'rounded-2xl py-4 flex items-center justify-center mt-4',
              canSubmit ? 'bg-primary' : 'bg-muted',
            )}
            onClick={canSubmit ? () => void handleAddSubmit() : undefined}
          >
            <Text className={cn('text-base font-semibold', canSubmit ? 'text-white' : 'text-muted-foreground')}>
              {saving ? '添加中...' : '确认添加'}
            </Text>
          </View>
        </View>
      </BottomSheet>
    </PageContainer>
  );
};

export default Subjects;
