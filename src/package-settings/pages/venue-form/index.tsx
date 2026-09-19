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
import { REFRESH_SIGNAL, setRefreshSignal } from '@/utils/refresh-signal';

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
  // 防重复提交守卫（ref，不触发 re-render）：避免停在 state 上干扰 navigateBack 关页。
  const savingRef = useRef(false);

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

  /**
   * 写完回到列表页。表单只可能由 venue-list 经 navigateTo 压入，
   * 按页面栈精确算出到列表页的距离 delta，一次退掉所有叠加的表单层
   * （防慢速双击叠层时只退一层、露出底层同款表单）；栈内无列表页（深链直达）才 redirectTo 兜底。
   */
  const goBackToList = useCallback(() => {
    const LIST_URL = '/package-settings/pages/venue-list/index';
    const LIST_PATH = 'package-settings/pages/venue-list/index';
    const pages = Taro.getCurrentPages();
    let delta = 0;
    for (let i = pages.length - 2; i >= 0; i--) {
      const route = (pages[i] as { route?: string } | undefined)?.route || '';
      if (route.includes(LIST_PATH)) {
        delta = pages.length - 1 - i;
        break;
      }
    }
    if (delta > 0) {
      Taro.navigateBack({ delta });
    } else {
      Taro.redirectTo({ url: LIST_URL });
    }
  }, []);

  const hasChanged = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(originForm),
    [form, originForm],
  );

  const handleSave = useCallback(async () => {
    if (!validate() || savingRef.current || !currentCampus) return;
    savingRef.current = true;
    setSaving(true);
    try {
      let venue = (await venueService.getList(currentCampus.id))[0];
      // 存量校区可能无默认场馆：自动补建后再挂教室
      if (!venue) {
        venue = await venueService.add({
          campusId: currentCampus.id,
          name: `${currentCampus.name}·默认场馆`,
          address: currentCampus.address || undefined,
          status: 'active',
        });
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
      // 通知 venue-list 写后强制重拉；列表「返回即强刷」兜底，双保险
      setRefreshSignal(REFRESH_SIGNAL.venues);
      // 成功后延时回退，让「保存成功」toast 可见；回退由列表 onShow 必然触发重拉。
      setTimeout(goBackToList, 400);
    } catch (err) {
      logError('save room', err);
      Taro.showToast({
        title: err instanceof Error && err.message ? err.message : '保存失败',
        icon: 'none',
      });
    } finally {
      // 流程结束（成功或失败）一律复位守卫与状态，绝不停留在 true：
      // 既不残留「保存中」干扰 navigateBack 关页，也不让按钮被永久锁死。
      savingRef.current = false;
      setSaving(false);
    }
  }, [form, isEdit, currentCampus, validate, roomId, goBackToList]);

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
      setRefreshSignal(REFRESH_SIGNAL.venues);
      setTimeout(goBackToList, 400);
    } catch (err) {
      logError('delete room', err);
      Taro.showToast({ title: '删除失败', icon: 'none' });
    }
  }, [isEdit, roomId, activeTheme, goBackToList]);

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
              {/* 只允许数字：非数字字符（小数点/负号/空格等）即时剔除，最多 5 位 */}
              <Input
                className="text-right text-[30rpx] text-foreground placeholder:text-muted-foreground bg-transparent"
                value={form.capacity}
                placeholder="请输入"
                type="number"
                maxlength={5}
                onInput={(e) => updateField('capacity', e.detail.value.replace(/\D/g, ''))}
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
