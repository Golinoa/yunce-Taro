/**
 * 场地设置页 - package-settings/pages/venue-form/index
 *
 * 新增 / 编辑场地（Room 作为可预约空间）。
 * 表单采用「左标签 + 右内容」的卡片式布局，与校区设置页保持一致。
 * 支持：空间名称、容量、状态、场地预约模式、场地照片、开放时间、单次付费金额、分时段收费。
 */
import { View, Text, Picker, Switch, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import FormCell from '@/components/FormCell';
import ImageUploaderList from '@/components/ImageUploaderList';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import PickerSheet from '@/components/PickerSheet';
import { DEFAULT_VENUE_MANAGER_USER_ID } from '@/constants/campus-ui';
import { roomService, venueService } from '@/services/campus';
import { teacherService } from '@/services/teacher';
import { useCampusStore } from '@/stores/campus';
import { useThemeStore } from '@/stores/theme';
import { getThemeHexColors } from '@/theme';
import type { Room, RoomStatus } from '@/types/campus';
import type { TeacherUIModel } from '@/types/teacher';
import { logError } from '@/utils/logger';
import { useCardNavigationBar } from '@/utils/navigation-bar';

interface FormState {
  name: string;
  capacity: string;
  status: RoomStatus;
  bookingEnabled: boolean;
  photos: string[];
  openTimeStart: string;
  openTimeEnd: string;
  pricePerSession: string;
  timeBasedPricing: boolean;
  managerUserId: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  capacity: '',
  status: 'active',
  bookingEnabled: false,
  photos: [],
  openTimeStart: '09:00',
  openTimeEnd: '22:00',
  pricePerSession: '0',
  timeBasedPricing: false,
  managerUserId: DEFAULT_VENUE_MANAGER_USER_ID,
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
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const [managerOptions, setManagerOptions] = useState<{ label: string; value: string }[]>([]);
  const formInitializedRef = useRef(false);

  const currentCampus = useMemo(
    () => campuses.find((c) => c.id === currentCampusId) || campuses[0] || null,
    [campuses, currentCampusId],
  );

  const loadRoom = useCallback(async () => {
    if (formInitializedRef.current) return;
    if (!roomId) {
      formInitializedRef.current = true;
      return;
    }
    setLoading(true);
    try {
      const room = await roomService.getById(roomId);
      if (room) {
        const mapped = mapRoomToForm(room);
        setForm(mapped);
        setOriginForm(mapped);
        formInitializedRef.current = true;
      } else {
        Taro.showToast({ title: '场地不存在', icon: 'none' });
      }
    } catch (err) {
      logError('load room', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  Taro.useDidShow(() => {
    void loadRoom();
    void teacherService.getActiveList(currentCampus?.id).then((list: TeacherUIModel[]) => {
      const options = [
        { label: '机构管理员', value: DEFAULT_VENUE_MANAGER_USER_ID },
        ...list.map((teacher) => ({ label: teacher.name, value: teacher.id })),
      ];
      setManagerOptions(options);
    });
  });

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const validate = useCallback((): boolean => {
    if (!form.name.trim()) {
      Taro.showToast({ title: '请输入空间名称', icon: 'none' });
      return false;
    }
    if (form.capacity && !/^\d+$/.test(form.capacity)) {
      Taro.showToast({ title: '请输入有效的人数', icon: 'none' });
      return false;
    }
    if (form.pricePerSession && !/^\d+(\.\d{0,2})?$/.test(form.pricePerSession)) {
      Taro.showToast({ title: '请输入有效的金额', icon: 'none' });
      return false;
    }
    return true;
  }, [form]);

  const hasChanged = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(originForm);
  }, [form, originForm]);

  const handleSave = useCallback(async () => {
    if (!validate() || saving || !currentCampus) return;
    setSaving(true);
    try {
      // 新增时需要先找一个默认 venue
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
        bookingEnabled: form.bookingEnabled,
        photos: form.photos,
        openTimeStart: form.openTimeStart,
        openTimeEnd: form.openTimeEnd,
        pricePerSession: Number(form.pricePerSession || 0),
        timeBasedPricing: form.timeBasedPricing,
        managerUserId: form.managerUserId || DEFAULT_VENUE_MANAGER_USER_ID,
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

  const managerText = useMemo(
    () => managerOptions.find((opt) => opt.value === form.managerUserId)?.label || '机构管理员',
    [form.managerUserId, managerOptions],
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
        {/* 基础信息 */}
        <View className="bg-white rounded-[32rpx] px-[32rpx] py-[8rpx] mb-[24rpx]">
          <FormCell
            label="空间名称"
            placeholder="请输入"
            value={form.name}
            onChange={(value) => updateField('name', value)}
            divider={false}
          />
        </View>

        {/* 容量与状态 */}
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
            divider
          />
          <FormCell
            label="场地负责人"
            value={managerText}
            editable={false}
            showArrow
            onClick={() => setShowManagerPicker(true)}
            divider={false}
          />
        </View>

        {/* 状态选择弹窗 */}
        <PickerSheet
          visible={showStatusPicker}
          title="选择状态"
          options={STATUS_OPTIONS}
          value={form.status}
          onClose={() => setShowStatusPicker(false)}
          onConfirm={(value) => updateField('status', value as RoomStatus)}
        />
        <PickerSheet
          visible={showManagerPicker}
          title="选择场地负责人"
          options={managerOptions}
          value={form.managerUserId}
          onClose={() => setShowManagerPicker(false)}
          onConfirm={(value) => updateField('managerUserId', value)}
        />

        {/* 场地预约模式 */}
        <View className="bg-white rounded-[32rpx] p-[32rpx] mb-[24rpx]">
          <View className="flex flex-row items-start justify-between gap-[24rpx]">
            <View className="flex-1">
              <Text className="text-[30rpx] font-medium text-foreground">场地预约模式</Text>
              <View className="mt-[12rpx] flex flex-col gap-[8rpx]">
                {form.bookingEnabled ? (
                  <>
                    <Text className="text-[26rpx] text-foreground leading-relaxed">
                      开启后，会员可在小程序中预约该场地。
                    </Text>
                    <Text className="text-[24rpx] text-muted-foreground leading-relaxed">
                      保存后会出现在首页「场地」入口，并按下方开放时间/价格接受预约。
                    </Text>
                  </>
                ) : (
                  <>
                    <Text className="text-[26rpx] text-foreground leading-relaxed">
                      关闭后，该场地仅用于排课，不向会员开放预约。
                    </Text>
                    <Text className="text-[24rpx] text-muted-foreground leading-relaxed">
                      如需会员在线订场，请先打开此开关。
                    </Text>
                  </>
                )}
              </View>
            </View>
            <Switch
              checked={form.bookingEnabled}
              onChange={(e) => updateField('bookingEnabled', e.detail.value)}
              color={getThemeHexColors(activeTheme).primary}
            />
          </View>
        </View>

        {/* 预约相关配置：仅开启场地预约模式时显示 */}
        {form.bookingEnabled && (
          <>
            {/* 场地照片 */}
            <View className="bg-white rounded-[32rpx] p-[32rpx] mb-[24rpx]">
              <View className="flex flex-col gap-[16rpx]">
                <View>
                  <Text className="text-[30rpx] font-medium text-foreground">场地照片</Text>
                  <Text className="text-[24rpx] text-muted-foreground mt-[8rpx] leading-relaxed">
                    会员端场地详情顶部轮播展示，最多 3 张
                  </Text>
                </View>
                <ImageUploaderList
                  value={form.photos}
                  placeholder="上传"
                  maxCount={3}
                  maxSizeMB={2}
                  onChange={(value) => updateField('photos', value)}
                />
              </View>
            </View>

            {/* 开放时间 */}
            <View className="bg-white rounded-[32rpx] p-[32rpx] mb-[24rpx]">
              <Text className="text-[30rpx] font-medium text-foreground mb-[24rpx]">开放时间</Text>
              <View className="flex flex-row items-center justify-center gap-[20rpx]">
                <Picker
                  mode="time"
                  value={form.openTimeStart}
                  onChange={(e) => updateField('openTimeStart', e.detail.value)}
                >
                  <View className="min-w-[160rpx] px-[32rpx] py-[18rpx] rounded-[16rpx] bg-muted text-center">
                    <Text className="text-[30rpx] text-foreground">{form.openTimeStart}</Text>
                  </View>
                </Picker>
                <Text className="text-[28rpx] text-muted-foreground">至</Text>
                <Picker
                  mode="time"
                  value={form.openTimeEnd}
                  onChange={(e) => updateField('openTimeEnd', e.detail.value)}
                >
                  <View className="min-w-[160rpx] px-[32rpx] py-[18rpx] rounded-[16rpx] bg-muted text-center">
                    <Text className="text-[30rpx] text-foreground">{form.openTimeEnd}</Text>
                  </View>
                </Picker>
              </View>
            </View>

            {/* 单次付费金额 */}
            <View className="bg-white rounded-[32rpx] px-[32rpx] py-[8rpx] mb-[24rpx]">
              <FormCell label="单次付费金额" divider={false}>
                <View className="flex flex-row items-center justify-end gap-[8rpx] flex-1">
                  <Input
                    className="text-right text-[30rpx] text-foreground placeholder:text-muted-foreground bg-transparent"
                    value={form.pricePerSession}
                    placeholder="0"
                    type="digit"
                    onInput={(e) => updateField('pricePerSession', e.detail.value)}
                  />
                  <Text className="text-[30rpx] text-muted-foreground">元</Text>
                </View>
              </FormCell>
            </View>

            {/* 分时段收费 */}
            <View className="bg-white rounded-[32rpx] p-[32rpx] mb-[24rpx]">
              <View className="flex flex-row items-start justify-between gap-[24rpx]">
                <View className="flex-1">
                  <Text className="text-[30rpx] font-medium text-foreground">分时段收费</Text>
                  <Text className="text-[24rpx] text-muted-foreground mt-[8rpx] leading-relaxed">
                    开启后可按不同时间段设置不同价格；关闭则所有预约按上方单次价收费。
                  </Text>
                </View>
                <Switch
                  checked={form.timeBasedPricing}
                  onChange={(e) => updateField('timeBasedPricing', e.detail.value)}
                  color={getThemeHexColors(activeTheme).primary}
                />
              </View>
            </View>
          </>
        )}
      </View>

      {/* 底部操作按钮 */}
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
    bookingEnabled: room.bookingEnabled ?? false,
    photos: room.photos || [],
    openTimeStart: room.openTimeStart ?? '09:00',
    openTimeEnd: room.openTimeEnd ?? '22:00',
    pricePerSession: room.pricePerSession !== undefined ? String(room.pricePerSession) : '0',
    timeBasedPricing: room.timeBasedPricing ?? false,
    managerUserId: room.managerUserId || DEFAULT_VENUE_MANAGER_USER_ID,
  };
}

// 页面配置使用硬编码主题色，对应 src/theme.ts hexColors.primary (#3B6EF5)
definePageConfig({
  navigationBarTitleText: '场地设置',
  navigationBarBackgroundColor: '#3B6EF5',
  navigationBarTextStyle: 'white',
});

export default VenueFormPage;
