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
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import Card from '@/components/Card';
import FormInput from '@/components/FormInput';
import FormRow from '@/components/FormRow';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { SUBJECT_ICONS } from '@/constants/campus-ui';
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

  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      Taro.showToast({ title: '请检查表单填写', icon: 'none' });
      return;
    }
    setSaving(true);

    const iconItem = SUBJECT_ICONS[iconIndex] || SUBJECT_ICONS[0];
    const formData: SubjectFormData = {
      name: name.trim(),
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
      setTimeout(() => Taro.navigateBack(), 800);
    } catch {
      Taro.showToast({ title: isEdit ? '保存失败' : '新增失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [validate, name, iconIndex, isEdit, subjectId]);

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
                    'w-[80rpx] h-[80rpx] rounded-[20rpx] flex items-center justify-center border-[3rpx] press-scale',
                    iconIndex === idx ? 'border-primary' : 'border-transparent',
                  )}
                  style={{ background: item.gradient }}
                  onClick={() => setIconIndex(idx)}
                >
                  <Text className="text-[36rpx]">{item.icon}</Text>
                </View>
              ))}
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* 底部确认按钮 */}
      <View className="fixed left-[32rpx] right-[32rpx] bottom-[calc(32rpx+env(safe-area-inset-bottom))]">
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
