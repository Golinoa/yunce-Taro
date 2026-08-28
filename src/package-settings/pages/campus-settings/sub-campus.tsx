/**
 * 分校区管理页 pages/campus-settings/sub-campus
 *
 * 按类型分组展示校区卡片，支持添加/编辑/删除/设为主校区
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useState, useCallback, useMemo } from 'react';
import BottomSheet from '@/components/BottomSheet';
import CampusCard from '@/components/campus/CampusCard';
import Empty from '@/components/Empty';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { CAMPUS_ICONS, CAMPUS_TYPE_MAP } from '@/constants/campus-ui';
import { useCampusStore } from '@/stores/campus';
import type { CampusFormData, CampusType, PartnerMode } from '@/types/campus';

/** 校区表单状态 */
interface CampusFormState {
  name: string;
  type: CampusType;
  partnerMode: PartnerMode;
  phone: string;
  address: string;
  iconIndex: number;
  monthlyRent: string;
  rentDueDay: string;
}

const DEFAULT_FORM: CampusFormState = {
  name: '',
  type: 'self',
  partnerMode: 'hourly_share',
  phone: '',
  address: '',
  iconIndex: 0,
  monthlyRent: '',
  rentDueDay: '',
};

const SubCampus: React.FC = () => {
  const { campuses, fetchCampuses, addCampus, updateCampus, deleteCampus, setMainCampus } =
    useCampusStore();

  // 弹窗状态
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSetMainConfirm, setShowSetMainConfirm] = useState(false);

  // 表单状态
  const [form, setForm] = useState<CampusFormState>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [settingMainId, setSettingMainId] = useState('');
  const [settingMainName, setSettingMainName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settingMain, setSettingMain] = useState(false);

  // 页面显示时刷新数据
  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    await fetchCampuses();
    const nextError = useCampusStore.getState().error;
    if (nextError) {
      setLoadError(nextError);
    }
    setLoading(false);
  }, [fetchCampuses]);

  Taro.useDidShow(() => {
    void reload();
  });

  // 按类型分组
  const selfCampuses = useMemo(() => campuses.filter((c) => c.type === 'self'), [campuses]);
  const partnerCampuses = useMemo(() => campuses.filter((c) => c.type === 'partner'), [campuses]);

  const submitBlockedReason = useMemo(() => {
    if (!form.name.trim()) return '请输入校区名称';
    if (form.name.trim().length > 30) return '校区名称最多 30 个字';
    if (form.phone.trim() && !/^1[3-9]\d{9}$/.test(form.phone.trim()))
      return '请输入正确的联系电话';
    if (form.type === 'partner' && !form.partnerMode) return '请选择合作模式';
    if (form.monthlyRent.trim()) {
      const rent = Number(form.monthlyRent);
      if (Number.isNaN(rent) || rent < 0) return '月租金额不能小于 0';
    }
    if (form.rentDueDay.trim()) {
      const dueDay = Number(form.rentDueDay);
      if (Number.isNaN(dueDay) || dueDay < 1 || dueDay > 28) return '到期日需在 1-28 之间';
    }
    return '';
  }, [form]);

  const canSubmit = useMemo(() => !submitBlockedReason && !saving, [saving, submitBlockedReason]);

  // ============================================
  // 添加校区
  // ============================================
  const handleOpenAdd = useCallback(() => {
    setForm(DEFAULT_FORM);
    setShowAddSheet(true);
  }, []);

  const handleAddSubmit = useCallback(async () => {
    if (saving) return;
    if (submitBlockedReason) {
      Taro.showToast({ title: submitBlockedReason, icon: 'none' });
      return;
    }
    const iconItem = CAMPUS_ICONS[form.iconIndex] || CAMPUS_ICONS[0];
    const data: CampusFormData = {
      name: form.name.trim(),
      type: form.type,
      partnerMode: form.type === 'partner' ? form.partnerMode : undefined,
      phone: form.phone.trim(),
      address: form.address.trim(),
      icon: iconItem.icon,
      iconGradient: iconItem.gradient,
      monthlyRent: form.monthlyRent ? Number(form.monthlyRent) : 0,
      rentDueDay: form.rentDueDay ? Number(form.rentDueDay) : 1,
    };
    setSaving(true);
    try {
      const result = await addCampus(data);
      if (!result) {
        Taro.showToast({ title: useCampusStore.getState().error || '添加校区失败', icon: 'none' });
        return;
      }
      setShowAddSheet(false);
      Taro.showToast({ title: '添加成功', icon: 'success' });
    } finally {
      setSaving(false);
    }
  }, [form, addCampus, saving, submitBlockedReason]);

  // ============================================
  // 编辑校区
  // ============================================
  const handleOpenEdit = useCallback(
    (id: string) => {
      const campus = campuses.find((c) => c.id === id);
      if (!campus) return;
      const iconIdx = CAMPUS_ICONS.findIndex((ci) => ci.icon === campus.icon);
      setForm({
        name: campus.name,
        type: campus.type,
        partnerMode: campus.partnerMode || 'hourly_share',
        phone: campus.phone,
        address: campus.address,
        iconIndex: iconIdx >= 0 ? iconIdx : 0,
        monthlyRent: campus.monthlyRent ? String(campus.monthlyRent) : '',
        rentDueDay: campus.rentDueDay ? String(campus.rentDueDay) : '',
      });
      setEditingId(id);
      setShowEditSheet(true);
    },
    [campuses],
  );

  const handleEditSubmit = useCallback(async () => {
    if (saving) return;
    if (submitBlockedReason) {
      Taro.showToast({ title: submitBlockedReason, icon: 'none' });
      return;
    }
    const iconItem = CAMPUS_ICONS[form.iconIndex] || CAMPUS_ICONS[0];
    const data: Partial<CampusFormData> = {
      name: form.name.trim(),
      type: form.type,
      partnerMode: form.type === 'partner' ? form.partnerMode : undefined,
      phone: form.phone.trim(),
      address: form.address.trim(),
      icon: iconItem.icon,
      iconGradient: iconItem.gradient,
      monthlyRent: form.monthlyRent ? Number(form.monthlyRent) : 0,
      rentDueDay: form.rentDueDay ? Number(form.rentDueDay) : 1,
    };
    setSaving(true);
    try {
      const success = await updateCampus(editingId, data);
      if (!success) {
        Taro.showToast({ title: useCampusStore.getState().error || '更新校区失败', icon: 'none' });
        return;
      }
      setShowEditSheet(false);
      Taro.showToast({ title: '保存成功', icon: 'success' });
    } finally {
      setSaving(false);
    }
  }, [form, editingId, updateCampus, saving, submitBlockedReason]);

  // ============================================
  // 删除校区
  // ============================================
  const handleDelete = useCallback((id: string) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const success = await deleteCampus(deletingId);
      if (success) {
        setShowDeleteConfirm(false);
        Taro.showToast({ title: '删除成功', icon: 'success' });
      } else {
        Taro.showToast({
          title: useCampusStore.getState().error || '主校区不可删除',
          icon: 'none',
        });
      }
    } finally {
      setDeleting(false);
    }
  }, [deletingId, deleteCampus, deleting]);

  // ============================================
  // 设为主校区
  // ============================================
  const handleSetMain = useCallback(
    (id: string) => {
      const campus = campuses.find((c) => c.id === id);
      if (!campus) return;
      setSettingMainId(id);
      setSettingMainName(campus.name);
      setShowSetMainConfirm(true);
    },
    [campuses],
  );

  const handleConfirmSetMain = useCallback(async () => {
    if (settingMain) return;
    setSettingMain(true);
    try {
      const success = await setMainCampus(settingMainId);
      if (!success) {
        Taro.showToast({
          title: useCampusStore.getState().error || '设置主校区失败',
          icon: 'none',
        });
        return;
      }
      setShowSetMainConfirm(false);
      Taro.showToast({ title: '设置成功', icon: 'success' });
    } finally {
      setSettingMain(false);
    }
  }, [settingMainId, setMainCampus, settingMain]);

  // ============================================
  // 运营数据
  // ============================================
  const handleDataClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/package-settings/pages/campus-settings/campus-data/index?id=${id}` });
  }, []);

  // ============================================
  // 表单更新
  // ============================================
  const updateForm = useCallback((field: keyof CampusFormState, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  if (loading && !campuses.length) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载校区中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError && !campuses.length) {
    return (
      <PageContainer safeBottom>
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

  return (
    <PageContainer safeBottom>
      {/* 添加按钮 — 右上角固定 */}
      <View className="px-[32rpx] pt-[24rpx] flex flex-row justify-end">
        <View
          className="flex flex-row items-center bg-primary/10 px-[28rpx] py-[14rpx] rounded-full gap-[6rpx]"
          onClick={handleOpenAdd}
        >
          <Icon name="mdi-plus" size={28} color="primary" />
          <Text className="text-[26rpx] text-primary font-semibold">添加校区</Text>
        </View>
      </View>

      {/* 自营校区 */}
      {selfCampuses.length > 0 && (
        <View className="px-4 mt-2">
          <Text className="text-sm text-muted-foreground font-medium mb-3">自营校区</Text>
          {selfCampuses.map((campus) => (
            <CampusCard
              key={campus.id}
              campus={campus}
              onSetMain={handleSetMain}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
              onDataClick={handleDataClick}
            />
          ))}
        </View>
      )}

      {/* 合作机构 */}
      {partnerCampuses.length > 0 && (
        <View className="px-4 mt-4">
          <Text className="text-sm text-muted-foreground font-medium mb-3">合作机构</Text>
          {partnerCampuses.map((campus) => (
            <CampusCard
              key={campus.id}
              campus={campus}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
              onDataClick={handleDataClick}
            />
          ))}
        </View>
      )}

      {/* 空状态 */}
      {campuses.length === 0 && (
        <View className="px-[32rpx] pt-[180rpx]">
          <Empty
            icon="mdi-office-building-outline"
            description="暂无校区，点击右上角添加"
            actionText="添加校区"
            onAction={handleOpenAdd}
          />
        </View>
      )}

      {/* ============================================ */}
      {/* 添加校区弹窗 */}
      {/* ============================================ */}
      <BottomSheet
        visible={showAddSheet}
        title="添加校区"
        onClose={() => {
          if (saving) return;
          setShowAddSheet(false);
        }}
      >
        <View className="px-4 py-4">
          <FormInput
            label="校区名称"
            required
            placeholder="请输入校区名称"
            value={form.name}
            onInput={(e) => updateForm('name', e.detail.value)}
          />

          {/* 校区类型选择 */}
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground font-medium mb-2">校区类型</Text>
            <View className="flex flex-row gap-3">
              {(['self', 'partner'] as CampusType[]).map((t) => {
                const info = CAMPUS_TYPE_MAP[t];
                return (
                  <View
                    key={t}
                    className={cn(
                      'flex-1 py-3 rounded-2xl border-[3rpx] flex items-center justify-center',
                      form.type === t ? 'border-primary bg-primary/5' : 'border-d5e8e0',
                    )}
                    onClick={() => updateForm('type', t)}
                  >
                    <Text
                      className={cn(
                        'text-sm font-medium text-center',
                        form.type === t ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {info.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* 合作模式（仅合作校区） */}
          {form.type === 'partner' && (
            <View className="mb-4">
              <Text className="text-sm text-muted-foreground font-medium mb-2">合作模式</Text>
              <View className="flex flex-row gap-3">
                {[
                  { value: 'hourly_share' as PartnerMode, label: '课时分成' },
                  { value: 'venue_rental' as PartnerMode, label: '场地租赁' },
                ].map((opt) => (
                  <View
                    key={opt.value}
                    className={cn(
                      'flex-1 py-3 rounded-2xl border-[3rpx] flex items-center justify-center',
                      form.partnerMode === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-d5e8e0',
                    )}
                    onClick={() => updateForm('partnerMode', opt.value)}
                  >
                    <Text
                      className={cn(
                        'text-sm font-medium text-center',
                        form.partnerMode === opt.value ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {opt.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 图标选择 */}
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground font-medium mb-2">校区图标</Text>
            <View className="flex flex-row flex-wrap gap-3">
              {CAMPUS_ICONS.map((item, idx) => (
                <View
                  key={idx}
                  className={cn(
                    'w-[72rpx] h-[72rpx] rounded-[20rpx] flex items-center justify-center border-[3rpx]',
                    form.iconIndex === idx ? 'border-primary' : 'border-transparent',
                  )}
                  style={{ background: item.gradient }}
                  onClick={() => updateForm('iconIndex', idx)}
                >
                  <Text className="text-[32rpx]">{item.icon}</Text>
                </View>
              ))}
            </View>
          </View>

          <FormInput
            label="联系电话"
            placeholder="请输入联系电话"
            type="number"
            value={form.phone}
            onInput={(e) => updateForm('phone', e.detail.value)}
          />

          <FormInput
            label="校区地址"
            placeholder="请输入校区地址"
            value={form.address}
            onInput={(e) => updateForm('address', e.detail.value)}
          />

          {/* 场地租金配置 */}
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground font-medium mb-2">场地租金</Text>
            <View className="flex flex-row gap-3">
              <View className="flex-1">
                <FormInput
                  label=""
                  placeholder="月租金额（元）"
                  type="digit"
                  value={form.monthlyRent}
                  onInput={(e) => updateForm('monthlyRent', e.detail.value)}
                />
              </View>
              <View className="flex-1">
                <FormInput
                  label=""
                  placeholder="到期日（1-28号）"
                  type="number"
                  value={form.rentDueDay}
                  onInput={(e) => updateForm('rentDueDay', e.detail.value)}
                />
              </View>
            </View>
            <Text className="text-xs text-muted-foreground mt-1">
              每月租金到期日将自动触发财务预警
            </Text>
          </View>

          {!canSubmit && submitBlockedReason ? (
            <View className="mb-3">
              <Text className="text-sm text-muted-foreground">{submitBlockedReason}</Text>
            </View>
          ) : null}
          {/* 提交按钮 */}
          <View
            className={cn(
              'rounded-2xl py-4 flex items-center justify-center mt-4',
              canSubmit ? 'bg-primary' : 'bg-muted',
            )}
            onClick={canSubmit ? () => void handleAddSubmit() : undefined}
          >
            <Text
              className={cn(
                'text-base font-semibold',
                canSubmit ? 'text-white' : 'text-muted-foreground',
              )}
            >
              {saving ? '保存中...' : '确认添加'}
            </Text>
          </View>
        </View>
      </BottomSheet>

      {/* ============================================ */}
      {/* 编辑校区弹窗 */}
      {/* ============================================ */}
      <BottomSheet
        visible={showEditSheet}
        title="编辑校区"
        onClose={() => {
          if (saving) return;
          setShowEditSheet(false);
        }}
      >
        <View className="px-4 py-4">
          <FormInput
            label="校区名称"
            required
            placeholder="请输入校区名称"
            value={form.name}
            onInput={(e) => updateForm('name', e.detail.value)}
          />

          {/* 校区类型选择 */}
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground font-medium mb-2">校区类型</Text>
            <View className="flex flex-row gap-3">
              {(['self', 'partner'] as CampusType[]).map((t) => {
                const info = CAMPUS_TYPE_MAP[t];
                return (
                  <View
                    key={t}
                    className={cn(
                      'flex-1 py-3 rounded-2xl border-[3rpx] flex items-center justify-center',
                      form.type === t ? 'border-primary bg-primary/5' : 'border-d5e8e0',
                    )}
                    onClick={() => updateForm('type', t)}
                  >
                    <Text
                      className={cn(
                        'text-sm font-medium text-center',
                        form.type === t ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {info.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* 合作模式 */}
          {form.type === 'partner' && (
            <View className="mb-4">
              <Text className="text-sm text-muted-foreground font-medium mb-2">合作模式</Text>
              <View className="flex flex-row gap-3">
                {[
                  { value: 'hourly_share' as PartnerMode, label: '课时分成' },
                  { value: 'venue_rental' as PartnerMode, label: '场地租赁' },
                ].map((opt) => (
                  <View
                    key={opt.value}
                    className={cn(
                      'flex-1 py-3 rounded-2xl border-[3rpx] flex items-center justify-center',
                      form.partnerMode === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-d5e8e0',
                    )}
                    onClick={() => updateForm('partnerMode', opt.value)}
                  >
                    <Text
                      className={cn(
                        'text-sm font-medium text-center',
                        form.partnerMode === opt.value ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {opt.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 图标选择 */}
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground font-medium mb-2">校区图标</Text>
            <View className="flex flex-row flex-wrap gap-3">
              {CAMPUS_ICONS.map((item, idx) => (
                <View
                  key={idx}
                  className={cn(
                    'w-[72rpx] h-[72rpx] rounded-[20rpx] flex items-center justify-center border-[3rpx]',
                    form.iconIndex === idx ? 'border-primary' : 'border-transparent',
                  )}
                  style={{ background: item.gradient }}
                  onClick={() => updateForm('iconIndex', idx)}
                >
                  <Text className="text-[32rpx]">{item.icon}</Text>
                </View>
              ))}
            </View>
          </View>

          <FormInput
            label="联系电话"
            placeholder="请输入联系电话"
            type="number"
            value={form.phone}
            onInput={(e) => updateForm('phone', e.detail.value)}
          />

          <FormInput
            label="校区地址"
            placeholder="请输入校区地址"
            value={form.address}
            onInput={(e) => updateForm('address', e.detail.value)}
          />

          {/* 场地租金配置 */}
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground font-medium mb-2">场地租金</Text>
            <View className="flex flex-row gap-3">
              <View className="flex-1">
                <FormInput
                  label=""
                  placeholder="月租金额（元）"
                  type="digit"
                  value={form.monthlyRent}
                  onInput={(e) => updateForm('monthlyRent', e.detail.value)}
                />
              </View>
              <View className="flex-1">
                <FormInput
                  label=""
                  placeholder="到期日（1-28号）"
                  type="number"
                  value={form.rentDueDay}
                  onInput={(e) => updateForm('rentDueDay', e.detail.value)}
                />
              </View>
            </View>
            <Text className="text-xs text-muted-foreground mt-1">
              每月租金到期日将自动触发财务预警
            </Text>
          </View>

          {!canSubmit && submitBlockedReason ? (
            <View className="mb-3">
              <Text className="text-sm text-muted-foreground">{submitBlockedReason}</Text>
            </View>
          ) : null}
          {/* 保存按钮 */}
          <View
            className={cn(
              'rounded-2xl py-4 flex items-center justify-center mt-4',
              canSubmit ? 'bg-primary' : 'bg-muted',
            )}
            onClick={canSubmit ? () => void handleEditSubmit() : undefined}
          >
            <Text
              className={cn(
                'text-base font-semibold',
                canSubmit ? 'text-white' : 'text-muted-foreground',
              )}
            >
              {saving ? '保存中...' : '保存修改'}
            </Text>
          </View>
        </View>
      </BottomSheet>

      {/* ============================================ */}
      {/* 删除确认弹窗 */}
      {/* ============================================ */}
      <BottomSheet
        visible={showDeleteConfirm}
        title="删除校区"
        onClose={() => {
          if (deleting) return;
          setShowDeleteConfirm(false);
        }}
      >
        <View className="px-4 py-6 items-center">
          <Text className="text-5xl mb-4">🗑️</Text>
          <Text className="text-lg font-semibold text-foreground mb-2">确认删除？</Text>
          <Text className="text-sm text-muted-foreground text-center">
            删除后该校区数据将无法恢复
          </Text>
          <View className="flex flex-row gap-3 w-full mt-6">
            <View
              className="flex-1 bg-muted rounded-2xl py-3 items-center"
              onClick={() => {
                if (deleting) return;
                setShowDeleteConfirm(false);
              }}
            >
              <Text className="text-sm text-muted-foreground font-medium">取消</Text>
            </View>
            <View
              className={cn(
                'flex-1 rounded-2xl py-3 items-center',
                deleting ? 'bg-muted' : 'bg-destructive',
              )}
              onClick={deleting ? undefined : () => void handleConfirmDelete()}
            >
              <Text
                className={cn(
                  'text-sm font-medium',
                  deleting ? 'text-muted-foreground' : 'text-white',
                )}
              >
                {deleting ? '删除中...' : '确认删除'}
              </Text>
            </View>
          </View>
        </View>
      </BottomSheet>

      {/* ============================================ */}
      {/* 设为主校区确认弹窗 */}
      {/* ============================================ */}
      <BottomSheet
        visible={showSetMainConfirm}
        title="设为主校区"
        onClose={() => {
          if (settingMain) return;
          setShowSetMainConfirm(false);
        }}
      >
        <View className="px-4 py-6 items-center">
          <Text className="text-5xl mb-4">👑</Text>
          <Text className="text-lg font-semibold text-foreground mb-2">设为主校区</Text>
          <Text className="text-sm text-muted-foreground text-center">
            确定将「{settingMainName}」设为主校区吗？
          </Text>
          <Text className="text-xs text-warning mt-2">原主校区将变为自营分校区</Text>
          <View className="flex flex-row gap-3 w-full mt-6">
            <View
              className="flex-1 bg-muted rounded-2xl py-3 items-center"
              onClick={() => {
                if (settingMain) return;
                setShowSetMainConfirm(false);
              }}
            >
              <Text className="text-sm text-muted-foreground font-medium">取消</Text>
            </View>
            <View
              className={cn(
                'flex-1 rounded-2xl py-3 items-center',
                settingMain ? 'bg-muted' : 'bg-primary',
              )}
              onClick={settingMain ? undefined : () => void handleConfirmSetMain()}
            >
              <Text
                className={cn(
                  'text-sm font-medium',
                  settingMain ? 'text-muted-foreground' : 'text-white',
                )}
              >
                {settingMain ? '设置中...' : '确认'}
              </Text>
            </View>
          </View>
        </View>
      </BottomSheet>
    </PageContainer>
  );
};

export default SubCampus;
