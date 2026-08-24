/**
 * 个人资料编辑页 pages/profile-edit/index
 *
 * 设计参考：「个人资料 / 子女资料」双 Tab 页面
 * - 顶部分段控制器：个人资料 | 子女资料
 * - 个人资料：头像/姓名/昵称/性别/手机/生日/证件号码/地区/地址 + 保存 + 退出登录
 * - 子女资料：子女卡片列表（头像/姓名/关系/主监护人/性别/上课次数/持卡数量）+「添加子女」
 *
 * 全部使用 UnoCSS Token，随主题色（blue/coral/orange）联动。
 */
import { View, Text, ScrollView, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import PickerSheet, { PickerOption } from '@/components/PickerSheet';
import { BRAND_LOGO } from '@/constants/brand';
import { lessonRecordService, packageService, studentService } from '@/services';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import {
  chooseImageTemp,
  deleteTempImage,
  isImageCancelError,
  isTempImagePath,
} from '@/utils/image-upload';
import { useCardNavigationBar } from '@/utils/navigation-bar';

type Gender = 'male' | 'female' | 'other';

/** 性别选项 */
const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'other', label: '其他' },
];

/** 关系选项（添加子女） */
const RELATION_OPTIONS = ['儿子', '女儿', '其他'];

/** 分段 Tab */
type TabKey = 'profile' | 'children';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'profile', label: '个人资料' },
  { key: 'children', label: '子女资料' },
];

const GENDER_LABEL: Record<Gender, string> = { male: '男', female: '女', other: '其他' };

/**
 * 表单行容器：左标签 + 右侧内容，行间细分割线
 */
function FieldRow({
  label,
  right,
  onClick,
}: {
  label: React.ReactNode;
  right: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <View
      className={cn(
        'flex items-center min-h-[100rpx] px-[32rpx] border-b border-border/60 last:border-b-0',
        onClick && 'press-scale',
      )}
      onClick={onClick}
    >
      <View className="w-[150rpx] flex-shrink-0 text-[28rpx] text-muted-foreground">{label}</View>
      <View className="flex-1 flex items-center justify-end overflow-hidden">{right}</View>
    </View>
  );
}

/** 右侧箭头（可点击行） */
function RowArrow() {
  return <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />;
}

/** 选择框占位/显示文本 */
function SelectValue({ value, placeholder }: { value?: string; placeholder: string }) {
  return (
    <Text
      className={cn('text-[30rpx] truncate', value ? 'text-foreground' : 'text-muted-foreground')}
    >
      {value || placeholder}
    </Text>
  );
}

const ProfileEdit: React.FC = () => {
  useCardNavigationBar();

  const { profile, getProfileExtra: fetchExtra, updateProfile: submitUpdate, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  // ============================================
  // 个人资料表单
  // ============================================
  const [draft, setDraft] = useState({
    name: '',
    nickname: '',
    avatar_url: '',
    phone: '',
    gender: '' as Gender | '',
    birthday: '',
    id_card: '',
    region: '',
    address: '',
  });
  const [saving, setSaving] = useState(false);

  // 加载个人资料（基础字段 + 扩展字段）
  useEffect(() => {
    const load = async () => {
      const extra = await fetchExtra();
      if (profile) {
        setDraft({
          name: profile.name || '',
          nickname: profile.nickname || profile.name || '',
          avatar_url: profile.avatar_url || '',
          phone: profile.phone || '',
          gender: extra.gender || '',
          birthday: extra.birthday || '',
          id_card: extra.id_card || '',
          region: extra.region || '',
          address: extra.address || '',
        });
      }
    };
    load();
  }, [profile, fetchExtra]);

  const updateField = useCallback(
    <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  /** 个人头像：相册/拍照选图（1:1 裁剪 + 本地持久化，与子女头像一致） */
  const handleAvatarPick = useCallback(async () => {
    try {
      const tempPath = await chooseImageTemp({ maxSizeMB: 5, cropScale: '1:1' });
      // 替换图片：删掉旧的本地临时文件，避免本地存储累积
      if (isTempImagePath(draft.avatar_url)) deleteTempImage(draft.avatar_url);
      updateField('avatar_url', tempPath);
    } catch (err) {
      if (isImageCancelError(err)) return;
      const message = err instanceof Error ? err.message : '选择图片失败';
      if (message.includes('超过') || message.includes('限制')) {
        void Taro.showModal({
          title: '图片过大',
          content: message,
          showCancel: false,
          confirmText: '知道了',
        });
      } else {
        Taro.showToast({ title: message, icon: 'none' });
      }
    }
  }, [draft.avatar_url, updateField]);

  /** 个人头像点击：未选→直接选相册；已选→弹「查看图片/重新选择/删除头像」 */
  const handleAvatarClick = useCallback(() => {
    if (!draft.avatar_url) {
      void handleAvatarPick();
      return;
    }
    void Taro.showActionSheet({
      itemList: ['查看图片', '重新选择', '删除头像'],
      success: (res) => {
        if (res.tapIndex === 0) {
          void Taro.previewImage({ current: draft.avatar_url, urls: [draft.avatar_url] });
        } else if (res.tapIndex === 1) {
          void handleAvatarPick();
        } else if (res.tapIndex === 2) {
          if (isTempImagePath(draft.avatar_url)) deleteTempImage(draft.avatar_url);
          updateField('avatar_url', '');
        }
      },
    });
  }, [draft.avatar_url, handleAvatarPick, updateField]);

  // 保存
  const handleSave = useCallback(async () => {
    if (!draft.nickname.trim()) {
      Taro.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }
    if (draft.phone && !/^1\d{10}$/.test(draft.phone)) {
      Taro.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await submitUpdate({
        name: draft.nickname.trim(),
        nickname: draft.nickname.trim(),
        avatar_url: draft.avatar_url.trim(),
        phone: draft.phone.trim(),
        gender: (draft.gender || undefined) as Gender | undefined,
        birthday: draft.birthday.trim(),
        region: draft.region.trim(),
      });
      if (error) {
        Taro.showToast({ title: error.message || '保存失败', icon: 'none' });
      } else {
        Taro.showToast({ title: '保存成功', icon: 'success' });
      }
    } finally {
      setSaving(false);
    }
  }, [draft, submitUpdate]);

  // 退出登录
  const handleLogout = useCallback(() => {
    Taro.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmText: '退出',
      cancelText: '取消',
      confirmColor: '#FF3B30',
      success: async ({ confirm }) => {
        if (confirm) {
          await signOut();
          Taro.clearStorageSync();
          Taro.reLaunch({ url: '/pages/login/index' });
        }
      },
    });
  }, [signOut]);

  // ============================================
  // 子女资料
  // ============================================
  const [children, setChildren] = useState<Student[]>([]);
  const [childStats, setChildStats] = useState<
    Record<string, { lessonCount: number; packageCount: number }>
  >({});
  const [loadingChildren, setLoadingChildren] = useState(false);

  const loadChildren = useCallback(async () => {
    if (!profile?.id) return;
    setLoadingChildren(true);
    try {
      const list = await studentService.getByParent(profile.id);
      const alive = list.filter((s) => s.status !== 'deleted');
      setChildren(alive);
      // 并行加载每个子女的上课次数与持卡数量
      const stats: Record<string, { lessonCount: number; packageCount: number }> = {};
      await Promise.all(
        alive.map(async (s) => {
          const [pkgs, recs] = await Promise.all([
            packageService.getByStudent(s.id),
            lessonRecordService.getByStudent(s.id),
          ]);
          stats[s.id] = {
            packageCount: pkgs.length,
            // 上课次数：按实际消耗课时的记录统计
            lessonCount: recs.filter((r) => (r.hours_used || 0) > 0).length,
          };
        }),
      );
      setChildStats(stats);
    } catch {
      Taro.showToast({ title: '子女信息加载失败', icon: 'none' });
    } finally {
      setLoadingChildren(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  // 点击子女卡片 → 独立子女详情页
  const goChildDetail = useCallback((student: Student) => {
    Taro.navigateTo({
      url: `/pages/child-detail/index?id=${encodeURIComponent(student.id)}`,
    });
  }, []);

  // 添加子女弹窗
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [childForm, setChildForm] = useState({
    name: '',
    nickname: '',
    relation: '',
    gender: '' as Gender | '',
    birthday: '',
    avatar_url: '',
  });
  const [adding, setAdding] = useState(false);
  /** 统一弹窗选择器（PickerSheet 标准组件）：gender/relation/childGender */
  const [selector, setSelector] = useState<{
    visible: boolean;
    type: 'gender' | 'relation' | 'childGender' | null;
  }>({ visible: false, type: null });

  /** 子女头像：相册/拍照选图（1:1 裁剪 + 本地持久化，与个人头像一致） */
  const handleChildAvatarPick = useCallback(async () => {
    try {
      const tempPath = await chooseImageTemp({ maxSizeMB: 5, cropScale: '1:1' });
      // 替换图片：删掉旧的本地临时文件，避免本地存储累积
      if (isTempImagePath(childForm.avatar_url)) deleteTempImage(childForm.avatar_url);
      setChildForm((prev) => ({ ...prev, avatar_url: tempPath }));
    } catch (err) {
      if (isImageCancelError(err)) return;
      const message = err instanceof Error ? err.message : '选择图片失败';
      if (message.includes('超过') || message.includes('限制')) {
        void Taro.showModal({
          title: '图片过大',
          content: message,
          showCancel: false,
          confirmText: '知道了',
        });
      } else {
        Taro.showToast({ title: message, icon: 'none' });
      }
    }
  }, [childForm.avatar_url]);

  /** 子女头像点击：未选→直接选相册；已选→弹「查看图片/重新选择/删除头像」 */
  const handleChildAvatarClick = useCallback(() => {
    if (!childForm.avatar_url) {
      void handleChildAvatarPick();
      return;
    }
    void Taro.showActionSheet({
      itemList: ['查看图片', '重新选择', '删除头像'],
      success: (res) => {
        if (res.tapIndex === 0) {
          void Taro.previewImage({ current: childForm.avatar_url, urls: [childForm.avatar_url] });
        } else if (res.tapIndex === 1) {
          void handleChildAvatarPick();
        } else if (res.tapIndex === 2) {
          if (isTempImagePath(childForm.avatar_url)) deleteTempImage(childForm.avatar_url);
          setChildForm((prev) => ({ ...prev, avatar_url: '' }));
        }
      },
    });
  }, [childForm.avatar_url, handleChildAvatarPick]);

  const resetChildForm = useCallback(() => {
    setChildForm({
      name: '',
      nickname: '',
      relation: '',
      gender: '',
      birthday: '',
      avatar_url: '',
    });
  }, []);

  const handleAddChild = useCallback(async () => {
    if (!childForm.nickname.trim()) {
      Taro.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }
    if (!childForm.relation) {
      Taro.showToast({ title: '请选择关系', icon: 'none' });
      return;
    }
    if (!childForm.gender) {
      Taro.showToast({ title: '请选择性别', icon: 'none' });
      return;
    }
    setAdding(true);
    try {
      const created = await studentService.create({
        name: childForm.nickname.trim(),
        nickname: childForm.nickname.trim(),
        relation: childForm.relation,
        gender: childForm.gender as Gender,
        birthday: childForm.birthday,
        avatar_url: childForm.avatar_url.trim() || undefined,
        parent_id: profile?.id,
        teacher_id: '',
        invite_code: `INV-${Date.now().toString().slice(-4).toUpperCase()}`,
      });
      setChildren((prev) => [created, ...prev]);
      setChildStats((prev) => ({ ...prev, [created.id]: { lessonCount: 0, packageCount: 0 } }));
      Taro.showToast({ title: '添加成功', icon: 'success' });
      setShowAddSheet(false);
      resetChildForm();
    } catch {
      Taro.showToast({ title: '添加失败，请重试', icon: 'none' });
    } finally {
      setAdding(false);
    }
  }, [childForm, resetChildForm, profile?.id]);

  return (
    <View className="min-h-screen bg-background flex flex-col pb-[env(safe-area-inset-bottom)]">
      {/* ====== 顶部导航 + 分段 Tab ====== */}
      <View className="sticky top-0 z-50 bg-card border-b border-border">
        <View className="pt-nav-safe">
          <View className="relative h-[88rpx] flex items-center justify-center">
            <View
              className="absolute left-[32rpx] flex items-center justify-center w-[64rpx] h-[64rpx] rounded-full active:bg-muted/60"
              onClick={() => Taro.navigateBack()}
            >
              <Icon name="mdi-chevron-left" size={40} color="foreground" />
            </View>
            <Text className="text-[34rpx] font-bold text-foreground">我的资料</Text>
          </View>
        </View>
        <View className="px-[32rpx] pb-[16rpx]">
          <View className="segment-wrap">
            {TABS.map((tab) => (
              <View
                key={tab.key}
                className={cn(
                  'segment-item',
                  activeTab === tab.key ? 'segment-active' : 'segment-inactive',
                )}
                onClick={() => setActiveTab(tab.key)}
              >
                <Text>{tab.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ====== Tab 内容 ====== */}
      <ScrollView scrollY className="flex-1" showScrollbar={false}>
        {activeTab === 'profile' ? (
          /* ---------- 个人资料 ---------- */
          <View className="px-[32rpx] pt-[24rpx] flex flex-col gap-[24rpx] pb-[40rpx]">
            {/* 基础信息表单 */}
            <View className="bg-card rounded-[28rpx] py-[8rpx] shadow-soft overflow-hidden">
              {/* 头像：点击直接选相册/拍照；已上传可查看/重选/删除 */}
              <FieldRow
                label="头像"
                onClick={handleAvatarClick}
                right={
                  <View className="flex items-center gap-[8rpx]">
                    <View className="relative">
                      <Avatar
                        name={draft.nickname || profile?.name || '我'}
                        avatarUrl={draft.avatar_url || BRAND_LOGO}
                        size="md"
                      />
                      {/* 相机小角标，提示可点击上传 */}
                      <View className="absolute -bottom-[4rpx] -right-[4rpx] w-[32rpx] h-[32rpx] rounded-full bg-primary border-[2rpx] border-card flex items-center justify-center">
                        <Icon name="mdi-camera" size={18} color="white" />
                      </View>
                    </View>
                    <RowArrow />
                  </View>
                }
              />
              <FieldRow
                label="昵称"
                right={
                  <FormInput
                    variant="ghost"
                    placeholder="请输入昵称"
                    value={draft.nickname}
                    onInput={(e) => updateField('nickname', e.detail.value || '')}
                  />
                }
              />
              <FieldRow
                label="性别"
                right={
                  <View
                    className="flex items-center justify-end gap-[8rpx] press-scale"
                    onClick={() => setSelector({ visible: true, type: 'gender' })}
                  >
                    <SelectValue
                      value={draft.gender ? GENDER_LABEL[draft.gender] : undefined}
                      placeholder="请选择"
                    />
                    <RowArrow />
                  </View>
                }
              />
              <FieldRow
                label="手机号"
                right={
                  <FormInput
                    variant="ghost"
                    type="number"
                    maxlength={11}
                    placeholder="请输入11位手机号"
                    value={draft.phone}
                    onInput={(e) => updateField('phone', e.detail.value || '')}
                  />
                }
              />
              <FieldRow
                label="生日"
                right={
                  <Picker
                    mode="date"
                    start="1950-01-01"
                    end={dayjs().format('YYYY-MM-DD')}
                    value={draft.birthday}
                    onChange={(e) => updateField('birthday', e.detail.value)}
                  >
                    <View className="flex items-center justify-end gap-[8rpx]">
                      <SelectValue value={draft.birthday} placeholder="请选择生日" />
                      <RowArrow />
                    </View>
                  </Picker>
                }
              />
              <FieldRow
                label="地区"
                right={
                  <Picker
                    mode="region"
                    onChange={(e) =>
                      updateField('region', (e.detail.value || []).filter(Boolean).join(' '))
                    }
                  >
                    <View className="flex items-center justify-end gap-[8rpx]">
                      <SelectValue value={draft.region} placeholder="请选择地区" />
                      <RowArrow />
                    </View>
                  </Picker>
                }
              />
            </View>

            {/* 保存 */}
            <View
              className={cn(
                'h-[96rpx] rounded-2xl center press-scale',
                saving ? 'bg-muted' : 'bg-gradient-primary shadow-elegant',
              )}
              onClick={saving ? undefined : handleSave}
            >
              <Text className="text-[30rpx] font-semibold text-white">
                {saving ? '保存中...' : '保存'}
              </Text>
            </View>

            {/* 退出登录 */}
            <View
              className="h-[96rpx] rounded-2xl bg-card center press-scale shadow-soft"
              onClick={handleLogout}
            >
              <Text className="text-[30rpx] font-medium text-destructive">退出登录</Text>
            </View>
          </View>
        ) : (
          /* ---------- 子女资料 ---------- */
          <View className="px-[32rpx] pt-[24rpx] pb-[40rpx] flex flex-col gap-[24rpx]">
            {loadingChildren && children.length === 0 ? (
              <View className="py-[120rpx] center-col gap-[16rpx]">
                <Text className="text-[26rpx] text-muted-foreground">加载中…</Text>
              </View>
            ) : children.length === 0 ? (
              <View className="bg-card rounded-[28rpx] shadow-soft">
                <Empty
                  icon="mdi-account-group-outline"
                  description="暂未添加子女，点击下方按钮添加"
                />
              </View>
            ) : (
              children.map((student, index) => {
                const stats = childStats[student.id] || { lessonCount: 0, packageCount: 0 };
                const isMainGuardian = index === 0;
                const relation = student.relation || '子女';
                return (
                  <View
                    key={student.id}
                    className="bg-card rounded-[28rpx] p-[28rpx] shadow-soft press-scale"
                    onClick={() => goChildDetail(student)}
                  >
                    {/* 头部：头像 + 姓名 + 标签 */}
                    <View className="flex items-center gap-[20rpx]">
                      <View className="relative flex-shrink-0">
                        <Avatar name={student.name} avatarUrl={student.avatar_url} size="lg" />
                        <View className="absolute -bottom-[4rpx] -right-[4rpx] w-[36rpx] h-[36rpx] rounded-full bg-gradient-primary center border-[3rpx] border-white">
                          <Icon
                            name={
                              student.gender === 'male'
                                ? 'mdi-gender-male'
                                : student.gender === 'female'
                                  ? 'mdi-gender-female'
                                  : 'mdi-account-child'
                            }
                            size={18}
                            color="white"
                          />
                        </View>
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-[32rpx] font-bold text-foreground truncate block">
                          {student.name}
                        </Text>
                        <View className="flex items-center gap-[8rpx] mt-[12rpx]">
                          <View className="tag-primary">
                            <Text>{relation}</Text>
                          </View>
                          {isMainGuardian && (
                            <View className="tag-amber">
                              <Text>主监护人</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
                    </View>

                    {/* 底部统计 */}
                    <View className="mt-[24rpx] pt-[20rpx] border-t border-border/60 flex flex-row">
                      <View className="flex-1 center-col">
                        <Text className="text-[30rpx] font-bold text-foreground leading-none">
                          {student.gender ? GENDER_LABEL[student.gender] : '未设置'}
                        </Text>
                        <Text className="text-[22rpx] text-muted-foreground mt-[8rpx]">性别</Text>
                      </View>
                      <View className="w-[2rpx] bg-border/60" />
                      <View className="flex-1 center-col">
                        <Text className="text-[30rpx] font-bold text-primary leading-none">
                          {stats.lessonCount}
                        </Text>
                        <Text className="text-[22rpx] text-muted-foreground mt-[8rpx]">
                          上课次数
                        </Text>
                      </View>
                      <View className="w-[2rpx] bg-border/60" />
                      <View className="flex-1 center-col">
                        <Text className="text-[30rpx] font-bold text-primary leading-none">
                          {stats.packageCount}
                        </Text>
                        <Text className="text-[22rpx] text-muted-foreground mt-[8rpx]">
                          持卡数量
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}

            {/* 添加子女 */}
            <View
              className="h-[96rpx] rounded-2xl border-[2rpx] border-dashed border-primary/40 bg-primary-bg center press-scale"
              onClick={() => {
                resetChildForm();
                setShowAddSheet(true);
              }}
            >
              <Icon name="mdi-account-plus" size={32} color="primary" />
              <Text className="text-[30rpx] font-semibold text-primary ml-[8rpx]">添加子女</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ====== 添加子女弹窗 ====== */}
      <BottomSheet
        visible={showAddSheet}
        title="添加子女"
        onClose={() => setShowAddSheet(false)}
        height="auto"
        maxHeightLimit="75vh"
      >
        <View className="px-[32rpx] pb-[40rpx]">
          {/* 头像：圆形上传元素（相册/拍照 1:1 裁剪，可重选/删除） */}
          <FieldRow
            label="头像"
            onClick={handleChildAvatarClick}
            right={
              <View className="flex items-center gap-[8rpx]">
                {childForm.avatar_url ? (
                  <Avatar
                    name={childForm.nickname || '子'}
                    avatarUrl={childForm.avatar_url}
                    size="md"
                  />
                ) : (
                  <View className="w-[68rpx] h-[68rpx] rounded-full bg-primary-5 border-[2rpx] border-dashed border-primary/40 center">
                    <Icon name="mdi-camera" size={28} color="primary" />
                  </View>
                )}
                <RowArrow />
              </View>
            }
          />
          {/* 昵称 */}
          <FieldRow
            label={
              <View className="flex items-center gap-[4rpx]">
                <Text className="text-[28rpx] text-muted-foreground">昵称</Text>
                <Text className="text-[28rpx] text-destructive">*</Text>
              </View>
            }
            right={
              <FormInput
                variant="ghost"
                placeholder="请输入"
                value={childForm.nickname}
                onInput={(e) =>
                  setChildForm((prev) => ({ ...prev, nickname: e.detail.value || '' }))
                }
              />
            }
          />
          {/* 关系 */}
          <FieldRow
            label={
              <View className="flex items-center gap-[4rpx]">
                <Text className="text-[28rpx] text-muted-foreground">关系</Text>
                <Text className="text-[28rpx] text-destructive">*</Text>
              </View>
            }
            right={
              <View
                className="flex items-center justify-end gap-[8rpx] press-scale"
                onClick={() => setSelector({ visible: true, type: 'relation' })}
              >
                <SelectValue value={childForm.relation} placeholder="请选择" />
                <RowArrow />
              </View>
            }
          />
          {/* 性别 */}
          <FieldRow
            label="性别"
            right={
              <View
                className="flex items-center justify-end gap-[8rpx] press-scale"
                onClick={() => setSelector({ visible: true, type: 'childGender' })}
              >
                <SelectValue
                  value={childForm.gender ? GENDER_LABEL[childForm.gender] : undefined}
                  placeholder="请选择"
                />
                <RowArrow />
              </View>
            }
          />
          {/* 生日 */}
          <FieldRow
            label="生日"
            right={
              <Picker
                mode="date"
                start="2000-01-01"
                end={dayjs().format('YYYY-MM-DD')}
                value={childForm.birthday}
                onChange={(e) => setChildForm((prev) => ({ ...prev, birthday: e.detail.value }))}
              >
                <View className="flex items-center justify-end gap-[8rpx]">
                  <SelectValue value={childForm.birthday} placeholder="请选择（选填）" />
                  <RowArrow />
                </View>
              </Picker>
            }
          />

          <View
            className={cn(
              'h-[96rpx] rounded-2xl center press-scale mt-[24rpx]',
              adding ? 'bg-muted' : 'bg-gradient-primary shadow-elegant',
            )}
            onClick={adding ? undefined : handleAddChild}
          >
            <Text className="text-[30rpx] font-semibold text-white">
              {adding ? '添加中...' : '确认添加'}
            </Text>
          </View>
        </View>
      </BottomSheet>

      {/* 统一弹窗选择器（PickerSheet 标准组件） */}
      <PickerSheet
        visible={selector.visible}
        title={selector.type === 'relation' ? '选择关系' : '选择性别'}
        options={
          selector.type === 'relation'
            ? RELATION_OPTIONS.map((r): PickerOption => ({ label: r, value: r }))
            : GENDER_OPTIONS.map((g): PickerOption => ({ label: g.label, value: g.value }))
        }
        value={
          selector.type === 'gender'
            ? draft.gender
            : selector.type === 'relation'
              ? childForm.relation
              : childForm.gender
        }
        onClose={() => setSelector((prev) => ({ ...prev, visible: false }))}
        onConfirm={(v) => {
          if (selector.type === 'gender') {
            updateField('gender', v as Gender);
          } else if (selector.type === 'relation') {
            // 关系与性别联动：儿子→男，女儿→女，其他→不修改
            let nextGender = childForm.gender;
            if (v === '儿子') nextGender = 'male';
            else if (v === '女儿') nextGender = 'female';
            setChildForm((prev) => ({ ...prev, relation: v, gender: nextGender }));
          } else {
            setChildForm((prev) => ({ ...prev, gender: v as Gender }));
          }
          setSelector((prev) => ({ ...prev, visible: false }));
        }}
      />
    </View>
  );
};

export default ProfileEdit;
