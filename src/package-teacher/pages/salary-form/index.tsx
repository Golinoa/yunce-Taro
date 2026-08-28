/**
 * 员工工资设置详情页
 *
 * 路由参数：
 *  - teacherId: 员工 ID（必须）
 *  - name: 员工姓名（可选，用于顶部展示）
 *
 * 功能：
 *  - 导航栏标题显示为 "{员工名}工资设置"
 *  - 通过 SalaryRuleEditor 完成完整薪资规则配置
 *  - 保存按钮上方提供"薪资模板"入口，支持：套用模板 / 另存为模板 / 复制给其他员工
 *  - 页面底部固定保存按钮
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/Card';
import ApplyTemplateConfirmDialog from '@/components/teacher/ApplyTemplateConfirmDialog';
import CopyToTeachersSheet from '@/components/teacher/CopyToTeachersSheet';
import SalaryRuleEditor from '@/components/teacher/SalaryRuleEditor';
import SalaryTemplateActionSheet from '@/components/teacher/SalaryTemplateActionSheet';
import SaveTemplateDialog from '@/components/teacher/SaveTemplateDialog';
import TemplatePickerSheet from '@/components/teacher/TemplatePickerSheet';
import { createDefaultSalaryRule } from '@/domain/teacher-salary';
import { useTeacherStore } from '@/stores/teacher';
import { useThemeStore } from '@/stores/theme';
import type { SalaryRuleConfig, SalaryTemplate } from '@/types/teacher';
import { useCardNavigationBar } from '@/utils/navigation-bar';

const SalaryFormPage: React.FC = () => {
  useCardNavigationBar();
  const { activeTheme } = useThemeStore();
  const router = useRouter();
  const teacherId = (router.params?.teacherId as string) || '';
  const nameFromParam = decodeURIComponent((router.params?.name as string) || '');

  const {
    teachers,
    fetchAll,
    fetchSalaryTemplates,
    fetchTeacherSalaryRule,
    updateTeacherSalaryRule,
    createSalaryTemplate,
    copySalaryRuleToTeachers,
  } = useTeacherStore();

  const teacher = useMemo(() => teachers.find((t) => t.id === teacherId), [teachers, teacherId]);
  const displayName = teacher?.name || nameFromParam || '员工';

  const [rule, setRule] = useState<SalaryRuleConfig>(() => createDefaultSalaryRule());
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | undefined>(
    teacher?.salaryTemplateId,
  );

  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  /** 薪资模板操作弹窗 */
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  /** 模板选择弹窗 */
  const [templatePickerVisible, setTemplatePickerVisible] = useState(false);
  /** 模板套用确认弹窗 */
  const [confirmTpl, setConfirmTpl] = useState<SalaryTemplate | null>(null);
  /** 另存为模板弹窗 */
  const [saveDialogVisible, setSaveDialogVisible] = useState(false);
  /** 复制给其他员工弹窗 */
  const [copySheetVisible, setCopySheetVisible] = useState(false);

  useDidShow(() => {
    void fetchAll();
    void fetchSalaryTemplates();
  });

  // 设置导航栏标题为 "xx工资设置"，并移除页面内重复标题
  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: `${displayName}工资设置` });
  }, [displayName]);

  // 首次进入：拉取当前教师的薪资规则配置
  useEffect(() => {
    if (!teacherId || initialized) return;
    let cancelled = false;
    (async () => {
      const r = await fetchTeacherSalaryRule(teacherId);
      if (cancelled) return;
      if (r) setRule(r);
      setInitialized(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [teacherId, initialized, fetchTeacherSalaryRule]);

  /** 保存当前配置到后端 */
  const handleSave = useCallback(async () => {
    if (!teacherId) {
      Taro.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    setSaving(true);
    try {
      const ok = await updateTeacherSalaryRule(teacherId, rule, appliedTemplateId);
      if (ok) {
        Taro.showToast({ title: '保存成功', icon: 'success' });
        setTimeout(() => Taro.navigateBack(), 500);
      } else {
        Taro.showToast({ title: '保存失败', icon: 'none' });
      }
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [teacherId, rule, appliedTemplateId, updateTeacherSalaryRule]);

  /** 打开"薪资模板"操作弹窗 */
  const handleOpenTemplateAction = useCallback(() => {
    setActionSheetVisible(true);
  }, []);

  /** 选择操作项 */
  const handleSelectAction = useCallback((action: 'apply' | 'save' | 'copy') => {
    setActionSheetVisible(false);
    if (action === 'apply') {
      setTemplatePickerVisible(true);
    } else if (action === 'save') {
      setSaveDialogVisible(true);
    } else if (action === 'copy') {
      setCopySheetVisible(true);
    }
  }, []);

  /** 模板选择弹窗：选中模板 → 二次确认 */
  const handleSelectTemplate = useCallback((tpl: SalaryTemplate) => {
    setTemplatePickerVisible(false);
    setConfirmTpl(tpl);
  }, []);

  /** 取消套用确认 */
  const handleConfirmCancel = useCallback(() => {
    setConfirmTpl(null);
  }, []);

  /** 确认套用：将模板配置写入表单（不立即持久化） */
  const handleConfirmApply = useCallback(() => {
    if (!confirmTpl) return;
    setRule({ ...confirmTpl.config });
    setAppliedTemplateId(confirmTpl.id);
    setConfirmTpl(null);
    Taro.showToast({ title: '已套用，记得保存', icon: 'none' });
  }, [confirmTpl]);

  /** 另存为模板 */
  const handleSaveAsTemplate = useCallback(
    async (name: string) => {
      setSaveDialogVisible(false);
      try {
        await createSalaryTemplate({
          name,
          config: { ...rule },
          summary: '',
          isDefault: false,
          teacherCount: 0,
        });
        Taro.showToast({ title: '模板保存成功', icon: 'success' });
      } catch {
        Taro.showToast({ title: '模板保存失败', icon: 'none' });
      }
    },
    [createSalaryTemplate, rule],
  );

  /** 复制当前配置给其他员工 */
  const handleCopyToTeachers = useCallback(
    async (targetIds: string[]) => {
      setCopySheetVisible(false);
      try {
        const result = await copySalaryRuleToTeachers(teacherId, targetIds);
        if (result.success) {
          // 组装带姓名的成功提示
          const targetNames = targetIds
            .map((id) => teachers.find((t) => t.id === id)?.name)
            .filter(Boolean) as string[];
          let toastTitle = '复制成功';
          if (targetNames.length === 1) {
            toastTitle = `成功复制给 ${targetNames[0]}`;
          } else if (targetNames.length === 2) {
            toastTitle = `成功复制给 ${targetNames.join('、')}`;
          } else if (targetNames.length > 2) {
            toastTitle = `成功复制给 ${targetNames.slice(0, 2).join('、')} 等${targetNames.length}位员工`;
          }
          Taro.showToast({ title: toastTitle, icon: 'success' });
        } else {
          Taro.showToast({ title: result.message || '复制失败', icon: 'none' });
        }
      } catch {
        Taro.showToast({ title: '复制失败', icon: 'none' });
      }
    },
    [copySalaryRuleToTeachers, teacherId, teachers],
  );

  return (
    <View className={cn(`theme-${activeTheme}`, 'min-h-screen bg-background')}>
      <ScrollView scrollY className="h-screen" style={{ paddingBottom: '300rpx' }}>
        <View className="px-[32rpx] py-[24rpx]">
          {/* 套用模板 + 薪资规则共用一个 Card */}
          <Card className="p-[32rpx] flex flex-col gap-[24rpx]">
            {/* 薪资规则编辑器（不渲染内置保存按钮，不单独包 Card） */}
            <SalaryRuleEditor
              value={rule}
              onChange={setRule}
              showTemplateButton={false}
              showSaveButton={false}
              wrapInCard={false}
            />
          </Card>
        </View>
      </ScrollView>

      {/* 底部固定按钮区：薪资模板 + 保存 */}
      <View className="fixed left-[32rpx] right-[32rpx] bottom-[calc(40rpx+env(safe-area-inset-bottom))] flex flex-col gap-[20rpx]">
        {/* 薪资模板入口：白底主题色边框，与保存按钮区分 */}
        <View
          className="w-full py-[26rpx] rounded-full bg-white flex items-center justify-center press-scale border-[2rpx] border-primary"
          onClick={handleOpenTemplateAction}
        >
          <Text className="text-[30rpx] font-semibold text-primary leading-none">薪资模板</Text>
        </View>

        {/* 保存按钮 */}
        <View
          className={cn(
            'w-full py-[28rpx] rounded-full bg-primary flex items-center justify-center press-scale shadow-float',
            saving && 'opacity-60 pointer-events-none',
          )}
          onClick={() => void handleSave()}
        >
          <Text className="text-[30rpx] font-semibold text-white">
            {saving ? '保存中...' : '保存'}
          </Text>
        </View>
      </View>

      {/* 薪资模板操作弹窗 */}
      <SalaryTemplateActionSheet
        visible={actionSheetVisible}
        onClose={() => setActionSheetVisible(false)}
        onSelect={handleSelectAction}
      />

      {/* 模板选择弹窗 */}
      <TemplatePickerSheet
        visible={templatePickerVisible}
        onClose={() => setTemplatePickerVisible(false)}
        onSelect={handleSelectTemplate}
      />

      {/* 套用确认弹窗 */}
      <ApplyTemplateConfirmDialog
        visible={!!confirmTpl}
        templateName={confirmTpl?.name || ''}
        count={1}
        onCancel={handleConfirmCancel}
        onConfirm={handleConfirmApply}
      />

      {/* 另存为模板弹窗 */}
      <SaveTemplateDialog
        visible={saveDialogVisible}
        onClose={() => setSaveDialogVisible(false)}
        onSave={handleSaveAsTemplate}
      />

      {/* 复制给其他员工弹窗 */}
      <CopyToTeachersSheet
        visible={copySheetVisible}
        excludeTeacherId={teacherId}
        onClose={() => setCopySheetVisible(false)}
        onConfirm={handleCopyToTeachers}
      />
    </View>
  );
};

export default SalaryFormPage;

// eslint-disable-next-line import/no-named-as-default-member
definePageConfig({
  navigationBarTitleText: '工资设置',
  navigationBarBackgroundColor: '#ffffff',
  navigationBarTextStyle: 'black',
});
