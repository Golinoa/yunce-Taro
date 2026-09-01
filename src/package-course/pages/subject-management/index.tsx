/**
 * 科目管理列表页
 *
 * 展示所有科目，支持新增、编辑、删除。
 * 设计参考课程管理列表页，卡片式布局 + 底部新增按钮。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { subjectService } from '@/services/campus';
import type { Subject } from '@/types/campus';

/** 科目管理列表页 */
const SubjectManagementPage: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const { loading, setLoading } = useDelayedLoading();
  const [error, setError] = useState('');

  // 删除确认弹窗
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await subjectService.getList();
      setSubjects(list);
    } catch {
      setError('加载科目数据失败，请重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    void reload();
  });

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleAdd = useCallback(() => {
    Taro.navigateTo({ url: '/package-course/pages/subject-form/index' });
  }, []);

  const handleEdit = useCallback((id: string) => {
    Taro.navigateTo({ url: `/package-course/pages/subject-form/index?id=${id}` });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    // 有关联课包时阻止删除
    if (deleteTarget.courseCount > 0) {
      Taro.showToast({
        title: `该科目下有 ${deleteTarget.courseCount} 个课包，无法删除`,
        icon: 'none',
        duration: 2500,
      });
      return;
    }
    setDeleting(true);
    try {
      const success = await subjectService.delete(deleteTarget.id);
      if (success) {
        Taro.showToast({ title: '已删除', icon: 'success' });
        setDeleteTarget(null);
        void reload();
      } else {
        Taro.showToast({ title: '删除失败', icon: 'none' });
      }
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, reload]);

  if (loading && subjects.length === 0) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载科目数据中..." />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      <ScrollView
        scrollY
        enhanced
        scrollWithAnimation
        className="h-screen"
        style={{ paddingBottom: 'calc(160rpx + env(safe-area-inset-bottom))' }}
      >
        {/* 统计文案 */}
        <View className="px-[32rpx] pt-[24rpx]">
          <Text className="text-[26rpx] text-muted-foreground">共 {subjects.length} 个科目</Text>
        </View>

        {/* 科目列表 */}
        <View className="px-[32rpx] pt-[16rpx]">
          {error && subjects.length === 0 ? (
            <Empty
              icon="mdi-alert-circle"
              description={error}
              actionText="重新加载"
              onAction={() => void reload()}
            />
          ) : subjects.length === 0 ? (
            <Empty icon="mdi-book-education-outline" description="暂无科目，点击底部添加" />
          ) : (
            <View className="flex flex-col gap-[20rpx]">
              {subjects.map((subject) => (
                <View
                  key={subject.id}
                  className="bg-card rounded-[24rpx] px-[32rpx] py-[28rpx] flex flex-row items-center gap-[20rpx] press-bg shadow-soft"
                  onClick={() => handleEdit(subject.id)}
                >
                  {/* 图标 */}
                  <View
                    className="w-[72rpx] h-[72rpx] rounded-[20rpx] flex items-center justify-center flex-shrink-0"
                    style={{ background: subject.iconGradient }}
                  >
                    <Text className="text-[36rpx]">{subject.icon}</Text>
                  </View>

                  {/* 名称 + 统计 */}
                  <View className="flex-1 min-w-0">
                    <Text className="text-[30rpx] font-medium text-foreground block truncate">
                      {subject.name}
                    </Text>
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

                  <Icon name="mdi-chevron-right" size={32} color="mutedForeground" />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 底部新增按钮 */}
      <View className="fixed left-[32rpx] right-[32rpx] bottom-[calc(32rpx+env(safe-area-inset-bottom))]">
        <View
          className="w-full py-[26rpx] rounded-full bg-card border-[2rpx] border-primary flex items-center justify-center gap-[12rpx] press-scale shadow-soft"
          onClick={handleAdd}
        >
          <Icon name="mdi-plus" size={28} color="primary" />
          <Text className="text-[30rpx] font-semibold text-primary">新增科目</Text>
        </View>
      </View>

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <View
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <View
            className="w-[560rpx] bg-card rounded-[32rpx] px-[40rpx] py-[48rpx]"
            onClick={(e) => e.stopPropagation()}
          >
            <Text className="text-[36rpx] font-semibold text-foreground text-center">确认删除</Text>
            <Text className="mt-[24rpx] text-[28rpx] text-muted-foreground text-center leading-relaxed">
              删除后「{deleteTarget.name}」将不可恢复，是否确认删除？
            </Text>
            <View className="mt-[40rpx] flex flex-row gap-[24rpx]">
              <View
                className="flex-1 py-[22rpx] rounded-full bg-muted flex items-center justify-center press-scale"
                onClick={() => !deleting && setDeleteTarget(null)}
              >
                <Text className="text-[28rpx] font-medium text-foreground">取消</Text>
              </View>
              <View
                className={cn(
                  'flex-1 py-[22rpx] rounded-full bg-destructive flex items-center justify-center press-scale',
                  deleting && 'opacity-50 pointer-events-none',
                )}
                onClick={() => void handleDeleteConfirm()}
              >
                <Text className="text-[28rpx] font-medium text-white">
                  {deleting ? '删除中...' : '删除'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </PageContainer>
  );
};

// eslint-disable-next-line import/no-named-as-default-member
definePageConfig({
  navigationBarTitleText: '科目管理',
  navigationBarBackgroundColor: '#FFFFFF',
  navigationBarTextStyle: 'black',
});

export default SubjectManagementPage;
