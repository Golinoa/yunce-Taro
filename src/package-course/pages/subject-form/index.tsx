/**
 * 科目新增 / 编辑表单页
 *
 * 用于创建或编辑科目，包含名称输入和图标选择。
 * 设计参考课程表单页的 Card + FormRow 布局。
 */
import { ScrollView, View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import Card from '@/components/Card';
import FormInput from '@/components/FormInput';
import FormRow from '@/components/FormRow';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { SUBJECT_ICONS } from '@/constants/campus-ui';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { subjectService } from '@/services/campus';
import type { SubjectFormData } from '@/types/campus';

/** 表单字段错误 */
interface FormErrors {
  name?: string;
}

/** 科目新增/编辑表单页 */
const SubjectFormPage: React.FC = () => {
  const instance = Taro.getCurrentInstance();
  const subjectId = decodeURIComponent(instance?.router?.params?.id || '');
  const isEdit = !!subjectId;

  // 表单字段
  const [name, setName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [usage, setUsage] = useState({ courseCount: 0, cardCount: 0 });
  const [iconIndex, setIconIndex] = useState(0);

  // 状态
  const { loading, setLoading } = useDelayedLoading();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // 编辑时加载科目详情
  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    Taro.setNavigationBarTitle({ title: '编辑科目' });
    subjectService
      .getById(subjectId)
      .then((data) => {
        if (data) {
          setName(data.name);
          setOriginalName(data.name);
          setUsage({ courseCount: data.courseCount || 0, cardCount: data.cardCount || 0 });
          // 从 icon 反查索引
          const idx = SUBJECT_ICONS.findIndex((item) => item.icon === data.icon);
          setIconIndex(idx >= 0 ? idx : 0);
        }
      })
      .finally(() => setLoading(false));
  }, [subjectId, isEdit]);

  const validate = useCallback((): boolean => {
    const nextErrors: FormErrors = {};
    const trimmed = name.trim();
    if (!trimmed) {
      nextErrors.name = '请输入科目名称';
    } else if (trimmed.length > 20) {
      nextErrors.name = '科目名称最多 20 个字';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [name]);

  const handleDelete = useCallback(async () => {
    if (!isEdit || !subjectId || saving) return;

    const latest = await subjectService.getById(subjectId);
    const latestUsage = {
      courseCount: latest?.courseCount || usage.courseCount,
      cardCount: latest?.cardCount || usage.cardCount,
    };
    const totalUsage = latestUsage.courseCount + latestUsage.cardCount;
    const firstConfirm = await Taro.showModal({
      title: '确认删除科目？',
      content:
        totalUsage > 0
          ? '删除后，关联课程、课包和会员卡的科目将被清空，需要重新补齐。'
          : '删除后无法恢复，确认继续吗？',
      showCancel: true,
      confirmText: '继续删除',
      cancelText: '取消',
    });
    if (!firstConfirm.confirm) return;

    if (totalUsage > 0) {
      const secondConfirm = await Taro.showModal({
        title: '存在关联数据',
        content: `当前关联 ${latestUsage.courseCount} 个课程/课包和 ${latestUsage.cardCount} 个会员卡种，删除会清空这些关联的科目。仍要删除吗？`,
        showCancel: true,
        confirmText: '确认删除',
        cancelText: '返回',
      });
      if (!secondConfirm.confirm) return;
    }

    setSaving(true);
    try {
      await subjectService.delete(subjectId);
      Taro.showToast({ title: '删除成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 300);
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [isEdit, subjectId, saving, usage]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      Taro.showToast({ title: '请检查表单填写', icon: 'none' });
      return;
    }

    const trimmedName = name.trim();
    const renamed = isEdit && originalName && trimmedName !== originalName;
    if (renamed && usage.courseCount + usage.cardCount > 0) {
      const confirm = await Taro.showModal({
        title: '同步修改关联数据',
        content: `该科目已关联 ${usage.courseCount} 个课程/课包和 ${usage.cardCount} 个会员卡种，修改名称后会同步更新关联数据。继续吗？`,
        showCancel: true,
        confirmText: '继续保存',
        cancelText: '取消',
      });
      if (!confirm.confirm) return;
    }

    setSaving(true);
    const iconItem = SUBJECT_ICONS[iconIndex] || SUBJECT_ICONS[0];
    const formData: SubjectFormData = {
      name: trimmedName,
      icon: iconItem.icon,
      color: iconItem.color,
      iconGradient: iconItem.gradient,
    };

    try {
      if (isEdit) {
        await subjectService.update(subjectId, formData);
        Taro.showToast({ title: '保存成功', icon: 'success' });
      } else {
        await subjectService.add(formData);
        Taro.showToast({ title: '新增成功', icon: 'success' });
      }
      setTimeout(() => Taro.navigateBack(), 300);
    } catch {
      Taro.showToast({ title: isEdit ? '保存失败' : '新增失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [validate, name, originalName, usage, iconIndex, isEdit, subjectId]);

  if (loading) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载科目信息中..." />
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
        style={{ paddingBottom: '180rpx' }}
      >
        <View className="px-[32rpx] py-[24rpx]">
          <Card className="p-[32rpx]">
            {/* 科目名称 */}
            <FormInput
              label="科目名称"
              required
              placeholder="如：钢琴、舞蹈、美术"
              value={name}
              onInput={(e) => setName(e.detail.value)}
              error={errors.name}
              maxlength={20}
            />

            {/* 图标选择 */}
            <FormRow label="科目图标" border={false}>
              <Text className="text-[24rpx] text-muted-foreground">点击选择</Text>
            </FormRow>
            <View className="flex flex-row flex-wrap gap-[24rpx]">
              {SUBJECT_ICONS.map((item, idx) => (
                <View
                  key={idx}
                  className={cn(
                    'relative w-[80rpx] h-[80rpx] rounded-[20rpx] flex items-center justify-center border-[3rpx] press-scale',
                    iconIndex === idx
                      ? 'border-primary shadow-float scale-105'
                      : 'border-transparent',
                  )}
                  style={{ background: item.gradient }}
                  onClick={() => setIconIndex(idx)}
                >
                  <Text className="text-[36rpx]">{item.icon}</Text>
                  {iconIndex === idx && (
                    <Text className="absolute right-[-6rpx] top-[-10rpx] w-[28rpx] h-[28rpx] rounded-full bg-primary text-white text-[20rpx] leading-[28rpx] text-center">
                      ✓
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* 底部操作按钮 */}
      <View className="fixed left-[32rpx] right-[32rpx] bottom-[calc(32rpx+env(safe-area-inset-bottom))]">
        {isEdit && (
          <View
            className={cn(
              'w-full mb-[20rpx] py-[22rpx] rounded-full border-[2rpx] border-red-400 flex items-center justify-center press-scale',
              saving && 'opacity-60 pointer-events-none',
            )}
            onClick={() => void handleDelete()}
          >
            <Text className="text-[28rpx] font-medium text-red-500">删除科目</Text>
          </View>
        )}
        <View
          className={cn(
            'w-full py-[26rpx] rounded-full bg-primary flex items-center justify-center press-scale shadow-float',
            saving && 'opacity-60 pointer-events-none',
          )}
          onClick={() => void handleSubmit()}
        >
          <Text className="text-[30rpx] font-semibold text-white">
            {saving ? '保存中...' : isEdit ? '保存' : '确认新增'}
          </Text>
        </View>
      </View>
    </PageContainer>
  );
};

// eslint-disable-next-line import/no-named-as-default-member
definePageConfig({
  navigationBarTitleText: '新增科目',
  navigationBarBackgroundColor: '#FFFFFF',
  navigationBarTextStyle: 'black',
});

export default SubjectFormPage;
