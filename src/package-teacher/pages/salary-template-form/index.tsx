/**
 * 薪资模板 - 新建 / 编辑页
 *
 * 表单字段：
 *  - 模板名称
 *  - 简短描述（可选）
 *  - 是否设为默认
 *  - 完整薪资规则（复用 SalaryRuleEditor）
 *
 * 页面承载固定底部保存按钮，SalaryRuleEditor 仅负责规则编辑。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import Card from '@/components/Card';
import FormRow from '@/components/FormRow';
import Switch from '@/components/Switch';
import SalaryRuleEditor from '@/components/teacher/SalaryRuleEditor';
import { createDefaultSalaryRule } from '@/domain/teacher-salary';
import { useTeacherStore } from '@/stores/teacher';
import { useThemeStore } from '@/stores/theme';
import type { SalaryRuleConfig } from '@/types/teacher';
import { useCardNavigationBar } from '@/utils/navigation-bar';

/** 表单字段错误 */
interface SalaryTemplateFormErrors {
  name?: string;
}

const SalaryTemplateFormPage: React.FC = () => {
  useCardNavigationBar();
  const { activeTheme } = useThemeStore();
  const router = useRouter();
  const editId = (router.params?.id as string) || '';
  const isEdit = !!editId;

  const { salaryTemplates, fetchSalaryTemplates, createSalaryTemplate, updateSalaryTemplate } =
    useTeacherStore();

  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [rule, setRule] = useState<SalaryRuleConfig>(() => createDefaultSalaryRule());
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<SalaryTemplateFormErrors>({});

  useDidShow(() => {
    void fetchSalaryTemplates();
  });

  // 编辑态：回填
  useEffect(() => {
    if (!isEdit || loaded) return;
    const tpl = salaryTemplates.find((t) => t.id === editId);
    if (tpl) {
      setName(tpl.name);
      setSummary(tpl.summary ?? '');
      setIsDefault(!!tpl.isDefault);
      setRule({ ...tpl.config });
    }
    setLoaded(true);
  }, [isEdit, editId, salaryTemplates, loaded]);

  const validate = useCallback((): boolean => {
    const next: SalaryTemplateFormErrors = {};
    if (!name.trim()) {
      next.name = '请输入模板名称';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [name]);

  const handleSave = useCallback(async () => {
    if (!validate()) {
      Taro.showToast({ title: '请检查表单填写', icon: 'none' });
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateSalaryTemplate(editId, {
          name: name.trim(),
          summary: summary.trim() || undefined,
          isDefault,
          config: rule,
        });
        Taro.showToast({ title: '保存成功', icon: 'success' });
      } else {
        await createSalaryTemplate({
          name: name.trim(),
          summary: summary.trim() || undefined,
          isDefault,
          teacherCount: 0,
          config: rule,
        });
        Taro.showToast({ title: '已创建', icon: 'success' });
      }
      setTimeout(() => Taro.navigateBack(), 600);
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [
    validate,
    isEdit,
    editId,
    name,
    summary,
    isDefault,
    rule,
    createSalaryTemplate,
    updateSalaryTemplate,
  ]);

  const handleToggleDefault = useCallback((on: boolean) => {
    setIsDefault(on);
    if (on) {
      Taro.showToast({ title: '保存后将成为默认模板', icon: 'none' });
    }
  }, []);

  return (
    <View className={cn(`theme-${activeTheme}`, 'min-h-screen bg-background')}>
      <ScrollView scrollY className="h-screen" style={{ paddingBottom: '180rpx' }}>
        <View className="px-[32rpx] py-[24rpx] flex flex-col gap-[24rpx]">
          {/* 基本信息 */}
          <Card className="p-[32rpx]">
            <FormRow
              label="模板名称"
              required
              editable
              placeholder="例如：兼职书法老师·A档"
              value={name}
              onInput={(e) => setName(e.detail.value)}
              error={errors.name}
            />
            <FormRow
              label="简短描述"
              editable
              placeholder="例如：兼职80/次（可选）"
              value={summary}
              onInput={(e) => setSummary(e.detail.value)}
            />
            <View className="flex items-center justify-between py-[24rpx]">
              <View>
                <Text className="text-[30rpx] text-foreground block">设为默认模板</Text>
                <Text className="text-[24rpx] text-muted-foreground mt-[4rpx] block">
                  新建员工时会自动套用该模板
                </Text>
              </View>
              <Switch checked={isDefault} onChange={handleToggleDefault} />
            </View>
          </Card>

          {/* 薪资规则编辑器（不渲染内置保存按钮） */}
          <SalaryRuleEditor
            value={rule}
            onChange={setRule}
            showTemplateButton={false}
            showSaveButton={false}
          />
        </View>
      </ScrollView>

      {/* 底部固定保存按钮 */}
      <View className="fixed left-[32rpx] right-[32rpx] bottom-[calc(32rpx+env(safe-area-inset-bottom))]">
        <View
          className={cn(
            'w-full py-[26rpx] rounded-full bg-primary flex items-center justify-center press-scale shadow-float',
            saving && 'opacity-60 pointer-events-none',
          )}
          onClick={() => void handleSave()}
        >
          <Text className="text-[30rpx] font-semibold text-white">
            {saving ? '保存中...' : '保存模板'}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default SalaryTemplateFormPage;
