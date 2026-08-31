import { View, Text, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import Avatar from '@/components/Avatar';
import Card from '@/components/Card';
import ContactList from '@/components/ContactList';
import DatePickerSheet from '@/components/DatePickerSheet';
import Empty from '@/components/Empty';
import FormInput from '@/components/FormInput';
import FormRow from '@/components/FormRow';
import Icon from '@/components/Icon';
import InstallmentPanel from '@/components/InstallmentPanel';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import PickerSheet, { PickerOption } from '@/components/PickerSheet';
import SegmentedControl from '@/components/SegmentedControl';
import Switch from '@/components/Switch';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';
import { useStudentForm, FEE_METHOD_OPTIONS } from './useStudentForm';
import type { StudentType } from './useStudentForm';

type SelectorType = 'campus' | 'package' | 'feeMethod' | 'subject' | null;
type DatePickerTarget = { kind: 'birthday' } | { kind: 'expire'; packageId: string } | null;

const StudentForm: React.FC = () => {
  useCardNavigationBar();
  const form = useStudentForm();
  const [selector, setSelector] = useState<{
    visible: boolean;
    type: SelectorType;
    packageId?: string;
  }>({
    visible: false,
    type: null,
  });
  const [datePickerTarget, setDatePickerTarget] = useState<DatePickerTarget>(null);

  const {
    isEdit,
    name,
    setName,
    nickname,
    setNickname,
    gender,
    setGender,
    phone,
    setPhone,
    birthday,
    setBirthday,
    address,
    setAddress,
    note,
    setNote,
    avatarUrl,
    feeAmount,
    setFeeAmount,
    feeMethod,
    setFeeMethod,
    studentType,
    setStudentType,
    initHours,
    setInitHours,
    legacyPackages,
    addLegacyPackage,
    removeLegacyPackage,
    updateLegacyPackage,
    subjects,
    paymentEnabled,
    setPaymentEnabled,
    contacts,
    setContacts,
    installmentEnabled,
    setInstallmentEnabled,
    installmentPeriod,
    setInstallmentPeriod,
    schedule,
    setSchedule,
    feeMethodOther,
    setFeeMethodOther,
    packageTemplates,
    selectedPackageId,
    setSelectedPackageId,
    selectedPackage,
    campusId,
    setCampusId,
    campusOptions,
    errors,
    saving,
    canSubmit,
    submitBlockedReason,
    clearError,
    handleChooseAvatar,
    handleSave,
    handleReset,
    reload,
    loading,
    loadError,
    notFound,
  } = form;

  useDidShow(() => {
    void Taro.setNavigationBarTitle({ title: isEdit ? '编辑学员' : '添加学员' });
  });

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: isEdit ? '编辑学员' : '添加学员' });
  }, [isEdit]);

  const feeMethodLabel = useMemo(() => {
    if (feeMethod === 'other') return feeMethodOther.trim() || '其他';
    return FEE_METHOD_OPTIONS.find((item) => item.value === feeMethod)?.label || '请选择';
  }, [feeMethod, feeMethodOther]);

  const campusLabel = useMemo(
    () => campusOptions.find((item) => item.id === campusId)?.name || '请选择',
    [campusId, campusOptions],
  );

  const openSelector = (type: SelectorType, packageId?: string) =>
    setSelector({ visible: true, type, packageId });
  const closeSelector = () => setSelector((prev) => ({ ...prev, visible: false }));

  const datePickerValue = useMemo(() => {
    if (!datePickerTarget) return '';
    if (datePickerTarget.kind === 'birthday') return birthday || '2015-01-01';
    return (
      legacyPackages.find((p) => p.id === datePickerTarget.packageId)?.expireDate ||
      new Date().toISOString().slice(0, 10)
    );
  }, [birthday, datePickerTarget, legacyPackages]);

  const datePickerTitle = datePickerTarget?.kind === 'expire' ? '选择到期日期' : '选择出生日期';

  if (loading) {
    return (
      <PageContainer>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载学员表单中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError) {
    return (
      <PageContainer>
        <View className="min-h-screen px-[32rpx] flex items-center justify-center">
          <Empty
            icon="mdi-alert-circle"
            description={loadError}
            actionText="重新加载"
            onAction={() => void reload()}
          />
        </View>
      </PageContainer>
    );
  }

  if (notFound) {
    return (
      <PageContainer>
        <View className="min-h-screen px-[32rpx] flex items-center justify-center">
          <Empty
            icon="mdi-account-search"
            description="未找到对应学员信息"
            actionText="返回上一页"
            onAction={() => Taro.navigateBack()}
          />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen pb-[200rpx]">
        <View className="px-[32rpx] py-[24rpx] flex flex-col gap-[24rpx]">
          {/* 基础信息 */}
          <Card className="p-[32rpx]" marginBottom={false}>
            <FormRow label="头像" border onClick={handleChooseAvatar}>
              {avatarUrl ? (
                <Avatar name={name} avatarUrl={avatarUrl} size="sm" />
              ) : (
                <View className="w-[64rpx] h-[64rpx] rounded-full bg-background border-[2rpx] border-dashed border-border flex items-center justify-center">
                  <Text className="text-[28rpx] text-primary leading-none">+</Text>
                </View>
              )}
            </FormRow>

            <FormRow
              label="学员姓名"
              required
              editable
              placeholder="请输入学员姓名"
              value={name}
              onInput={(e) => {
                setName(e.detail.value || '');
                clearError('name');
              }}
              error={errors.name}
            />

            <FormRow
              label="昵称"
              editable
              placeholder="选填，如小名或英文名"
              value={nickname}
              onInput={(e) => setNickname(e.detail.value || '')}
            />

            <FormRow label="性别" border>
              <View className="flex flex-row gap-[16rpx]">
                {['男', '女'].map((g) => (
                  <View
                    key={g}
                    className={cn(
                      'px-[28rpx] py-[10rpx] rounded-[12rpx] border-[2rpx] border-solid press-scale',
                      gender === g ? 'border-primary bg-primary-5' : 'border-border bg-background',
                    )}
                    onClick={() => setGender(gender === g ? '' : g)}
                  >
                    <Text
                      className={cn(
                        'text-[28rpx]',
                        gender === g ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {g}
                    </Text>
                  </View>
                ))}
              </View>
            </FormRow>

            <FormRow
              label="出生日期"
              border
              error={errors.birthday}
              onClick={() => setDatePickerTarget({ kind: 'birthday' })}
            >
              <View className="flex flex-row items-center gap-[8rpx]">
                <Text
                  className={cn(
                    'text-[30rpx]',
                    birthday ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {birthday || '请选择'}
                </Text>
                <Icon name="mdi-calendar" size="sm" color="muted" />
              </View>
            </FormRow>

            <FormRow
              label="手机号"
              editable
              placeholder="11位手机号"
              value={phone}
              inputType="number"
              onInput={(e) => {
                setPhone(e.detail.value || '');
                clearError('phone');
              }}
              error={errors.phone}
              border={campusOptions.length > 0}
            />

            {campusOptions.length > 0 ? (
              <FormRow label="所属校区" border={false} onClick={() => openSelector('campus')}>
                <Text
                  className={cn(
                    'text-[30rpx]',
                    campusId ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {campusLabel}
                </Text>
              </FormRow>
            ) : null}
          </Card>

          {/* 联系信息 */}
          <Card className="p-[32rpx]" marginBottom={false}>
            <FormRow
              label="家庭地址"
              editable
              placeholder="选填"
              value={address}
              onInput={(e) => setAddress(e.detail.value || '')}
            />

            <View className="pt-[8rpx] pb-[8rpx]">
              <Text className="block text-[30rpx] text-foreground mb-[16rpx]">联系方式</Text>
              <ContactList contacts={contacts} onChange={setContacts} maxCount={5} />
            </View>
          </Card>

          {/* 课时设置（仅新建） */}
          {!isEdit ? (
            <Card className="p-[32rpx]" marginBottom={false}>
              <View className="pb-[16rpx]">
                <Text className="block text-[30rpx] text-foreground mb-[16rpx]">学员类型</Text>
                <SegmentedControl
                  options={[
                    { label: '新生', value: 'new' },
                    { label: '老生', value: 'old' },
                  ]}
                  value={studentType}
                  onChange={(v) => {
                    setStudentType(v as StudentType);
                    setSelectedPackageId('');
                    clearError('legacyPackages');
                  }}
                />
                <Text className="block text-[22rpx] text-muted-foreground mt-[12rpx]">
                  {studentType === 'new'
                    ? '新生从零开始记录课时，可选课包自动填充'
                    : '老生只登记剩余课时，可按科目添加多个课包便于迁移'}
                </Text>
              </View>

              {studentType === 'new' ? (
                <>
                  {packageTemplates.length > 0 ? (
                    <FormRow
                      label="选择课包"
                      helperText="选填，自动填充课时和金额"
                      onClick={() => openSelector('package')}
                    >
                      <View className="min-w-0 flex-1">
                        <Text
                          className={cn(
                            'block text-[30rpx] text-right truncate',
                            selectedPackage ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {selectedPackage ? selectedPackage.name : '请选择'}
                        </Text>
                        {selectedPackage ? (
                          <Text className="block text-[22rpx] text-muted-foreground text-right mt-[4rpx]">
                            {selectedPackage.lesson_count}课时 / ¥{selectedPackage.price}
                          </Text>
                        ) : null}
                      </View>
                    </FormRow>
                  ) : null}

                  <FormRow
                    label="初始课时"
                    required
                    editable
                    placeholder="例如：20"
                    value={initHours}
                    inputType="number"
                    onInput={(e) => {
                      setInitHours(e.detail.value || '');
                      setSelectedPackageId('');
                      clearError('initHours');
                    }}
                    error={errors.initHours}
                    border={false}
                  />
                </>
              ) : (
                <View>
                  <Text className="mb-[20rpx] block text-[28rpx] font-medium text-foreground">
                    历史课包
                  </Text>

                  {legacyPackages.length > 0 ? (
                    <>
                      {legacyPackages.map((pkg, index) => (
                        <View
                          key={pkg.id}
                          className={cn(
                            'overflow-hidden rounded-[16rpx] bg-muted/70',
                            index < legacyPackages.length - 1 && 'mb-[16rpx]',
                          )}
                        >
                          <View
                            className="flex items-center justify-between border-b border-border/50 px-[24rpx] py-[22rpx]"
                            onClick={() => openSelector('subject', pkg.id)}
                          >
                            <View className="flex items-center gap-[12rpx]">
                              <Icon
                                name="mdi-book-open-variant"
                                size={28}
                                color="mutedForeground"
                              />
                              <Text className="text-[28rpx] text-foreground">科目</Text>
                            </View>
                            <View className="flex items-center gap-[12rpx]">
                              <View className="rounded-[12rpx] bg-card px-[20rpx] py-[12rpx]">
                                <Text
                                  className={cn(
                                    'text-[26rpx]',
                                    pkg.subjectName ? 'text-foreground' : 'text-muted-foreground',
                                  )}
                                >
                                  {pkg.subjectName || '请选择'}
                                </Text>
                              </View>
                              {legacyPackages.length > 1 ? (
                                <View
                                  className="flex h-[44rpx] w-[44rpx] items-center justify-center rounded-full bg-error/10"
                                  onClick={(e) => {
                                    e.stopPropagation?.();
                                    removeLegacyPackage(pkg.id);
                                  }}
                                >
                                  <Icon name="mdi-close" size={20} color="error" />
                                </View>
                              ) : null}
                            </View>
                          </View>

                          <View className="flex items-center justify-between border-b border-border/50 px-[24rpx] py-[22rpx]">
                            <View className="flex items-center gap-[12rpx]">
                              <Icon name="mdi-clock-outline" size={28} color="mutedForeground" />
                              <Text className="text-[28rpx] text-foreground">剩余课时</Text>
                            </View>
                            <View className="rounded-[12rpx] bg-card px-[20rpx] py-[8rpx] min-w-[160rpx]">
                              <Input
                                className="text-[26rpx] text-foreground text-right"
                                type="number"
                                placeholder="填写课时"
                                placeholderClass="input-placeholder"
                                value={pkg.remainingHours}
                                onInput={(e) => {
                                  updateLegacyPackage(pkg.id, {
                                    remainingHours: e.detail.value || '',
                                  });
                                  clearError('legacyPackages');
                                }}
                              />
                            </View>
                          </View>

                          <View className="flex items-center justify-between px-[24rpx] py-[22rpx]">
                            <View className="flex items-center gap-[12rpx]">
                              <Icon name="mdi-calendar-clock" size={28} color="mutedForeground" />
                              <Text className="text-[28rpx] text-foreground">设置有效期</Text>
                            </View>
                            <Switch
                              checked={pkg.expireEnabled}
                              onChange={(on) =>
                                updateLegacyPackage(pkg.id, {
                                  expireEnabled: on,
                                  expireDate: on ? pkg.expireDate : '',
                                })
                              }
                            />
                          </View>

                          {pkg.expireEnabled ? (
                            <View
                              className="flex items-center justify-between border-t border-border/50 px-[24rpx] py-[22rpx]"
                              onClick={() =>
                                setDatePickerTarget({ kind: 'expire', packageId: pkg.id })
                              }
                            >
                              <View className="flex items-center gap-[12rpx]">
                                <Icon name="mdi-calendar" size={28} color="mutedForeground" />
                                <Text className="text-[28rpx] text-foreground">到期日期</Text>
                              </View>
                              <View className="rounded-[12rpx] bg-card px-[20rpx] py-[12rpx]">
                                <Text
                                  className={cn(
                                    'text-[26rpx]',
                                    pkg.expireDate ? 'text-foreground' : 'text-muted-foreground',
                                  )}
                                >
                                  {pkg.expireDate || '请选择'}
                                </Text>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      ))}

                      <Text className="mt-[16rpx] block text-[22rpx] text-muted-foreground">
                        点击科目或填写剩余课时；开启有效期后可设置到期日。
                      </Text>
                      {errors.legacyPackages ? (
                        <Text className="mt-[8rpx] block text-[22rpx] text-destructive">
                          {errors.legacyPackages}
                        </Text>
                      ) : null}

                      <View
                        className="mt-[16rpx] flex items-center justify-center gap-[8rpx] py-[8rpx]"
                        onClick={addLegacyPackage}
                      >
                        <Icon name="mdi-plus" size={28} color="primary" />
                        <Text className="text-[26rpx] text-primary">添加课包</Text>
                      </View>
                    </>
                  ) : (
                    <View
                      className="flex min-h-[260rpx] flex-col items-center justify-center rounded-[16rpx] border-[2rpx] border-dashed border-border bg-muted/60"
                      onClick={addLegacyPackage}
                    >
                      <View className="flex h-[88rpx] w-[88rpx] items-center justify-center rounded-full bg-primary shadow-md">
                        <Icon name="mdi-plus" size={40} color="#ffffff" />
                      </View>
                      <Text className="mt-[20rpx] text-[26rpx] text-muted-foreground">
                        添加课包
                      </Text>
                      {errors.legacyPackages ? (
                        <Text className="mt-[12rpx] text-[22rpx] text-destructive">
                          {errors.legacyPackages}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </View>
              )}
            </Card>
          ) : null}

          {/* 可选：缴费信息 */}
          <Card className="p-[32rpx]" marginBottom={false}>
            <FormRow
              label="缴费信息"
              border={paymentEnabled}
              helperText="选填，开启后填写金额与支付方式"
            >
              <Switch
                checked={paymentEnabled}
                onChange={(on) => {
                  setPaymentEnabled(on);
                  if (!on) {
                    setFeeAmount('');
                    setFeeMethod('');
                    setFeeMethodOther('');
                    setInstallmentEnabled(false);
                    setSchedule([]);
                  }
                }}
              />
            </FormRow>

            {paymentEnabled ? (
              <>
                <FormRow
                  label="缴费金额"
                  editable
                  placeholder="0.00"
                  value={feeAmount}
                  inputType="digit"
                  suffix="元"
                  onInput={(e) => {
                    const raw = e.detail.value || '';
                    const filtered = raw
                      .replace(/[^\d.]/g, '')
                      .replace(/^(\d*\.)(.*)$/, (_m, a, b) => a + b.replace(/\./g, ''));
                    setFeeAmount(filtered);
                  }}
                />

                <FormRow label="支付方式" onClick={() => openSelector('feeMethod')}>
                  <Text
                    className={cn(
                      'text-[30rpx]',
                      feeMethod ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {feeMethodLabel}
                  </Text>
                </FormRow>

                {feeMethod === 'other' ? (
                  <FormRow
                    label="具体方式"
                    editable
                    placeholder="请填写具体支付方式"
                    value={feeMethodOther}
                    onInput={(e) => setFeeMethodOther(e.detail.value || '')}
                  />
                ) : null}

                <FormRow
                  label="分期付款"
                  border={false}
                  helperText={
                    !feeAmount || parseFloat(feeAmount) <= 0
                      ? '请先填写缴费金额'
                      : '金额较大时可选择分期支付'
                  }
                >
                  <Switch
                    checked={installmentEnabled}
                    disabled={!feeAmount || parseFloat(feeAmount) <= 0}
                    onChange={(on) => {
                      if (!feeAmount || parseFloat(feeAmount) <= 0) {
                        Taro.showToast({ title: '请先填写缴费金额', icon: 'none' });
                        return;
                      }
                      setInstallmentEnabled(on);
                    }}
                  />
                </FormRow>

                {installmentEnabled ? (
                  <View className="pt-[8rpx]">
                    <InstallmentPanel
                      totalAmount={feeAmount}
                      enabled={installmentEnabled}
                      onToggle={setInstallmentEnabled}
                      periodCount={installmentPeriod}
                      onPeriodChange={setInstallmentPeriod}
                      schedule={schedule}
                      onScheduleChange={setSchedule}
                    />
                  </View>
                ) : null}
              </>
            ) : null}
          </Card>

          {/* 备注 */}
          <Card className="p-[32rpx]" marginBottom={false}>
            <Text className="block text-[30rpx] text-foreground mb-[12rpx]">备注</Text>
            <FormInput
              variant="ghost"
              multiline
              placeholder="过敏史、接送要求等（选填）"
              value={note}
              onInput={(e) => setNote(e.detail.value || '')}
              maxlength={200}
              minHeight="120rpx"
              className="w-full bg-background rounded-[16rpx] px-[20rpx] py-[16rpx]"
            />
          </Card>
        </View>

        <View className="fixed left-[32rpx] right-[32rpx] bottom-[calc(32rpx+env(safe-area-inset-bottom))] flex flex-col gap-[16rpx]">
          {!canSubmit && submitBlockedReason ? (
            <Text className="text-[22rpx] text-muted-foreground text-center">
              {submitBlockedReason}
            </Text>
          ) : null}
          <View className="flex flex-row gap-[20rpx]">
            {!isEdit ? (
              <View
                className="flex-1 py-[26rpx] rounded-full bg-card border-[2rpx] border-border flex items-center justify-center press-scale"
                onClick={handleReset}
              >
                <Text className="text-[30rpx] font-semibold text-foreground">重置</Text>
              </View>
            ) : null}
            <View
              className={cn(
                'flex-1 py-[26rpx] rounded-full bg-primary flex items-center justify-center press-scale shadow-float',
                (!canSubmit || saving) && 'opacity-60 pointer-events-none',
              )}
              onClick={canSubmit && !saving ? () => void handleSave() : undefined}
            >
              <Text className="text-[30rpx] font-semibold text-white">
                {saving ? (isEdit ? '更新中...' : '保存中...') : isEdit ? '保存' : '确认新增'}
              </Text>
            </View>
          </View>
        </View>

        <PickerSheet
          visible={selector.visible}
          title={
            selector.type === 'campus'
              ? '选择校区'
              : selector.type === 'package'
                ? '选择课包'
                : selector.type === 'subject'
                  ? '选择科目'
                  : '选择支付方式'
          }
          options={
            selector.type === 'campus'
              ? campusOptions.map((c): PickerOption => ({ label: c.name, value: c.id }))
              : selector.type === 'package'
                ? [
                    { label: '不选择课包', value: '' },
                    ...packageTemplates.map(
                      (tpl): PickerOption => ({
                        label: `${tpl.name}（${tpl.lesson_count}课时 / ¥${tpl.price}）`,
                        value: tpl.id,
                      }),
                    ),
                  ]
                : selector.type === 'subject'
                  ? subjects.map((s): PickerOption => ({ label: s.name, value: s.id }))
                  : FEE_METHOD_OPTIONS.map(
                      (item): PickerOption => ({ label: item.label, value: item.value }),
                    )
          }
          value={
            selector.type === 'campus'
              ? campusId
              : selector.type === 'package'
                ? selectedPackageId
                : selector.type === 'subject'
                  ? legacyPackages.find((p) => p.id === selector.packageId)?.subjectId || ''
                  : feeMethod
          }
          onClose={closeSelector}
          onConfirm={(v) => {
            if (selector.type === 'campus') {
              setCampusId(v);
            } else if (selector.type === 'package') {
              if (!v) {
                setSelectedPackageId('');
              } else {
                const tpl = packageTemplates.find((item) => item.id === v);
                setSelectedPackageId(v);
                if (tpl) {
                  setInitHours(String(tpl.lesson_count));
                  if (!paymentEnabled) setPaymentEnabled(true);
                  setFeeAmount(String(tpl.price));
                }
              }
            } else if (selector.type === 'subject' && selector.packageId) {
              const subject = subjects.find((s) => s.id === v);
              updateLegacyPackage(selector.packageId, {
                subjectId: v,
                subjectName: subject?.name || '',
              });
              clearError('legacyPackages');
            } else if (selector.type === 'feeMethod') {
              setFeeMethod(v);
              if (v !== 'other') setFeeMethodOther('');
            }
            closeSelector();
          }}
        />

        <DatePickerSheet
          visible={Boolean(datePickerTarget)}
          title={datePickerTitle}
          value={datePickerValue}
          onClose={() => setDatePickerTarget(null)}
          onConfirm={(date) => {
            if (!datePickerTarget) return;
            if (datePickerTarget.kind === 'birthday') {
              setBirthday(date);
              clearError('birthday');
            } else {
              updateLegacyPackage(datePickerTarget.packageId, { expireDate: date });
              clearError('legacyPackages');
            }
            setDatePickerTarget(null);
          }}
        />
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(StudentForm);
