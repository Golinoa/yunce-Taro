import { View, Text, Input, Textarea } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useEffect } from 'react';
import ChipPicker from '@/components/ChipPicker';
import Empty from '@/components/Empty';
import InstallmentPanel from '@/components/InstallmentPanel';
import MemberCardIssueForm from '@/components/member-card/MemberCardIssueForm';
import Loading from '@/components/Loading';
import PackageSelectSheet from '@/components/package/PackageSelectSheet';
import StudentSelectSheet from '@/components/package/StudentSelectSheet';
import PageContainer from '@/components/PageContainer';
import SegmentedControl from '@/components/SegmentedControl';
import Stepper from '@/components/Stepper';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';
import {
  getQuickHours,
  getGiftOptions,
  getFeeMethodOptions,
  getTypeIconMap,
} from './constants';
import { usePackageForm } from './usePackageForm';

/** 课时充值 / 发会员卡 双 Tab 页 */
const PackageForm: React.FC = () => {
  useCardNavigationBar();
  const QUICK_HOURS = getQuickHours();
  const GIFT_OPTIONS = getGiftOptions();
  // 局部命名刻意避开 feeMethod / typeIcon 等 hook 字段，降低打包撞名风险
  const feeMethodOptions = getFeeMethodOptions();
  const typeIconMap = getTypeIconMap();
  const {
    isEdit,
    loading,
    saving,
    loadError,
    notFound,
    pageTab,
    setPageTab,
    rechargeMode,
    handleRechargeModeChange,
    handleInstallmentToggle,
    // 学员
    selectedStudent,
    showStudentSheet,
    studentSheetVisible,
    studentSearch,
    filteredStudents,
    openStudentSheet,
    closeStudentSheet,
    handleSelectStudent,
    setStudentSearch,
    // 课包
    templates,
    selectedTemplate,
    isCustomPackage,
    showPackageSheet,
    packageSheetVisible,
    openPackageSheet,
    closePackageSheet,
    handleSelectTemplate,
    handleSelectCustom,
    handleConfirmCustom,
    // 自定义课包
    customName,
    customHours,
    customValidDays,
    customPrice,
    setCustomName,
    setCustomHours,
    setCustomValidDays,
    setCustomPrice,
    customSubjectId,
    setCustomSubjectId,
    // 科目列表
    subjects,
    // 课包信息
    totalHours,
    setTotalHours,
    validDays,
    setValidDays,
    // 赠送
    giftHours,
    handleGiftChange,
    setGiftHours,
    // 收费
    feeAmount,
    feeMethod,
    effectiveFeeAmount,
    setFeeAmount,
    setFeeMethod,
    // 分期
    installmentEnabled,
    installmentPeriod,
    installmentSchedule,
    setInstallmentPeriod,
    setInstallmentSchedule,
    // 备注
    note,
    setNote,
    // 编辑模式
    editRemainingHours,
    editExpiryDate,
    setEditRemainingHours,
    setEditExpiryDate,
    // 计算属性
    studentRemaining,
    studentActivePackages,
    studentLessonCount,
    totalWithGift,
    canSubmit,
    submitBlockedReason,
    submitSummary,
    // 保存
    handleSave,
  } = usePackageForm();

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: isEdit ? '编辑套餐' : '课时充值' });
  }, [isEdit]);

  useDidShow(() => {
    void Taro.setNavigationBarTitle({ title: isEdit ? '编辑套餐' : '课时充值' });
  });

  if (loading) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-[200rpx]">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-f5faf8 px-8 flex items-center justify-center">
          <Empty
            icon="mdi-alert-circle"
            description={loadError}
            actionText="返回上一页"
            onAction={() => Taro.navigateBack()}
          />
        </View>
      </PageContainer>
    );
  }

  if (notFound) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-f5faf8 px-8 flex items-center justify-center">
          <Empty
            icon="mdi-package-variant"
            description="未找到对应课包或学员信息"
            actionText="返回上一页"
            onAction={() => Taro.navigateBack()}
          />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen pb-[200rpx] bg-f5faf8">
        <View className="px-8 pt-4">
          {/* 1. 学生信息卡片 */}
          <View className="mb-6">
            {selectedStudent ? (
              <View
                className="rounded-[40rpx] p-[40rpx] relative overflow-hidden bg-class-primary"
                onClick={openStudentSheet}
              >
                <View className="absolute -top-[60rpx] -right-[60rpx] w-[200rpx] h-[200rpx] rounded-full bg-white/8" />
                <View className="absolute -bottom-[40rpx] right-[80rpx] w-[120rpx] h-[120rpx] rounded-full bg-white/6" />

                <View className="flex items-center gap-6 mb-7 relative z-1">
                  <View className="w-[96rpx] h-[96rpx] rounded-full bg-white flex items-center justify-center flex-shrink-0">
                    <Text className="text-[40rpx] font-bold text-primary">
                      {selectedStudent.name[0]}
                    </Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[36rpx] font-bold text-white block">
                      {selectedStudent.name}
                    </Text>
                    {selectedStudent.phone && (
                      <Text className="text-[24rpx] text-white/80 block mt-1">
                        {selectedStudent.phone}
                      </Text>
                    )}
                  </View>
                  <Text
                    className="text-[24rpx] text-white/90 underline flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation?.();
                      openStudentSheet();
                    }}
                  >
                    更换学员
                  </Text>
                </View>

                <View className="flex gap-12 relative z-1">
                  <View>
                    <Text className="text-[44rpx] font-extrabold text-white block">
                      {studentRemaining}
                    </Text>
                    <Text className="text-[22rpx] text-white/75 block mt-1">剩余课时</Text>
                  </View>
                  <View>
                    <Text className="text-[44rpx] font-extrabold text-white block">
                      {studentActivePackages}
                    </Text>
                    <Text className="text-[22rpx] text-white/75 block mt-1">进行中课包</Text>
                  </View>
                  <View>
                    <Text className="text-[44rpx] font-extrabold text-white block">
                      {studentLessonCount}
                    </Text>
                    <Text className="text-[22rpx] text-white/75 block mt-1">已消课次</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View
                className="rounded-[40rpx] p-[40rpx] relative overflow-hidden bg-class-primary"
                onClick={openStudentSheet}
              >
                <View className="absolute -top-[60rpx] -right-[60rpx] w-[200rpx] h-[200rpx] rounded-full bg-white/8" />
                <View className="flex items-center justify-center py-4 relative z-1">
                  <Text className="text-[28rpx] text-white/90">点击选择学员</Text>
                </View>
              </View>
            )}
          </View>

          {/* 主 Tab：课时充值 | 发会员卡（编辑套餐时不显示） */}
          {!isEdit ? (
            <View className="mb-6 bg-white rounded-[20rpx] shadow-sm overflow-hidden">
              <View className="flex">
                <View
                  className="flex-1 flex items-center justify-center py-[28rpx] relative"
                  onClick={() => setPageTab('recharge')}
                >
                  <Text
                    className={`text-[28rpx] font-medium ${pageTab === 'recharge' ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    课时充值
                  </Text>
                  {pageTab === 'recharge' ? (
                    <View className="absolute bottom-0 left-0 right-0 h-[4rpx] bg-primary" />
                  ) : null}
                </View>
                <View
                  className="flex-1 flex items-center justify-center py-[28rpx] relative"
                  onClick={() => setPageTab('card')}
                >
                  <Text
                    className={`text-[28rpx] font-medium ${pageTab === 'card' ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    发会员卡
                  </Text>
                  {pageTab === 'card' ? (
                    <View className="absolute bottom-0 left-0 right-0 h-[4rpx] bg-primary" />
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          {/* 发会员卡 Tab */}
          {!isEdit && pageTab === 'card' ? (
            selectedStudent ? (
              <MemberCardIssueForm
                student={selectedStudent}
                showSubmitBar={false}
                onSuccess={() => setTimeout(() => Taro.navigateBack(), 300)}
              />
            ) : (
              <View className="mb-6 bg-white rounded-[32rpx] p-[48rpx] shadow-soft flex flex-col items-center">
                <Text className="text-[28rpx] text-muted-foreground">请先选择学员</Text>
              </View>
            )
          ) : null}

          {/* 课时充值内容（用 View 替代 Fragment，避免 Taro 子节点索引错位） */}
          {isEdit || pageTab === 'recharge' ? (
            <View>
          {/* 充值方式：按课包 / 单独充值 */}
          {!isEdit ? (
            <View className="mb-6">
              <Text className="text-lg text-foreground font-medium mb-3 block">充值方式</Text>
              <SegmentedControl
                options={[
                  { label: '按课包', value: 'package' },
                  { label: '单独充值', value: 'direct' },
                ]}
                value={rechargeMode}
                onChange={(v) => handleRechargeModeChange(v as 'package' | 'direct')}
              />
              <Text className="text-[22rpx] text-muted-foreground mt-[12rpx] block">
                {rechargeMode === 'package'
                  ? '从课包模板选择，或自定义课包信息'
                  : '不选课包，直接填写充值课时数'}
              </Text>
            </View>
          ) : null}

          {/* 2. 课包选择（非编辑、按课包模式） */}
          {!isEdit && rechargeMode === 'package' && (
            <View className="mb-6">
              <View className="flex items-center gap-1 mb-3">
                <Text className="text-lg text-foreground font-medium">选择课包</Text>
                <Text className="text-lg text-destructive">*</Text>
              </View>

              {selectedTemplate ? (
                <View
                  className="flex items-center gap-6 p-[28rpx] rounded-[28rpx] border-[3rpx] border-primary bg-primary-5"
                  onClick={openPackageSheet}
                >
                  <View
                    className={cn(
                      'w-[96rpx] h-[96rpx] rounded-[24rpx] flex items-center justify-center flex-shrink-0',
                      typeIconMap[selectedTemplate.type]?.bgClass || 'bg-success-bg',
                    )}
                  >
                    <Text className="text-[48rpx]">
                      {typeIconMap[selectedTemplate.type]?.icon || '📚'}
                    </Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[30rpx] font-bold text-foreground block">
                      {selectedTemplate.name}
                    </Text>
                    {selectedTemplate.description && (
                      <Text className="text-[24rpx] text-muted-foreground block mt-1">
                        {selectedTemplate.description}
                      </Text>
                    )}
                    <View className="flex gap-2 mt-2">
                      <View className="py-1 px-3 rounded-sm bg-primary-15">
                        <Text className="text-[20rpx] text-primary font-medium">
                          {selectedTemplate.lesson_count}课时
                        </Text>
                      </View>
                      {selectedTemplate.valid_days ? (
                        <View className="py-1 px-3 rounded-sm bg-amber-15">
                          <Text className="text-[20rpx] text-amber font-medium">
                            {selectedTemplate.valid_days}天
                          </Text>
                        </View>
                      ) : (
                        <View className="py-1 px-3 rounded-sm bg-purple-15">
                          <Text className="text-[20rpx] text-purple font-medium">永久</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View className="flex flex-col items-end gap-2 flex-shrink-0">
                    {selectedTemplate.price > 0 && (
                      <Text className="text-[34rpx] font-extrabold text-primary">
                        ¥{selectedTemplate.price}
                      </Text>
                    )}
                    <Text className="text-[22rpx] text-primary font-medium">更改 ›</Text>
                  </View>
                </View>
              ) : isCustomPackage && totalHours > 0 ? (
                <View
                  className="flex items-center gap-6 p-[28rpx] rounded-[28rpx] border-[3rpx] border-primary bg-primary-5"
                  onClick={openPackageSheet}
                >
                  <View className="w-[96rpx] h-[96rpx] rounded-[24rpx] flex items-center justify-center flex-shrink-0 bg-muted">
                    <Text className="text-[44rpx]">✏️</Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[30rpx] font-bold text-foreground block">
                      {customName || '自定义课包'}
                    </Text>
                    <View className="flex gap-2 mt-2">
                      <View className="py-1 px-3 rounded-sm bg-primary-15">
                        <Text className="text-[20rpx] text-primary font-medium">
                          {totalHours}课时
                        </Text>
                      </View>
                      {validDays > 0 ? (
                        <View className="py-1 px-3 rounded-sm bg-amber-15">
                          <Text className="text-[20rpx] text-amber font-medium">{validDays}天</Text>
                        </View>
                      ) : (
                        <View className="py-1 px-3 rounded-sm bg-purple-15">
                          <Text className="text-[20rpx] text-purple font-medium">永久</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View className="flex flex-col items-end gap-2 flex-shrink-0">
                    {effectiveFeeAmount && parseFloat(effectiveFeeAmount) > 0 && (
                      <Text className="text-[34rpx] font-extrabold text-primary">
                        ¥{effectiveFeeAmount}
                      </Text>
                    )}
                    <Text className="text-[22rpx] text-primary font-medium">更改 ›</Text>
                  </View>
                </View>
              ) : (
                <View
                  className="flex items-center gap-6 p-[36rpx] rounded-[28rpx] border-[4rpx] border-dashed border-input bg-white/50"
                  onClick={openPackageSheet}
                >
                  <View className="w-[96rpx] h-[96rpx] rounded-[24rpx] flex items-center justify-center flex-shrink-0 bg-muted">
                    <Text className="text-[44rpx]">📦</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[28rpx] font-semibold text-foreground block">
                      选择课包
                    </Text>
                    <Text className="text-[24rpx] text-muted-foreground/60 block mt-1">
                      从模板选择或自定义课包
                    </Text>
                  </View>
                  <Text className="text-[40rpx] text-muted-foreground/40">›</Text>
                </View>
              )}
            </View>
          )}

          {/* 3. 课包信息 / 单独充值课时 */}
          {!isEdit &&
            ((rechargeMode === 'package' && isCustomPackage && !selectedTemplate) ||
              rechargeMode === 'direct') && (
            <View className="mb-6 bg-white rounded-[32rpx] p-[32rpx] shadow-soft">
              <View className="flex items-center gap-1 mb-4">
                <Text className="text-lg text-foreground font-medium">
                  {rechargeMode === 'direct' ? '充值课时' : '课包信息'}
                </Text>
                <Text className="text-lg text-destructive">*</Text>
              </View>

              <View className="mb-4">
                <Text className="text-md text-muted-foreground font-medium mb-2 block">
                  课时数量
                </Text>
                <Stepper value={totalHours} min={1} max={200} step={1} onChange={setTotalHours} />
                <View className="flex gap-3 mt-3">
                  {QUICK_HOURS.map((h) => (
                    <View
                      key={h}
                      className={`py-2 px-6 rounded-[32rpx] border-[3rpx] ${totalHours === h ? 'border-primary bg-primary text-white' : 'border-input bg-white text-muted-foreground'}`}
                      onClick={() => setTotalHours(h)}
                    >
                      <Text
                        className={`text-[24rpx] font-medium ${totalHours === h ? 'text-white' : 'text-muted-foreground'}`}
                      >
                        {h}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {rechargeMode === 'package' ? (
              <View>
                <Text className="text-md text-muted-foreground font-medium mb-2 block">
                  有效天数
                </Text>
                <View className="flex items-center gap-4">
                  <View className="flex-1 border-[3rpx] border-input rounded-[20rpx] py-[14rpx] px-[20rpx] bg-white">
                    <Input
                      className="w-full text-md text-foreground text-center"
                      type="number"
                      placeholder="0=永久有效"
                      value={validDays ? String(validDays) : ''}
                      onInput={(e) => setValidDays(parseInt(e.detail.value || '0') || 0)}
                    />
                  </View>
                  <Text className="text-[24rpx] text-muted-foreground">天</Text>
                </View>
              </View>
              ) : null}

              {/* 关联科目（仅自定义课包） */}
              {rechargeMode === 'package' && subjects.length > 0 && (
                <View className="mt-4">
                  <Text className="text-md text-muted-foreground font-medium mb-2 block">
                    关联科目
                  </Text>
                  <View className="flex flex-wrap gap-[16rpx]">
                    <View
                      className={`py-[12rpx] px-[28rpx] rounded-full border-[3rpx] ${!customSubjectId ? 'border-primary bg-primary text-white' : 'border-input bg-white text-muted-foreground'}`}
                      onClick={() => setCustomSubjectId('')}
                    >
                      <Text
                        className={`text-[24rpx] font-medium ${!customSubjectId ? 'text-white' : 'text-muted-foreground'}`}
                      >
                        通用
                      </Text>
                    </View>
                    {subjects.map((s) => (
                      <View
                        key={s.id}
                        className={`py-[12rpx] px-[28rpx] rounded-full border-[3rpx] ${customSubjectId === s.id ? 'border-primary bg-primary text-white' : 'border-input bg-white text-muted-foreground'}`}
                        onClick={() => setCustomSubjectId(s.id)}
                      >
                        <Text
                          className={`text-[24rpx] font-medium ${customSubjectId === s.id ? 'text-white' : 'text-muted-foreground'}`}
                        >
                          {s.icon} {s.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* 4. 赠送课时 */}
          {!isEdit && (selectedTemplate || isCustomPackage || rechargeMode === 'direct') && (
            <View className="mb-6 bg-white rounded-[32rpx] p-[32rpx] shadow-soft">
              <View className="flex items-center justify-between mb-4">
                <Text className="text-lg text-foreground font-medium">赠送课时</Text>
                <Text className="text-[22rpx] text-muted-foreground/60">选填</Text>
              </View>

              <View className="flex items-center gap-5">
                <Stepper value={giftHours} min={0} max={50} step={1} onChange={handleGiftChange} />
                <View className="flex gap-3">
                  {GIFT_OPTIONS.map((g) => (
                    <View
                      key={g}
                      className={`py-2 px-5 rounded-[32rpx] border-[3rpx] ${giftHours === g ? 'border-success bg-success text-white' : 'border-input bg-white'}`}
                      onClick={() => setGiftHours(g)}
                    >
                      <Text
                        className={`text-[24rpx] font-medium ${giftHours === g ? 'text-white' : 'text-muted-foreground'}`}
                      >
                        {g === 0 ? '0' : `+${g}`}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {giftHours > 0 && (
                <View className="mt-3 py-3 px-5 rounded-[16rpx] bg-success-5">
                  <Text className="text-[24rpx] text-success">
                    赠送 {giftHours} 课时，合计到账 {totalWithGift} 课时
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* 5. 收费信息 */}
          <View className="mb-6 bg-white rounded-[32rpx] p-[32rpx] shadow-soft">
            <View className="flex items-center justify-between mb-4">
              <Text className="text-lg text-foreground font-medium">收费信息</Text>
              <Text className="text-[22rpx] text-muted-foreground/60">选填，仅记录</Text>
            </View>

            <View className="flex items-center border-[3rpx] border-border rounded-[24rpx] bg-white overflow-hidden mb-4">
              <View className="py-5 px-6 flex items-center justify-center bg-muted/30">
                <Text className="text-lg font-semibold text-muted-foreground">¥</Text>
              </View>
              <Input
                className="flex-1 py-5 px-7 text-lg font-semibold text-foreground"
                type="digit"
                placeholder="0.00"
                value={feeAmount}
                onInput={(e) => setFeeAmount(e.detail.value || '')}
              />
            </View>

            <ChipPicker
              options={feeMethodOptions.map((f) => ({ label: f.label, value: f.key }))}
              value={feeMethod}
              onChange={(val) => setFeeMethod(val as typeof feeMethod)}
            />

            <View className="flex items-center justify-between pt-7 border-t border-input mt-6">
              <View className="flex-1">
                <Text className="text-md font-semibold text-foreground block">分期付款</Text>
                <Text className="text-[22rpx] text-muted-foreground/60 block mt-1">
                  记录分期还款计划
                </Text>
              </View>
              <View
                className={`w-[96rpx] h-[56rpx] rounded-full p-[6rpx] transition-all ${installmentEnabled ? 'bg-primary' : 'bg-border'}`}
                onClick={() => {
                  if (!installmentEnabled && !effectiveFeeAmount) {
                    Taro.showToast({ title: '请先填写金额', icon: 'none' });
                    return;
                  }
                  handleInstallmentToggle(!installmentEnabled);
                }}
              >
                <View
                  className={`w-[44rpx] h-[44rpx] rounded-full bg-white shadow-sm transition-transform ${installmentEnabled ? 'translate-x-[40rpx]' : 'translate-x-0'}`}
                />
              </View>
            </View>

            <InstallmentPanel
              totalAmount={effectiveFeeAmount || '0'}
              enabled={installmentEnabled}
              onToggle={handleInstallmentToggle}
              periodCount={installmentPeriod}
              onPeriodChange={setInstallmentPeriod}
              schedule={installmentSchedule}
              onScheduleChange={setInstallmentSchedule}
            />
          </View>

          {/* 6. 备注 */}
          <View className="mb-6 bg-white rounded-[32rpx] p-[32rpx] shadow-soft">
            <View className="flex items-center justify-between mb-4">
              <Text className="text-lg text-foreground font-medium">备注</Text>
              <Text className="text-[22rpx] text-muted-foreground/60">选填</Text>
            </View>
            <Textarea
              className="w-full p-5 rounded-[20rpx] border-[3rpx] border-input bg-white text-[26rpx] text-foreground min-h-[120rpx]"
              placeholder="输入备注信息"
              value={note}
              onInput={(e) => setNote(e.detail.value || '')}
            />
          </View>

          {/* 编辑模式额外字段 */}
          {isEdit ? (
            <View>
              <View className="mb-6 bg-white rounded-[32rpx] p-[32rpx] shadow-soft">
                <Text className="text-lg text-foreground font-medium block mb-3">剩余课时</Text>
                <View className="border-[3rpx] border-input rounded-[24rpx] py-[20rpx] px-[28rpx] bg-white">
                  <Input
                    className="w-full text-lg text-foreground"
                    type="number"
                    placeholder="剩余课时"
                    value={editRemainingHours}
                    onInput={(e) => setEditRemainingHours(e.detail.value || '')}
                  />
                </View>
              </View>
              <View className="mb-6 bg-white rounded-[32rpx] p-[32rpx] shadow-soft">
                <Text className="text-lg text-foreground font-medium block mb-3">过期日期</Text>
                <View className="border-[3rpx] border-input rounded-[24rpx] py-[20rpx] px-[28rpx] bg-white">
                  <Input
                    className="w-full text-lg text-foreground"
                    placeholder="YYYY-MM-DD"
                    value={editExpiryDate}
                    onInput={(e) => setEditExpiryDate(e.detail.value || '')}
                  />
                </View>
              </View>
            </View>
          ) : null}
            </View>
          ) : null}

        </View>

        {/* 底部按钮：仅课时充值 Tab / 编辑模式 */}
        {(isEdit || pageTab === 'recharge') ? (
        <View className="fixed bottom-0 left-0 right-0 px-8 py-6 bg-white/95 backdrop-blur-sm border-t-[2rpx] border-border pb-safe-bar z-50 pointer-events-auto shadow-card">
          {!canSubmit && submitBlockedReason ? (
            <View className="mb-3 px-4">
              <Text className="text-[24rpx] text-muted-foreground">{submitBlockedReason}</Text>
            </View>
          ) : null}
          <View
            className={`w-full py-[30rpx] rounded-[48rpx] flex items-center justify-center gap-2 transition pointer-events-auto ${canSubmit && !saving ? 'bg-gradient-primary' : 'bg-border'}`}
            style={
              canSubmit && !saving
                ? { background: 'linear-gradient(135deg, #5EC8A8, #4AB893)' }
                : {}
            }
            onClick={canSubmit && !saving ? handleSave : undefined}
          >
            <Text className="text-lg font-bold text-white">
              {saving ? '保存中...' : submitSummary}
            </Text>
          </View>
        </View>
        ) : null}

        {/* 学员选择浮窗 */}
        <StudentSelectSheet
          show={showStudentSheet}
          visible={studentSheetVisible}
          studentSearch={studentSearch}
          filteredStudents={filteredStudents}
          selectedStudent={selectedStudent}
          onSearchChange={setStudentSearch}
          onSelect={handleSelectStudent}
          onClose={closeStudentSheet}
        />

        {/* 课包选择浮窗 */}
        <PackageSelectSheet
          show={showPackageSheet}
          visible={packageSheetVisible}
          templates={templates}
          selectedTemplate={selectedTemplate}
          isCustomPackage={isCustomPackage}
          customName={customName}
          customHours={customHours}
          customValidDays={customValidDays}
          customPrice={customPrice}
          onSelectTemplate={handleSelectTemplate}
          onSelectCustom={handleSelectCustom}
          onConfirmCustom={handleConfirmCustom}
          onClose={closePackageSheet}
          onCustomNameChange={setCustomName}
          onCustomHoursChange={setCustomHours}
          onCustomValidDaysChange={setCustomValidDays}
          onCustomPriceChange={setCustomPrice}
        />
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(PackageForm);
