/**
 * 薪资模板列表页
 *
 * 功能：
 *  - 展示所有薪资模板（卡片）：名称 + 摘要 + 默认标签 + 在用人数
 *  - 每个模板有「套用到教练」「编辑」「删除」操作
 *  - 右下角悬浮「+ 新建模板」按钮
 *  - 套用流程：选择教练（多选）→ 二次确认弹窗 → 执行套用
 *  - 删除：默认模板也可删除，删除后不再自动指定新默认模板；默认模板始终由用户手动开启，且最多一个
 */
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import ApplyTeacherSheet from '@/components/teacher/ApplyTeacherSheet';
import ApplyTemplateConfirmDialog from '@/components/teacher/ApplyTemplateConfirmDialog';
import { useTeacherStore } from '@/stores/teacher';
import type { SalaryTemplate } from '@/types/teacher';

type ApplyState =
  | { phase: 'none' }
  | { phase: 'select'; template: SalaryTemplate }
  | { phase: 'confirm'; template: SalaryTemplate; ids: string[] };

const SalaryTemplateListPage: React.FC = () => {
  const {
    salaryTemplates,
    fetchSalaryTemplates,
    fetchTeachers,
    deleteSalaryTemplate,
    applySalaryTemplate,
  } = useTeacherStore();

  const [applyState, setApplyState] = useState<ApplyState>({ phase: 'none' });
  /** 删除确认（简易版用 Taro.showModal） */

  useDidShow(() => {
    void fetchSalaryTemplates();
    void fetchTeachers();
  });

  const handleCreate = useCallback(() => {
    Taro.navigateTo({
      url: '/package-teacher/pages/salary-template-form/index',
    });
  }, []);

  const handleEdit = useCallback((tpl: SalaryTemplate) => {
    Taro.navigateTo({
      url: `/package-teacher/pages/salary-template-form/index?id=${tpl.id}`,
    });
  }, []);

  /** 套用按钮：打开教练多选弹窗 */
  const handleApplyClick = useCallback((template: SalaryTemplate) => {
    setApplyState({ phase: 'select', template });
  }, []);

  /** 教练多选确定 → 二次确认弹窗 */
  const handleTeacherSelected = useCallback(
    (ids: string[]) => {
      if (applyState.phase !== 'select') return;
      setApplyState({ phase: 'confirm', template: applyState.template, ids });
    },
    [applyState],
  );

  /** 确认弹窗取消 → 返回选择 */
  const handleConfirmCancel = useCallback(() => {
    setApplyState((prev) =>
      prev.phase === 'confirm' ? { phase: 'select', template: prev.template } : { phase: 'none' },
    );
  }, []);

  /** 确认弹窗确定 → 执行套用 */
  const handleConfirmApply = useCallback(async () => {
    if (applyState.phase !== 'confirm') return;
    const ok = await applySalaryTemplate(applyState.template.id, applyState.ids);
    if (ok) {
      Taro.showToast({ title: '套用成功', icon: 'success' });
    } else {
      Taro.showToast({ title: '套用失败', icon: 'none' });
    }
    setApplyState({ phase: 'none' });
  }, [applyState, applySalaryTemplate]);

  /** 删除模板（默认模板也可删除，删除后不自动指定新默认模板） */
  const handleDelete = useCallback(
    (tpl: SalaryTemplate) => {
      const isDefaultHint = tpl.isDefault
        ? '这是当前默认模板，删除后将没有默认模板，新入职员工不会自动套用任何模板。'
        : '';
      Taro.showModal({
        title: '删除模板',
        content: `确定删除模板「${tpl.name}」？${isDefaultHint}已套用该模板的教练配置会保留、但不再关联此模板。`,
        confirmText: '删除',
        confirmColor: '#FF4D4F',
        success: async (res) => {
          if (res.confirm) {
            const ok = await deleteSalaryTemplate(tpl.id);
            if (ok) {
              Taro.showToast({ title: '已删除', icon: 'success' });
            } else {
              Taro.showToast({ title: '删除失败', icon: 'none' });
            }
          }
        },
      });
    },
    [deleteSalaryTemplate],
  );

  const sortedTemplates = useMemo(() => {
    // 默认模板排在最前
    return [...salaryTemplates].sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault));
  }, [salaryTemplates]);

  const applySheetVisible = applyState.phase === 'select' || applyState.phase === 'confirm';
  const applyConfirmVisible = applyState.phase === 'confirm';

  return (
    <View className="min-h-screen bg-background pb-safe-bar">
      {/* 模板列表 */}
      <View className="px-[32rpx] pt-[24rpx] flex flex-col gap-[24rpx]">
        {sortedTemplates.map((tpl) => (
          <View key={tpl.id} className="bg-white rounded-[28rpx] p-[28rpx] shadow-card">
            {/* 顶部：名称 + 默认标签 + 在用人数 */}
            <View className="flex items-start justify-between mb-[16rpx]">
              <View className="flex-1 min-w-0 flex items-center gap-[12rpx] flex-wrap">
                <Text className="text-[32rpx] font-bold text-foreground">{tpl.name}</Text>
                {tpl.isDefault && (
                  <View className="px-[14rpx] py-[4rpx] rounded-[10rpx] bg-warning/15 text-warning text-[20rpx] font-semibold">
                    默认
                  </View>
                )}
              </View>
              <Text className="text-[24rpx] text-muted-foreground shrink-0">
                {tpl.teacherCount ?? 0} 位在用
              </Text>
            </View>

            {/* 摘要 */}
            {tpl.summary && (
              <Text className="text-[26rpx] text-muted-foreground block mb-[20rpx]">
                {tpl.summary}
              </Text>
            )}
            {!tpl.summary && <View className="h-[28rpx] mb-[20rpx]" />}

            {/* 分割线 */}
            <View className="h-[2rpx] bg-border mb-[20rpx]" />

            {/* 操作按钮 */}
            <View className="flex items-center justify-end gap-[40rpx]">
              <Text
                className="text-[28rpx] font-medium text-primary press-bg px-[12rpx] py-[6rpx] rounded-[12rpx]"
                onClick={() => handleApplyClick(tpl)}
              >
                套用到教练
              </Text>
              <Text
                className="text-[28rpx] font-medium text-foreground press-bg px-[12rpx] py-[6rpx] rounded-[12rpx]"
                onClick={() => handleEdit(tpl)}
              >
                编辑
              </Text>
              <Text
                className="text-[28rpx] font-medium text-destructive press-bg px-[12rpx] py-[6rpx] rounded-[12rpx]"
                onClick={() => handleDelete(tpl)}
              >
                删除
              </Text>
            </View>
          </View>
        ))}

        {/* 空状态占位（列表本身有 mock 数据，这里仅保留扩展性） */}
      </View>

      {/* 悬浮 新建按钮 */}
      <View
        className="fixed right-[32rpx] bottom-[48rpx] pb-safe-bar z-30 px-[32rpx] py-[22rpx] rounded-full shadow-primary flex items-center gap-[8rpx] bg-primary press-scale"
        onClick={handleCreate}
      >
        <Icon name="mdi-plus" size={22} color="#fff" />
        <Text className="text-[30rpx] font-semibold text-white">新建模板</Text>
      </View>

      {/* 套用到教练弹窗 */}
      {applyState.phase !== 'none' && (
        <ApplyTeacherSheet
          visible={applySheetVisible && applyState.phase === 'select'}
          templateName={applyState.template.name}
          onClose={() => setApplyState({ phase: 'none' })}
          onConfirm={handleTeacherSelected}
        />
      )}

      {/* 套用二次确认弹窗 */}
      {applyState.phase === 'confirm' && (
        <ApplyTemplateConfirmDialog
          visible={applyConfirmVisible}
          templateName={applyState.template.name}
          count={applyState.ids.length}
          onCancel={handleConfirmCancel}
          onConfirm={handleConfirmApply}
        />
      )}
    </View>
  );
};

export default SalaryTemplateListPage;
