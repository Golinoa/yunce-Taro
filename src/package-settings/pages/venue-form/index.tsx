/**
 * 场地设置页 - package-settings/pages/venue-form/index
 *
 * 仅支持已落库字段：名称 / 容量 / 状态。预约模式、价格、照片等能力即将开放（本阶段不展示，避免假保存）。
 */
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import FormCell from '@/components/FormCell';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import PickerSheet from '@/components/PickerSheet';
import { roomService, venueService } from '@/services/campus';
import { useCampusStore } from '@/stores/campus';
import { useThemeStore } from '@/stores/theme';
import { getThemeHexColors } from '@/theme';
import type { Room, RoomStatus } from '@/types/campus';
import { logError } from '@/utils/logger';
import { useCardNavigationBar } from '@/utils/navigation-bar';

interface FormState {
  name: string;
  capacity: string;
  status: RoomStatus;
}

const EMPTY_FORM: FormState = {
  name: '',
  capacity: '',
  status: 'active',
};

const STATUS_OPTIONS: { label: string; value: RoomStatus }[] = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

const VenueFormPage: React.FC = () => {
  useCardNavigationBar();
  const { activeTheme } = useThemeStore();
  const instance = Taro.getCurrentInstance();
  const roomId = decodeURIComponent(instance?.router?.params?.id || '');
  const isEdit = !!roomId;

  const { currentCampusId, campuses } = useCampusStore();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [originForm, setOriginForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const formInitializedRef = useRef(false);

  const currentCampus = useMemo(
    () => campuses.find((c) => c.id === currentCampusId) || campuses[0] || null,
    [campuses, currentCampusId],
  );

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  Taro.useLoad(() => {
    if (!isEdit || formInitializedRef.current) return;
    formInitializedRef.current = true;
    setLoading(true);
    void (async () => {
      try {
        const room = await roomService.getById(roomId);
        if (!room) {
          Taro.showToast({ title: '场地不存在', icon: 'none' });
          return;
        }
        const next = mapRoomToForm(room);
        setForm(next);
        setOriginForm(next);
      } catch (err) {
        logError('load room', err);
        Taro.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        setLoading(false);
      }
    })();
  });

  const validate = useCallback(() => {
    if (!form.name.trim()) {
      Taro.showToast({ title: '请输入空间名称', icon: 'none' });
      return false;
    }
    return true;
  }, [form.name]);

  const hasChanged = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(originForm),
    [form, originForm],
  );

  const handleSave = useCallback(async () => {
    if (!validate() || saving || !currentCampus) return;
    setSaving(true);
    try {
      const venues = await venueService.getList(currentCampus.id);
      const venue = venues[0];
      if (!venue) {
        Taro.showToast({ title: '当前校区暂无场馆，请先创建场馆', icon: 'none' });
        setSaving(false);
        return;
      }

      const payload = {
        venueId: venue.id,
        campusId: currentCampus.id,
        name: form.name.trim(),
        capacity: form.capacity ? Number(form.capacity) : undefined,
        status: form.status,
      };

      if (isEdit) {
        await roomService.update(roomId, payload);
      } else {
        await roomService.add(payload);
      }
      Taro.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 800);
    } catch (err) {
      logError('save room', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [form, isEdit, saving, currentCampus, validate, roomId]);

  const handleDelete = useCallback(async () => {
    if (!isEdit) return;
    const { confirm } = await Taro.showModal({
      title: '删除场地',
      content: '确定删除该场地吗？',
      confirmColor: getThemeHexColors(activeTheme).destructive,
    });
    if (!confirm) return;
    try {
      await roomService.delete(roomId);
      Taro.showToast({ title: '删除成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 800);
    } catch (err) {
      logError('delete room', err);
      Taro.showToast({ title: '删除失败', icon: 'none' });
    }
  }, [isEdit, roomId, activeTheme]);

  const statusText = useMemo(
    () => STATUS_OPTIONS.find((opt) => opt.value === form.status)?.label || '',
    [form.status],
  );

  if (loading && isEdit) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载场地信息中..." />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      <View className="px-[32rpx] pt-[24rpx] pb-[280rpx]">
        <View className="bg-white rounded-[32rpx] px-[32rpx] py-[8rpx] mb-[24rpx]">
          <FormCell
            label="空间名称"
            placeholder="请输入"
            value={form.name}
            onChange={(value) => updateField('name', value)}
            divider={false}
          />
        </View>

        <View className="bg-white rounded-[32rpx] px-[32rpx] py-[8rpx] mb-[24rpx]">
          <FormCell label="容量" divider>
            <View className="flex flex-row items-center justify-end gap-[8rpx] flex-1">
              <Input
                className="text-right text-[30rpx] text-foreground placeholder:text-muted-foreground bg-transparent"
                value={form.capacity}
                placeholder="请输入"
                type="number"
                onInput={(e) => updateField('capacity', e.detail.value)}
              />
              <Text className="text-[30rpx] text-muted-foreground">人</Text>
            </View>
          </FormCell>
          <FormCell
            label="状态"
            value={statusText}
            editable={false}
            showArrow
            onClick={() => setShowStatusPicker(true)}
            divider={false}
          />
        </View>

        <View className="bg-muted/40 rounded-[24rpx] px-[28rpx] py-[20rpx] mb-[24rpx]">
          <Text className="text-[24rpx] text-muted-foreground leading-relaxed">
            场地预约、照片、开放时段与价格配置即将开放；当前仅保存名称、容量与状态。
          </Text>
        </View>

        <PickerSheet
          visible={showStatusPicker}
          title="选择状态"
          options={STATUS_OPTIONS}
          value={form.status}
          onClose={() => setShowStatusPicker(false)}
          onConfirm={(value) => updateField('status', value as RoomStatus)}
        />
      </View>

      <View className="fixed left-0 right-0 bottom-0 bg-white px-[32rpx] pt-[16rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))] border-t-[2rpx] border-border">
        <View
          className={cn(
            'rounded-[48rpx] py-[28rpx] flex items-center justify-center mb-[20rpx]',
            hasChanged && !saving ? 'bg-primary press-scale' : 'bg-muted',
          )}
          onClick={hasChanged && !saving ? handleSave : undefined}
        >
          <Text
            className={cn(
              'text-[30rpx] font-semibold',
              hasChanged && !saving ? 'text-white' : 'text-muted-foreground',
            )}
          >
            {saving ? '保存中...' : '保存'}
          </Text>
        </View>
        {isEdit && (
          <View
            className="rounded-[48rpx] py-[28rpx] flex items-center justify-center border-[2rpx] border-border press-bg"
            onClick={handleDelete}
          >
            <Text className="text-[30rpx] font-semibold text-foreground">删除</Text>
          </View>
        )}
      </View>
    </PageContainer>
  );
};

function mapRoomToForm(room: Room): FormState {
  return {
    name: room.name,
    capacity: room.capacity ? String(room.capacity) : '',
    status: room.status,
  };
}

definePageConfig({
  navigationBarTitleText: '场地设置',
  navigationBarBackgroundColor: '#3B6EF5',
  navigationBarTextStyle: 'white',
});

export default VenueFormPage;
