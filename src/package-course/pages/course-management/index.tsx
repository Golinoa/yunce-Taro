/**
 * 课程管理列表页
 *
 * 按课程类型（班课 / 团课 / 私教）展示课程模板列表，
 * 支持新增课程，首次进入展示「第 4 步：建课程」引导弹窗。
 * 班课 tab 额外展示「排课中的班课」（活跃班级实例），保证排课与课程管理链路打通
 * （用户口径 2026-08-23：排课的课程必须出现在课程管理的班课里）。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import PageIntroSheet from '@/components/PageIntroSheet';
import { DEFAULT_COURSE_CATEGORIES } from '@/constants/course-template-ui';
import { classService } from '@/services';
import { PAGE_INTRO_STORAGE_KEYS } from '@/services/onboarding';
import { useCourseCategoryStore } from '@/stores/course-category';
import { useCourseTemplateStore } from '@/stores/course-template';
import { classColorHex } from '@/theme';
import type { Class } from '@/types/class';
import type { CourseTemplate } from '@/types/course-template';
import { useAuth } from '@/utils/auth';

const INTRO_STORAGE_KEY = PAGE_INTRO_STORAGE_KEYS.course;
const CATEGORY_TIP_KEY = 'course_management_category_tip_hidden';

/** 课程管理列表页 */
const CourseManagementPage: React.FC = () => {
  const { profile } = useAuth();
  const currentTeacherId = profile?.teacher_profile?.id || profile?.id || '';
  const {
    templates,
    loading,
    error,
    activeCategoryId: activeTemplateCategoryId,
    fetchByCategoryId,
    setActiveCategoryId: setActiveTemplateCategoryId,
    remove,
  } = useCourseTemplateStore();
  const { categories, activeCategoryId, fetchList, setActiveCategoryId } = useCourseCategoryStore();

  /** 排课中的活跃班级（班课 tab 展示，与排课链路打通） */
  const [activeClasses, setActiveClasses] = useState<Class[]>([]);
  /** 已排课的班级 id 集合（用于判断"未排课"标签） */
  const [scheduledClassIds, setScheduledClassIds] = useState<Set<string>>(new Set());

  // 删除确认弹窗
  const [deleteTarget, setDeleteTarget] = useState<CourseTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 引导弹窗
  const [showIntro, setShowIntro] = useState(false);

  // 分类标签编辑提示条
  const [showCategoryTip, setShowCategoryTip] = useState(false);

  // 当前激活的分类对象
  const activeCategoryItem = useMemo(
    () => categories.find((item) => item.id === activeCategoryId) ?? categories[0],
    [categories, activeCategoryId],
  );

  // 显示的分类标签：优先使用 store 中的动态分类，兜底用默认分类
  const tabs = useMemo(() => {
    if (categories.length > 0) {
      return categories.map((item) => ({ key: item.id, mode: item.mode, label: item.name }));
    }
    return DEFAULT_COURSE_CATEGORIES.map((item) => ({
      key: item.key,
      mode: item.key,
      label: item.label,
    }));
  }, [categories]);

  useDidShow(() => {
    const routeCategoryId = decodeURIComponent(
      Taro.getCurrentInstance()?.router?.params?.categoryId || '',
    );

    // 已排课班级 id 集合（用于未排课标签判断）
    void classService
      .getScheduledClassIds()
      .then((ids) => setScheduledClassIds(new Set(ids)))
      .catch(() => setScheduledClassIds(new Set()));
    // 排课中的活跃班级（班课 tab 展示，链路打通）
    if (currentTeacherId) {
      void classService
        .getByTeacher(currentTeacherId)
        .then((list) => setActiveClasses(list.filter((c) => c.status === 'active')))
        .catch(() => setActiveClasses([]));
    }
    void fetchList().then(() => {
      const { categories: latestCategories, activeCategoryId: currentId } =
        useCourseCategoryStore.getState();
      const preferredCategoryId =
        routeCategoryId && latestCategories.some((c) => c.id === routeCategoryId)
          ? routeCategoryId
          : currentId;
      const isValid = latestCategories.some((c) => c.id === preferredCategoryId);
      if (!isValid && latestCategories.length > 0) {
        const firstId = latestCategories[0].id;
        setActiveCategoryId(firstId);
        setActiveTemplateCategoryId(firstId);
        void fetchByCategoryId(firstId);
      } else if (isValid) {
        setActiveCategoryId(preferredCategoryId);
        setActiveTemplateCategoryId(preferredCategoryId);
        void fetchByCategoryId(preferredCategoryId);
      }
    });
    try {
      const hidden = Taro.getStorageSync(INTRO_STORAGE_KEY);
      setShowIntro(hidden !== true);
    } catch {
      setShowIntro(true);
    }

    try {
      const tipHidden = Taro.getStorageSync(CATEGORY_TIP_KEY);
      setShowCategoryTip(tipHidden !== true);
    } catch {
      setShowCategoryTip(true);
    }
  });

  const handleCategoryChange = useCallback(
    (id: string) => {
      setActiveCategoryId(id);
      setActiveTemplateCategoryId(id);
      void fetchByCategoryId(id);
    },
    [fetchByCategoryId, setActiveCategoryId, setActiveTemplateCategoryId],
  );

  const isClassTab = activeCategoryItem?.mode === 'class';

  const handleAdd = useCallback(() => {
    const categoryId = activeCategoryId || activeCategoryItem?.id || '';
    const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
    Taro.navigateTo({ url: `/package-course/pages/course-form/index${query}` });
  }, [activeCategoryId, activeCategoryItem?.id]);

  const handleCategoryLongPress = useCallback((id: string) => {
    Taro.navigateTo({ url: `/package-course/pages/category-form/index?id=${id}` });
  }, []);

  const handleDismissCategoryTip = useCallback(() => {
    setShowCategoryTip(false);
    try {
      Taro.setStorageSync(CATEGORY_TIP_KEY, true);
    } catch {
      // 忽略写入失败
    }
  }, []);

  const handleEdit = useCallback((id: string) => {
    Taro.navigateTo({ url: `/package-course/pages/course-form/index?id=${id}` });
  }, []);

  const handleCourseLongPress = useCallback(
    (template: CourseTemplate) => {
      void Taro.showActionSheet({
        itemList: ['编辑课程', '删除课程'],
        itemColor: '#1a1a1a',
      }).then((res) => {
        if (res.tapIndex === 0) {
          handleEdit(template.id);
        } else if (res.tapIndex === 1) {
          setDeleteTarget(template);
        }
      });
    },
    [handleEdit],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      Taro.showToast({ title: '已删除', icon: 'success' });
      setDeleteTarget(null);
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, remove]);

  // 班课 tab 以班级列表为准，不因模板为空而整页 loading
  const isClassTabLoading = activeCategoryItem?.mode === 'class';
  if (loading && templates.length === 0 && !(isClassTabLoading && activeClasses.length > 0)) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载课程数据中..." />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom className="overflow-hidden">
      {/* 用户口径（2026-08-23）：移除整页 ScrollView 与分类横向 ScrollView 的嵌套双滚动条，
          改为原生页面滚动（与班级管理等页面一致），仅保留分类横向滚动区 */}
      {/* Tab 分类栏 */}
      <View className="sticky top-0 z-10 bg-background py-[24rpx] px-[32rpx]">
        <View className="flex flex-row items-center">
          {/* 分类标签滚动区 */}
          <ScrollView
            scrollX
            enhanced
            showScrollbar={false}
            scrollWithAnimation
            className="flex-1 min-w-0 overflow-hidden whitespace-nowrap"
          >
            <View className="flex flex-row items-center inline-flex">
              {tabs.map((tab) => {
                const isActive = activeCategoryId === tab.key;
                return (
                  <View
                    key={tab.key}
                    className={cn(
                      'shrink-0 min-w-[120rpx] flex flex-col items-center justify-center mr-[32rpx] py-[8rpx] press-scale',
                    )}
                    onClick={() => handleCategoryChange(tab.key)}
                    onLongPress={() => handleCategoryLongPress(tab.key)}
                  >
                    <Text
                      className={cn(
                        'text-[30rpx] font-medium leading-none',
                        isActive ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {tab.label}
                    </Text>
                    {/* 下划线始终占位，未选中时透明 */}
                    <View
                      className={cn(
                        'mt-[12rpx] w-[40rpx] h-[6rpx] rounded-full',
                        isActive ? 'bg-primary' : 'bg-transparent',
                      )}
                    />
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* 新增分类按钮 - 固定右侧 */}
          <View
            className="shrink-0 ml-[16rpx] px-[24rpx] py-[12rpx] rounded-[12rpx] bg-primary press-scale"
            onClick={() => Taro.navigateTo({ url: '/package-course/pages/category-form/index' })}
          >
            <Text className="text-[26rpx] font-medium text-white">新增分类</Text>
          </View>
        </View>

        {/* 分类编辑轻提示 - 靠近标签、可关闭、不遮挡列表 */}
        {showCategoryTip && (
          <View className="mt-[20rpx] py-[16rpx] px-[20rpx] rounded-[12rpx] bg-primary/5 flex flex-row items-center justify-between">
            <View className="flex flex-row items-center gap-[12rpx] flex-1 min-w-0">
              <Icon name="mdi-information-outline" size={24} color="primary" />
              <Text className="text-[24rpx] text-primary leading-[34rpx]">
                小提示：长按分类标签可编辑
              </Text>
            </View>
            <View className="shrink-0 p-[8rpx] press-scale" onClick={handleDismissCategoryTip}>
              <Icon name="mdi-close" size={24} color="primary" />
            </View>
          </View>
        )}
      </View>

      {/* 课程列表（用户口径 2026-08-23：移除统计文案+班级卡片外层包装，直接合并到一个 flex 列表） */}
      <View className="px-[32rpx] pb-[calc(220rpx+env(safe-area-inset-bottom))]">
        {(() => {
          const isClassTab = activeCategoryItem?.mode === 'class';
          // 班课 tab 只展示班级实例；团课/私教仍展示课程模板（避免未排课模板点进「新增/编辑课程」）
          const showClasses = isClassTab && activeClasses.length > 0;
          const showTemplates = !isClassTab && templates.length > 0;
          if (!showClasses && !showTemplates) {
            if (error && templates.length === 0) {
              return (
                <Empty
                  description={error}
                  actionText="重新加载"
                  onAction={() => void fetchByCategoryId(activeTemplateCategoryId)}
                />
              );
            }
            return (
              <Empty description={`暂无${activeCategoryItem?.name ?? '课程'}课程，点击底部添加`} />
            );
          }
          return (
            <View className="flex flex-col gap-[20rpx]">
              {/* 排课中的班课（无外层包装，直接拼接在主列表） */}
              {showClasses &&
                activeClasses.map((cls) => {
                  const hasSchedule = scheduledClassIds.has(cls.id);
                  return (
                    <View
                      key={`cls-${cls.id}`}
                      className="bg-card rounded-[24rpx] px-[32rpx] py-[28rpx] flex flex-row items-center justify-between press-bg shadow-card"
                      onClick={() =>
                        Taro.navigateTo({
                          url: `/package-course/pages/course-form/index?id=${encodeURIComponent(cls.id)}&type=class`,
                        })
                      }
                    >
                      <View className="flex-1 min-w-0 flex flex-row items-center gap-[20rpx]">
                        <View
                          className="w-[16rpx] h-[88rpx] rounded-full shrink-0"
                          style={{
                            backgroundColor: classColorHex[cls.color] || 'hsl(var(--primary))',
                          }}
                        />
                        <View className="min-w-0 flex-1">
                          <View className="flex flex-row items-center gap-[12rpx]">
                            {/* 班级名称小字（用户口径 2026-08-23：简约为主，名称小字） */}
                            <Text className="text-[26rpx] font-medium text-foreground truncate">
                              {cls.name}
                            </Text>
                            {/* 仅未排课班级加"未排课"标签（主题色提醒，用户口径 2026-08-23） */}
                            {!hasSchedule && (
                              <View className="shrink-0 px-[10rpx] py-[2rpx] rounded-full bg-primary-bg">
                                <Text className="text-[20rpx] text-primary">未排课</Text>
                              </View>
                            )}
                          </View>
                          <Text className="mt-[6rpx] block text-[22rpx] text-muted-foreground">
                            {cls.student_count ?? 0} 名学员 · 已上 {cls.used_lessons ?? 0}/
                            {cls.total_lessons ?? 0} 课时
                          </Text>
                        </View>
                      </View>
                      <Icon name="mdi-chevron-right" size={32} color="mutedForeground" />
                    </View>
                  );
                })}
              {/* 班课模板（模板=未排课的课程母版，班课 tab 下显示"未排课"提醒标签） */}
              {showTemplates &&
                templates.map((template) => (
                  <View
                    key={`tpl-${template.id}`}
                    className="bg-card rounded-[24rpx] px-[32rpx] py-[28rpx] flex flex-row items-center justify-between press-bg shadow-card"
                    onClick={() => handleEdit(template.id)}
                    onLongPress={() => handleCourseLongPress(template)}
                  >
                    <View className="flex-1 min-w-0 flex flex-row items-center gap-[20rpx]">
                      <View
                        className="w-[16rpx] h-[60rpx] rounded-full shrink-0"
                        style={{ backgroundColor: template.color || 'hsl(var(--primary))' }}
                      />
                      <View className="min-w-0 flex-1">
                        <View className="flex flex-row items-center gap-[12rpx]">
                          <Text className="text-[30rpx] font-medium text-foreground truncate">
                            {template.name}
                          </Text>
                          {/* 模板无排课关联 → 视为未排课（主题色提醒） */}
                          <View className="shrink-0 px-[10rpx] py-[2rpx] rounded-full bg-primary-bg">
                            <Text className="text-[20rpx] text-primary">未排课</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    <View className="flex flex-row items-center shrink-0">
                      <Icon name="mdi-chevron-right" size={32} color="mutedForeground" />
                    </View>
                  </View>
                ))}
            </View>
          );
        })()}
      </View>

      {/* 底部新增按钮：班课 Tab 文案为「新增班级」 */}
      <View className="fixed left-[32rpx] right-[32rpx] bottom-[calc(32rpx+env(safe-area-inset-bottom))]">
        <View
          className="w-full py-[26rpx] rounded-full bg-card border-[2rpx] border-primary flex items-center justify-center gap-[12rpx] press-scale shadow-soft"
          onClick={handleAdd}
        >
          <Icon name="mdi-plus" size={28} color="primary" />
          <Text className="text-[30rpx] font-semibold text-primary">
            {isClassTab ? '新增班级' : '新增课程'}
          </Text>
        </View>
      </View>

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <View className="w-[560rpx] bg-card rounded-[32rpx] px-[40rpx] py-[48rpx]">
            <Text className="text-[36rpx] font-semibold text-foreground text-center">确认删除</Text>
            <Text className="mt-[24rpx] text-[28rpx] text-muted-foreground text-center leading-relaxed">
              删除后「{deleteTarget.name}」将不可恢复，是否确认删除？
            </Text>
            <View className="mt-[40rpx] flex flex-row gap-[24rpx]">
              <View
                className="flex-1 py-[22rpx] rounded-full bg-muted flex items-center justify-center press-scale"
                onClick={() => setDeleteTarget(null)}
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

      {/* 页面引导弹窗 */}
      <PageIntroSheet
        visible={showIntro}
        onClose={() => setShowIntro(false)}
        storageKey={INTRO_STORAGE_KEY}
        currentStep={4}
        totalSteps={6}
        title="第 4 步：建课程"
        description="创建课程模板（如「拳击体验课」「私教 1v1」），定好时长、人数、价格，排课时直接选用。"
        bulletPoints={[
          '至少有 1 个启用课程才算完成',
          '小技巧：课程列表上方的「分类标签」上长按可以编辑课程分类',
          '课程分类支持「线上课」模式：用腾讯会议直播授课（如线上瑜伽）。约课方式同团课，排课时填腾讯会议号，会员约课成功后才能看到会议号进入上课',
        ]}
      />
    </PageContainer>
  );
};

// 页面配置：白色导航栏 + 黑色标题
// eslint-disable-next-line import/no-named-as-default-member
definePageConfig({
  navigationBarTitleText: '课程管理',
  navigationBarBackgroundColor: '#FFFFFF',
  navigationBarTextStyle: 'black',
});

export default CourseManagementPage;
