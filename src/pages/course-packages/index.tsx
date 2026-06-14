import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import FormInput from '@/components/FormInput';
import PageContainer from '@/components/PageContainer';
import { packageTemplateService } from '@/services';
import { usePackageTemplateStore } from '@/stores';
import type { CoursePackageTemplate, PackageType } from '@/types/course-package';
import { useAuth } from '@/utils/auth';
import { withRouteGuard } from '@/utils/route-guard';

const PACKAGE_TYPES: { key: PackageType; label: string; desc: string }[] = [
  { key: 'hour_package', label: '课时包', desc: '买N课时慢慢用' },
  { key: 'term', label: '期课', desc: '按学期/假期' },
  { key: 'monthly', label: '月卡', desc: '按月计费' },
  { key: 'trial', label: '体验课', desc: '新生体验' },
];

/** 根据课包类型获取有效期描述 */
const getValidInfo = (pkg: CoursePackageTemplate): string => {
  if (pkg.valid_days && pkg.valid_days > 0) {
    return `${pkg.valid_days}天有效`;
  }
  if (pkg.type === 'hour_package') return '永久有效';
  return '';
};

const CoursePackagesPage: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const packageTemplateStore = usePackageTemplateStore();

  const [templates, setTemplates] = useState<CoursePackageTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // 弹窗状态（创建/编辑共用）
  const [showModal, setShowModal] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null=创建模式
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<PackageType>('hour_package');
  const [formPrice, setFormPrice] = useState('');
  const [formLessonCount, setFormLessonCount] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formValidDays, setFormValidDays] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const isEdit = editingId !== null;
  const modalTitle = isEdit ? '编辑课程包' : '新建课程包';
  const submitText = isEdit ? '保存修改' : '确认创建';

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const list = await packageTemplateStore.fetchByTeacher(currentUserId);
      setTemplates(list);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // 切换类型时自动填充默认值
  const handleTypeChange = useCallback(
    (type: PackageType) => {
      setFormType(type);
      if (type === 'trial') {
        if (!formLessonCount) setFormLessonCount('1');
        if (!formValidDays) setFormValidDays('7');
      } else if (type === 'monthly') {
        if (!formValidDays) setFormValidDays('30');
      }
    },
    [formLessonCount, formValidDays],
  );

  const openCreate = useCallback(() => {
    setEditingId(null);
    setFormName('');
    setFormType('hour_package');
    setFormPrice('');
    setFormLessonCount('');
    setFormDuration('');
    setFormValidDays('');
    setFormDesc('');
    setShowModal(true);
    setTimeout(() => setModalVisible(true), 50);
  }, []);

  const openEdit = useCallback((pkg: CoursePackageTemplate) => {
    setEditingId(pkg.id);
    setFormName(pkg.name);
    setFormType(pkg.type);
    setFormPrice(String(pkg.price));
    setFormLessonCount(String(pkg.lesson_count));
    setFormDuration(String(pkg.duration));
    setFormValidDays(pkg.valid_days ? String(pkg.valid_days) : '');
    setFormDesc(pkg.description || '');
    setShowModal(true);
    setTimeout(() => setModalVisible(true), 50);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setTimeout(() => setShowModal(false), 300);
  }, []);

  // 课时数标签
  const lessonCountLabel = useMemo(() => {
    if (formType === 'monthly') return '课时数（选填，0=不限）';
    return '课时数';
  }, [formType]);

  // 课时数placeholder
  const lessonCountPlaceholder = useMemo(() => {
    if (formType === 'monthly') return '0=不限课时';
    if (formType === 'trial') return '1';
    return '如：16';
  }, [formType]);

  const handleSubmit = useCallback(async () => {
    if (!formName.trim()) {
      Taro.showToast({ title: '请输入课程包名称', icon: 'none' });
      return;
    }
    if (!formPrice || isNaN(Number(formPrice))) {
      Taro.showToast({ title: '请输入有效价格', icon: 'none' });
      return;
    }

    // 课时数校验：课时包和期课必填
    if (
      (formType === 'hour_package' || formType === 'term') &&
      (!formLessonCount || isNaN(Number(formLessonCount)) || Number(formLessonCount) <= 0)
    ) {
      Taro.showToast({ title: '请输入课时数', icon: 'none' });
      return;
    }
    if (!formDuration || isNaN(Number(formDuration))) {
      Taro.showToast({ title: '请输入课时时长', icon: 'none' });
      return;
    }

    // 期课和月卡必须填有效天数
    if (
      (formType === 'term' || formType === 'monthly') &&
      (!formValidDays || Number(formValidDays) <= 0)
    ) {
      Taro.showToast({ title: '请输入有效天数', icon: 'none' });
      return;
    }

    setSaving(true);
    try {
      const lessonCount =
        formType === 'monthly'
          ? formLessonCount
            ? Number(formLessonCount)
            : 0
          : Number(formLessonCount);

      const payload = {
        name: formName.trim(),
        type: formType,
        price: Number(formPrice),
        lesson_count: lessonCount,
        duration: Number(formDuration),
        valid_days: formValidDays ? Number(formValidDays) : undefined,
        description: formDesc.trim() || undefined,
      };

      if (isEdit && editingId) {
        await packageTemplateService.update(editingId, payload);
        packageTemplateStore.invalidate(currentUserId);
        Taro.showToast({ title: '修改成功', icon: 'success' });
      } else {
        await packageTemplateService.create({
          teacher_id: currentUserId,
          ...payload,
        });
        packageTemplateStore.invalidate(currentUserId);
        Taro.showToast({ title: '创建成功', icon: 'success' });
      }
      closeModal();
      loadTemplates();
    } catch {
      Taro.showToast({ title: isEdit ? '修改失败' : '创建失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [
    isEdit,
    editingId,
    formName,
    formType,
    formPrice,
    formLessonCount,
    formDuration,
    formValidDays,
    formDesc,
    currentUserId,
    closeModal,
    loadTemplates,
  ]);

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      const { confirm } = await Taro.showModal({
        title: '删除课程包',
        content: `确认删除「${name}」？`,
        confirmColor: '#ef4444',
      });
      if (!confirm) return;
      try {
        await packageTemplateService.remove(id);
        packageTemplateStore.invalidate(currentUserId);
        Taro.showToast({ title: '删除成功', icon: 'success' });
        loadTemplates();
      } catch {
        Taro.showToast({ title: '删除失败', icon: 'none' });
      }
    },
    [loadTemplates],
  );

  return (
    <PageContainer>
      <View className="min-h-screen bg-background">
        {/* 导航栏 */}
        <View className="bg-gradient-primary px-5 pt-10 pb-5">
          <View className="flex items-center justify-between">
            <Text className="text-2xl font-bold text-white">课程包管理</Text>
            <View
              className="w-10 h-10 rounded-xl bg-white/25 center press-scale"
              onClick={openCreate}
            >
              <Text className="text-white text-lg font-bold">+</Text>
            </View>
          </View>
        </View>

        {/* 列表 */}
        <ScrollView scrollY className="p-6 px-page-padding">
          {loading ? (
            [1, 2, 3].map((i) => (
              <View key={i} className="p-8 rounded-2xl bg-card mb-5 opacity-60">
                <View className="h-8 w-1/2 bg-muted rounded-sm mb-4" />
                <View className="h-6 w-[70%] bg-muted rounded-sm" />
              </View>
            ))
          ) : templates.length === 0 ? (
            <View className="py-[120rpx] text-center">
              <Text className="text-5xl block mb-6">📦</Text>
              <Text className="text-[30rpx] font-semibold text-foreground block mb-3">
                暂无课程包
              </Text>
              <Text className="text-[26rpx] text-muted-foreground block mb-10">
                创建课程包后可在创建班级时关联
              </Text>
              <View
                className="btn-primary px-12 text-base text-primary-foreground font-semibold"
                onClick={openCreate}
              >
                创建课程包
              </View>
            </View>
          ) : (
            templates.map((pkg) => {
              const typeLabel =
                pkg.type === 'hour_package'
                  ? '课时包'
                  : pkg.type === 'term'
                    ? '期课'
                    : pkg.type === 'monthly'
                      ? '月卡'
                      : '体验课';
              const validInfo = getValidInfo(pkg);
              return (
                <View key={pkg.id} className="p-8 rounded-2xl bg-card mb-5 shadow-card">
                  <View className="flex items-center justify-between">
                    <View className="flex-1">
                      <View className="flex items-center gap-3 mb-3">
                        <Text className="text-[30rpx] font-semibold text-foreground">
                          {pkg.name}
                        </Text>
                        <View className="text-10px text-primary bg-primary-bg px-4 py-0_d5 rounded-sm font-medium">
                          {typeLabel}
                        </View>
                      </View>
                      <View className="flex gap-6 text-sm text-muted-foreground flex-wrap">
                        <Text>¥{pkg.price}</Text>
                        <Text>{pkg.lesson_count > 0 ? `${pkg.lesson_count}课时` : '不限课时'}</Text>
                        <Text>{pkg.duration}分钟/节</Text>
                        {validInfo && <Text>{validInfo}</Text>}
                      </View>
                      {pkg.description && (
                        <Text className="text-xs text-muted-foreground mt-2 block">
                          {pkg.description}
                        </Text>
                      )}
                    </View>
                    {/* 操作按钮 */}
                    <View className="flex flex-col gap-2 ml-4">
                      <Text
                        className="text-[26rpx] text-primary px-4 py-2"
                        onClick={() => openEdit(pkg)}
                      >
                        编辑
                      </Text>
                      <Text
                        className="text-[26rpx] text-destructive px-4 py-2"
                        onClick={() => handleDelete(pkg.id, pkg.name)}
                      >
                        删除
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* 创建/编辑弹窗 */}
        {showModal && (
          <View className="fixed inset-0 z-100">
            {/* 遮罩 */}
            <View
              className={cn(
                'absolute inset-0 transition-all duration-300',
                modalVisible ? 'bg-black/45' : 'bg-transparent',
              )}
              onClick={closeModal}
            />
            {/* 内容面板 */}
            <View
              className={cn(
                'absolute bottom-0 left-0 right-0 rounded-t-[40rpx] px-10 pt-10 pb-[68rpx]',
                'transition-transform duration-300 ease-in-out max-h-[90vh] overflow-y-auto',
                modalVisible ? 'translate-y-0' : 'translate-y-full',
              )}
              style={{ backgroundColor: '#ffffff' }}
            >
              {/* Handle */}
              <View
                className="w-[72rpx] h-[8rpx] rounded-full mx-auto mb-8"
                style={{ backgroundColor: '#D5E8E0' }}
              />
              <Text className="text-xl font-semibold text-foreground block mb-8">{modalTitle}</Text>

              {/* 名称 */}
              <FormInput
                label="课程包名称"
                required
                placeholder="如：暑假特训课包"
                value={formName}
                onInput={(e) => setFormName(e.detail.value || '')}
                className="mb-7"
              />

              {/* 类型 */}
              <View className="mb-7">
                <Text className="text-sm text-muted-foreground mb-3 font-medium block">类型</Text>
                <View className="flex gap-4">
                  {PACKAGE_TYPES.map((t) => (
                    <View
                      key={t.key}
                      className={cn(
                        'flex-1 py-[20rpx] px-4 rounded-2xl text-center border-2 border-solid',
                        formType === t.key ? 'border-primary bg-primary-bg' : '',
                      )}
                      style={
                        formType === t.key
                          ? undefined
                          : { backgroundColor: '#f5faf8', borderColor: '#D5E8E0' }
                      }
                      onClick={() => handleTypeChange(t.key)}
                    >
                      <Text
                        className={cn(
                          'text-sm font-semibold block',
                          formType === t.key ? 'text-primary' : 'text-foreground',
                        )}
                      >
                        {t.label}
                      </Text>
                      <Text className="text-10px text-muted-foreground block mt-1">{t.desc}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* 价格 */}
              <FormInput
                label="价格（元）"
                required
                placeholder="如：3200"
                type="digit"
                value={formPrice}
                onInput={(e) => setFormPrice(e.detail.value || '')}
                className="mb-7"
              />

              {/* 课时数 */}
              <FormInput
                label={lessonCountLabel}
                placeholder={lessonCountPlaceholder}
                type="number"
                value={formLessonCount}
                onInput={(e) => setFormLessonCount(e.detail.value || '')}
                className="mb-7"
              />

              {/* 有效天数 */}
              <FormInput
                label={`有效天数${formType === 'hour_package' || formType === 'trial' ? '（选填，0=永久）' : ''}`}
                placeholder={
                  formType === 'term'
                    ? '如：45'
                    : formType === 'monthly'
                      ? '如：30'
                      : formType === 'trial'
                        ? '如：7'
                        : '0=永久有效'
                }
                type="number"
                value={formValidDays}
                onInput={(e) => setFormValidDays(e.detail.value || '')}
                hint={formType === 'term' ? '从学生购课日起计算有效期' : undefined}
                className="mb-7"
              />

              {/* 时长 */}
              <FormInput
                label="每节课时长（分钟）"
                required
                placeholder="如：90"
                type="number"
                value={formDuration}
                onInput={(e) => setFormDuration(e.detail.value || '')}
                className="mb-7"
              />

              {/* 描述 */}
              <FormInput
                label="描述（选填）"
                placeholder="简要描述"
                value={formDesc}
                onInput={(e) => setFormDesc(e.detail.value || '')}
                className="mb-7"
              />

              {/* 提交按钮 */}
              <View
                className={cn(
                  'w-full py-6 rounded-[28rpx] text-center text-[30rpx] font-semibold mt-4',
                  saving ? 'bg-[#ccc] text-[#999]' : 'bg-gradient-primary text-primary-foreground',
                )}
                onClick={saving ? undefined : handleSubmit}
              >
                {saving ? (isEdit ? '保存中...' : '创建中...') : submitText}
              </View>
            </View>
          </View>
        )}
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(CoursePackagesPage);
