/**
 * SalaryRuleEditor - 薪资规则配置编辑器（核心组件）
 *
 * 适用于：
 *  - 员工工资设置详情页
 *  - 薪资模板新建 / 编辑页
 *
 * 配置项覆盖：
 *  底薪（固定/按个人/按全店业绩）+ 医社保 + 课时费
 *  （统一/按课程设置/按上课人数/按月课量阶梯/按业绩阶梯）
 *  + 按课程分类单独设置 + 担任助教补贴 + 提成（无/个人/全店业绩）
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Card from '@/components/Card';
import FormRow from '@/components/FormRow';
import AttendanceTierEditor from './AttendanceTierEditor';
import CategoryLessonFeeCard from './CategoryLessonFeeCard';
import {
  BASE_MODE_OPTIONS,
  COMMISSION_MODE_OPTIONS,
  HINTS,
  INSURANCE_OPTIONS,
  LESSON_FEE_MODE_OPTIONS,
} from './constants';
import CourseGroupFeeEditor from './CourseGroupFeeEditor';
import EditorSection from './EditorSection';
import GradientRow from './GradientRow';
import PerfTierEditor from './PerfTierEditor';
import TierGroupCard from './TierGroupCard';
import { useSalaryRuleEditor } from './use-salary-rule-editor';
import type { SalaryRuleEditorProps } from './types';

export type { SalaryRuleEditorProps } from './types';

const SalaryRuleEditor: React.FC<SalaryRuleEditorProps> = ({
  value,
  onChange,
  showTemplateButton = false,
  onPickTemplate,
  showSaveButton = true,
  saveText = '保存',
  onSave,
  saving = false,
  pageTitle,
  wrapInCard = true,
}) => {
  const editor = useSalaryRuleEditor(value, onChange, onSave);
  const {
    errors,
    categorySectionExpanded,
    setCategorySectionExpanded,
    customizedCategoryCount,
    patch,
    handleSave,
    handleBaseModeChange,
    updateBaseTier,
    deleteBaseTier,
    addBaseTier,
    handleInsuranceToggle,
    handleLessonModeChange,
    toggleCourseShare,
    updateCourseRate,
    toggleCourseItemShare,
    updateAttendanceTier,
    deleteAttendanceTier,
    addAttendanceTier,
    toggleTierGroup,
    changeTierGroupBasis,
    changeTierGroupCalc,
    updateTierRow,
    deleteTierRow,
    addTierRow,
    updatePerfTier,
    deletePerfTier,
    addPerfTier,
    updateCategoryLessonAlgorithm,
    updateCategoryLessonFixedRate,
    updateCategoryLessonBasis,
    updateCategoryLessonCalc,
    updateCategoryLessonPerfPayout,
    updateCategoryLessonTier,
    addCategoryLessonTier,
    deleteCategoryLessonTier,
    updateCategoryLessonPerfTier,
    addCategoryLessonPerfTier,
    deleteCategoryLessonPerfTier,
    updateCategoryFee,
    handleCommissionMode,
    updateCommissionTier,
    deleteCommissionTier,
    addCommissionTier,
  } = editor;

  const RuleWrapper = wrapInCard ? Card : View;

  return (
    <View className="flex flex-col">
      {pageTitle && (
        <View className="px-[32rpx] pt-[24rpx] pb-[12rpx]">
          <Text className="text-[40rpx] font-bold text-foreground">{pageTitle}</Text>
        </View>
      )}

      <RuleWrapper className={cn('flex flex-col gap-[24rpx]', wrapInCard && 'p-[32rpx]')}>
        <EditorSection
          title="底薪设置"
          hint={HINTS.base}
          selectorOptions={BASE_MODE_OPTIONS as { label: string; value: string }[]}
          selectorValue={value.baseMode}
          onSelectorChange={handleBaseModeChange}
        >
          {value.baseMode === 'fixed' ? (
            <FormRow
              label="固定工资"
              editable
              inputType="digit"
              placeholder="0"
              suffix="元"
              value={String(value.fixedBaseAmount ?? '')}
              onInput={(e) => {
                const raw = e.detail.value;
                patch({ fixedBaseAmount: raw === '' ? '' : Number(raw) });
              }}
              error={errors.fixedBaseAmount}
            />
          ) : (
            <View>
              <Text className="text-[28rpx] font-bold text-primary mb-[8rpx] block">阶梯设置</Text>
              {value.baseTiers.map((t, idx) => (
                <GradientRow
                  key={t.id}
                  fields={[
                    {
                      key: 'perfThreshold',
                      label: '业绩达到：',
                      suffix: '元,',
                      error: errors.baseTiers?.[t.id]?.perfThreshold,
                    },
                    {
                      key: 'baseAmount',
                      label: '底薪为：',
                      suffix: '元',
                      error: errors.baseTiers?.[t.id]?.baseAmount,
                    },
                  ]}
                  values={{
                    perfThreshold: String(t.perfThreshold ?? ''),
                    baseAmount: String(t.baseAmount ?? ''),
                  }}
                  onChange={(k, raw) =>
                    updateBaseTier(t.id, k as 'perfThreshold' | 'baseAmount', raw)
                  }
                  showDelete={value.baseTiers.length > 1 || idx > 0}
                  onDelete={() => deleteBaseTier(t.id)}
                />
              ))}
              <GradientRow asAddButton onAdd={addBaseTier} />
            </View>
          )}
        </EditorSection>

        <EditorSection
          title="医社保"
          hint={HINTS.insurance}
          selectorOptions={INSURANCE_OPTIONS}
          selectorValue={value.insurance.enabled ? 'on' : 'off'}
          onSelectorChange={handleInsuranceToggle}
        >
          {value.insurance.enabled && (
            <View className="flex flex-col gap-[12rpx]">
              <FormRow
                label="公司缴交金额"
                editable
                inputType="digit"
                placeholder="0"
                suffix="元"
                value={String(value.insurance.companyAmount ?? '')}
                onInput={(e) => {
                  const raw = e.detail.value;
                  patch({
                    insurance: {
                      ...value.insurance,
                      companyAmount: raw === '' ? '' : Number(raw),
                    },
                  });
                }}
                error={errors.insurance?.companyAmount}
              />
              <FormRow
                label="个人缴交金额"
                editable
                inputType="digit"
                placeholder="0"
                suffix="元"
                value={String(value.insurance.personalAmount ?? '')}
                onInput={(e) => {
                  const raw = e.detail.value;
                  patch({
                    insurance: {
                      ...value.insurance,
                      personalAmount: raw === '' ? '' : Number(raw),
                    },
                  });
                }}
                error={errors.insurance?.personalAmount}
              />
            </View>
          )}
        </EditorSection>

        <EditorSection
          title="课时费"
          hint={HINTS.lessonFee}
          selectorOptions={LESSON_FEE_MODE_OPTIONS as { label: string; value: string }[]}
          selectorValue={value.lessonFeeMode}
          onSelectorChange={handleLessonModeChange}
        >
          {value.lessonFeeMode === 'unified' && (
            <View>
              <Text className="text-[24rpx] text-muted-foreground leading-relaxed mb-[12rpx] block">
                所有课程按同一固定金额计算课时费。
              </Text>
              <FormRow
                label="统一课时费"
                editable
                inputType="digit"
                placeholder="0"
                suffix="元/课时"
                value={String(value.unifiedLessonRate ?? '')}
                onInput={(e) => {
                  const raw = e.detail.value;
                  patch({ unifiedLessonRate: raw === '' ? '' : Number(raw) });
                }}
                error={errors.unifiedLessonRate}
              />
            </View>
          )}

          {value.lessonFeeMode === 'by_course' && (
            <CourseGroupFeeEditor
              groups={value.courseGroupFees}
              onToggleShare={toggleCourseShare}
              onToggleItemShare={toggleCourseItemShare}
              onUpdateRate={updateCourseRate}
            />
          )}

          {value.lessonFeeMode === 'by_attendance' && (
            <AttendanceTierEditor
              tiers={value.attendanceTiers}
              errors={errors.attendanceTiers}
              onChange={updateAttendanceTier}
              onDelete={deleteAttendanceTier}
              onAdd={addAttendanceTier}
            />
          )}

          {value.lessonFeeMode === 'by_monthly_tier' && (
            <View className="flex flex-col">
              <Text className="text-[24rpx] text-muted-foreground leading-relaxed mb-[12rpx] block">
                按当月累计课时数或上课业绩落档计费，团课、私教各设一套梯度。
              </Text>
              {value.lessonTierGroups.map((g) => (
                <TierGroupCard
                  key={g.type}
                  group={g}
                  errors={errors.lessonTiers?.[g.type]}
                  onToggle={(on) => toggleTierGroup(g.type, on)}
                  onBasis={(b) => changeTierGroupBasis(g.type, b)}
                  onCalc={(c) => changeTierGroupCalc(g.type, c)}
                  onTierChange={(tierId, key, raw) => updateTierRow(g.type, tierId, key, raw)}
                  onTierDelete={(tierId) => deleteTierRow(g.type, tierId)}
                  onAddTier={() => addTierRow(g.type)}
                />
              ))}
            </View>
          )}

          {value.lessonFeeMode === 'by_perf_tier' && (
            <PerfTierEditor
              tiers={value.perfTiers}
              errors={errors.perfTiers}
              hint={HINTS.perfTier}
              onChange={updatePerfTier}
              onDelete={deletePerfTier}
              onAdd={addPerfTier}
            />
          )}
        </EditorSection>

        <EditorSection
          title="按课程分类单独设置"
          hint={HINTS.categoryLessonFee}
          showDivider={false}
          collapsible
          expanded={categorySectionExpanded}
          onToggle={() => setCategorySectionExpanded((prev) => !prev)}
        >
          <View className="flex flex-col gap-[16rpx]">
            {customizedCategoryCount > 0 && (
              <Text className="text-[24rpx] text-primary font-medium">
                {customizedCategoryCount}个分类已单独设置
              </Text>
            )}
            {value.categoryLessonFees.map((item) => (
              <CategoryLessonFeeCard
                key={item.id}
                item={item}
                errors={errors.categoryLessonFees?.[item.id]}
                onAlgorithmChange={updateCategoryLessonAlgorithm}
                onFixedRateChange={updateCategoryLessonFixedRate}
                onBasisChange={updateCategoryLessonBasis}
                onCalcChange={updateCategoryLessonCalc}
                onPerfPayoutChange={updateCategoryLessonPerfPayout}
                onTierChange={updateCategoryLessonTier}
                onAddTier={addCategoryLessonTier}
                onDeleteTier={deleteCategoryLessonTier}
                onPerfTierChange={updateCategoryLessonPerfTier}
                onAddPerfTier={addCategoryLessonPerfTier}
                onDeletePerfTier={deleteCategoryLessonPerfTier}
              />
            ))}
          </View>
        </EditorSection>

        <EditorSection title="担任助教" hint={HINTS.categoryExtra} showDivider={false}>
          <View className="flex flex-col gap-[16rpx]">
            {value.categoryExtraFees.map((e) => (
              <FormRow
                key={e.id}
                label={e.name}
                editable
                inputType="digit"
                placeholder="0"
                suffix="元/节"
                value={String(e.rate ?? '')}
                onInput={(event) => {
                  const raw = event.detail.value;
                  updateCategoryFee(e.id, raw);
                }}
                error={errors.categoryExtraFees?.[e.id]}
              />
            ))}
          </View>
        </EditorSection>

        <EditorSection
          title="提成设置"
          hint={HINTS.commission}
          selectorOptions={COMMISSION_MODE_OPTIONS as { label: string; value: string }[]}
          selectorValue={value.commissionMode}
          onSelectorChange={handleCommissionMode}
          showDivider={false}
        >
          {value.commissionMode !== 'none' && (
            <View className="mt-[4rpx]">
              {value.commissionTiers.map((t, idx) => (
                <GradientRow
                  key={t.id}
                  fields={[
                    {
                      key: 'perfThreshold',
                      label: '业绩达到：',
                      suffix: '元,',
                      error: errors.commissionTiers?.[t.id]?.perfThreshold,
                    },
                    {
                      key: 'rate',
                      label: '提成比例：',
                      suffix: '%',
                      error: errors.commissionTiers?.[t.id]?.rate,
                    },
                  ]}
                  values={{
                    perfThreshold: String(t.perfThreshold ?? ''),
                    rate: String(t.rate ?? ''),
                  }}
                  onChange={(k, raw) =>
                    updateCommissionTier(t.id, k as 'perfThreshold' | 'rate', raw)
                  }
                  showDelete={value.commissionTiers.length > 1 || idx > 0}
                  onDelete={() => deleteCommissionTier(t.id)}
                />
              ))}
              <GradientRow asAddButton onAdd={addCommissionTier} />
            </View>
          )}
        </EditorSection>
      </RuleWrapper>

      {showTemplateButton && (
        <View
          className="mx-[32rpx] mb-[20rpx] py-[22rpx] rounded-[20rpx] border-[2rpx] border-primary bg-white flex items-center justify-center press-bg"
          onClick={() => onPickTemplate?.()}
        >
          <Text className="text-[30rpx] font-semibold text-primary leading-none">薪资模板</Text>
        </View>
      )}

      {showSaveButton && (
        <View className="mx-[32rpx] mb-[40rpx]">
          <View
            className={cn(
              'w-full py-[28rpx] rounded-full text-center shadow-card press-scale',
              saving ? 'bg-muted text-muted-foreground' : 'bg-primary text-white',
            )}
            onClick={saving ? undefined : handleSave}
          >
            <Text className="text-[32rpx] font-bold leading-none">
              {saving ? '保存中...' : saveText}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default SalaryRuleEditor;
