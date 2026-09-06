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
import { View, Text, ScrollView, Picker, Button, Input, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import BindEmailSheet from '@/components/BindEmailSheet';
import BottomSheet from '@/components/BottomSheet';
import DatePickerSheet from '@/components/DatePickerSheet';
import Empty from '@/components/Empty';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import PickerSheet, { PickerOption } from '@/components/PickerSheet';
import { BRAND_LOGO } from '@/constants/brand';
import { lessonRecordService, packageService, studentService } from '@/services';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { resolveAvatarSrc } from '@/utils/avatar-src';
import { handleChooseAvatarError } from '@/utils/choose-avatar-error';
import {
  deleteTempImage,
  isImageCancelError,
  isLocalWechatFilePath,
  isTempImagePath,
  stabilizeAvatarLocalPath,
  uploadImage,
} from '@/utils/image-upload';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { usePrivacyForProfileFields } from '@/utils/use-privacy-for-profile-fields';

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

  const {
    profile,
    getProfileExtra: fetchExtra,
    updateProfile: submitUpdate,
    signOut,
    bindAccountEmail,
    sendBindEmailCode,
  } = useAuth();

  const { privacyReady, ensurePrivacy } = usePrivacyForProfileFields();

  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [showBindEmail, setShowBindEmail] = useState(false);
  const [bindingEmail, setBindingEmail] = useState(false);

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

  const boundEmail = profile?.email?.trim() || '';
  const handleBindEmail = useCallback(
    async (payload: { email: string; code: string; password: string }) => {
      if (bindingEmail) return;
      setBindingEmail(true);
      try {
        const { error } = await bindAccountEmail(payload.email, payload.code, payload.password);
        if (error) {
          Taro.showToast({ title: error.message || '绑定失败', icon: 'none' });
          return;
        }
        setShowBindEmail(false);
        Taro.showToast({ title: '邮箱已绑定', icon: 'success' });
      } finally {
        setBindingEmail(false);
      }
    },
    [bindAccountEmail, bindingEmail],
  );

  /** 个人头像：微信原生 chooseAvatar（含相册/拍照/微信头像） */
  const handleChooseAvatar = useCallback(
    async (event: { detail: { avatarUrl: string } }) => {
      const next = event.detail?.avatarUrl?.trim();
      if (!next) {
        Taro.showToast({ title: '未获取到头像', icon: 'none' });
        return;
      }
      try {
        const stablePath = await stabilizeAvatarLocalPath(next);
        if (isTempImagePath(draft.avatar_url)) deleteTempImage(draft.avatar_url);
        updateField('avatar_url', stablePath);
        Taro.showToast({ title: '头像已更新', icon: 'success' });
      } catch (err) {
        if (isImageCancelError(err)) return;
        const message = err instanceof Error ? err.message : '头像处理失败';
        Taro.showToast({ title: message, icon: 'none' });
      }
    },
    [draft.avatar_url, updateField],
  );

  const handleAvatarTap = useCallback(async () => {
    const ok = await ensurePrivacy();
    if (!ok) {
      Taro.showToast({
        title: '需要同意隐私保护指引后才能选择头像',
        icon: 'none',
        duration: 2800,
      });
    }
  }, [ensurePrivacy]);

  /** 已有头像：查看大图 / 删除（重选走 chooseAvatar 按钮） */
  const handleAvatarManage = useCallback(() => {
    if (!draft.avatar_url) {
      return;
    }
    void Taro.showActionSheet({
      itemList: ['查看图片', '删除头像'],
      success: (res) => {
        if (res.tapIndex === 0) {
          void Taro.previewImage({ current: draft.avatar_url, urls: [draft.avatar_url] });
        } else if (res.tapIndex === 1) {
          if (isTempImagePath(draft.avatar_url)) deleteTempImage(draft.avatar_url);
          updateField('avatar_url', '');
        }
      },
    });
  }, [draft.avatar_url, updateField]);

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
      let remoteAvatar = draft.avatar_url.trim();
      if (remoteAvatar && isLocalWechatFilePath(remoteAvatar)) {
        Taro.showLoading({ title: '上传头像...', mask: true });
        try {
          remoteAvatar = await uploadImage(remoteAvatar, 'avatar');
        } finally {
          Taro.hideLoading();
        }
      }

      const { error } = await submitUpdate({
        name: draft.nickname.trim(),
        nickname: draft.nickname.trim(),
        avatar_url: remoteAvatar || undefined,
        phone: draft.phone.trim(),
        gender: (draft.gender || undefined) as Gender | undefined,
        birthday: draft.birthday.trim(),
        id_card: draft.id_card.trim(),
        region: draft.region.trim(),
        address: draft.address.trim(),
      });
      if (error) {
        Taro.showToast({ title: error.message || '保存失败', icon: 'none' });
      } else {
        Taro.showToast({ title: '保存成功', icon: 'success' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败，请重试';
      Taro.showToast({ title: message, icon: 'none' });
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
          Taro.reLaunch({ url: '/package-auth/pages/login/index' });
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
      url: `/package-student/pages/child-detail/index?id=${encodeURIComponent(student.id)}`,
    });
  }, []);

  // 添加子女弹窗
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [childForm, setChildForm] = useState({
    name: '',
    nickname: '',
    relation: '',
    gender: '' as Gender | '',
    birthday: '',
    avatar_url: '',
  });
  const [selector, setSelector] = useState<{
    visible: boolean;
    type: 'gender' | 'relation' | 'childGender' | null;
  }>({ visible: false, type: null });
  const [datePickerTarget, setDatePickerTarget] = useState<'birthday' | 'childBirthday' | null>(
    null,
  );

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

  // 添加子女：手动建档 + StudentParent(BOUND)；也可通过邀请码绑定
  const handleAddChild = useCallback(async () => {
    const name = childForm.name.trim();
    if (!name) {
      Taro.showToast({ title: '请填写孩子姓名', icon: 'none' });
      return;
    }
    if (addingChild) return;
    setAddingChild(true);
    try {
      const created = await studentService.createMyChild({
        name,
        nickname: childForm.nickname.trim() || undefined,
        gender: childForm.gender || undefined,
        birthday: childForm.birthday || undefined,
        relation: childForm.relation || '子女',
      });
      setShowAddSheet(false);
      resetChildForm();
      Taro.showToast({
        title: created.reused ? '已关联同名子女' : '添加成功',
        icon: 'success',
      });
      await loadChildren();
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message || '')
          : '';
      Taro.showToast({ title: msg || '添加失败', icon: 'none' });
    } finally {
      setAddingChild(false);
    }
  }, [addingChild, childForm, loadChildren, resetChildForm]);

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
              {/* 头像：chooseAvatar 原生 sheet；已上传可查看/删除 */}
              <FieldRow
                label="头像"
                right={
                  <View className="flex items-center gap-[16rpx]">
                    {privacyReady ? (
                      <Button
                        className="w-[120rpx] h-[120rpx] rounded-full overflow-hidden p-0 m-0 after:border-none border-none bg-transparent active:opacity-90"
                        style={{ borderRadius: '50%', overflow: 'hidden' }}
                        plain
                        hoverClass="none"
                        openType="chooseAvatar"
                        onChooseAvatar={handleChooseAvatar}
                        onError={handleChooseAvatarError}
                      >
                        <Image
                          src={resolveAvatarSrc(draft.avatar_url || BRAND_LOGO)}
                          className="w-full h-full rounded-full"
                          style={{ borderRadius: '50%' }}
                          mode="aspectFill"
                        />
                      </Button>
                    ) : (
                      <View
                        className="w-[120rpx] h-[120rpx] rounded-full overflow-hidden active:opacity-90"
                        style={{ borderRadius: '50%', overflow: 'hidden' }}
                        onClick={handleAvatarTap}
                      >
                        <Image
                          src={resolveAvatarSrc(draft.avatar_url || BRAND_LOGO)}
                          className="w-full h-full rounded-full"
                          style={{ borderRadius: '50%' }}
                          mode="aspectFill"
                        />
                      </View>
                    )}
                    {draft.avatar_url ? (
                      <Text
                        className="text-[24rpx] text-primary press-scale"
                        onClick={handleAvatarManage}
                      >
                        管理
                      </Text>
                    ) : null}
                  </View>
                }
              />
              <FieldRow
                label="昵称"
                right={
                  privacyReady ? (
                    <View className="flex-1 flex flex-col items-end gap-[4rpx]">
                      <Input
                        key={`nickname-ready-${profile?.id ?? 'edit'}`}
                        type="nickname"
                        className="w-full text-[30rpx] text-foreground text-right"
                        placeholder="点此选用微信昵称，或直接输入"
                        defaultValue={draft.nickname}
                        onInput={(e) => updateField('nickname', e.detail.value || '')}
                        maxlength={20}
                      />
                      <Text className="text-[22rpx] text-muted-foreground">
                        可手改；点输入框可拉取微信昵称
                      </Text>
                    </View>
                  ) : (
                    <View
                      className="flex-1 flex items-center justify-end"
                      onClick={() => {
                        void ensurePrivacy();
                      }}
                    >
                      <Text className="text-[30rpx] text-muted-foreground">请先同意隐私指引</Text>
                    </View>
                  )
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
                label="绑定邮箱"
                onClick={boundEmail ? undefined : () => setShowBindEmail(true)}
                right={
                  boundEmail ? (
                    <Text className="text-[30rpx] text-foreground truncate">{boundEmail}</Text>
                  ) : (
                    <View className="flex items-center gap-[8rpx]">
                      <View className="rounded-full bg-primary/10 px-[24rpx] py-[8rpx]">
                        <Text className="text-[26rpx] font-semibold text-primary">去绑定</Text>
                      </View>
                      <RowArrow />
                    </View>
                  )
                }
              />
              <FieldRow
                label="生日"
                onClick={() => setDatePickerTarget('birthday')}
                right={
                  <View className="flex items-center justify-end gap-[8rpx]">
                    <SelectValue value={draft.birthday} placeholder="请选择生日" />
                    <RowArrow />
                  </View>
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

      {/* ====== 添加子女：手动建档 ====== */}
      <BottomSheet
        visible={showAddSheet}
        title="添加子女"
        onClose={() => {
          if (addingChild) return;
          setShowAddSheet(false);
        }}
        height="auto"
        maxHeightLimit="75vh"
      >
        <View className="px-[32rpx] pb-[40rpx]">
          <View className="bg-muted/40 rounded-2xl overflow-hidden mb-[24rpx]">
            <FieldRow
              label="姓名"
              right={
                <FormInput
                  variant="ghost"
                  placeholder="必填"
                  value={childForm.name}
                  maxlength={20}
                  onInput={(e) => setChildForm((prev) => ({ ...prev, name: e.detail.value || '' }))}
                />
              }
            />
            <FieldRow
              label="昵称"
              right={
                <FormInput
                  variant="ghost"
                  placeholder="选填"
                  value={childForm.nickname}
                  maxlength={20}
                  onInput={(e) =>
                    setChildForm((prev) => ({ ...prev, nickname: e.detail.value || '' }))
                  }
                />
              }
            />
            <FieldRow
              label="关系"
              right={
                <View
                  className="flex items-center justify-end gap-[8rpx] press-scale"
                  onClick={() => setSelector({ visible: true, type: 'relation' })}
                >
                  <SelectValue value={childForm.relation || undefined} placeholder="请选择" />
                  <RowArrow />
                </View>
              }
            />
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
            <FieldRow
              label="生日"
              right={
                <View
                  className="flex items-center justify-end gap-[8rpx] press-scale"
                  onClick={() => setDatePickerTarget('childBirthday')}
                >
                  <SelectValue value={childForm.birthday || undefined} placeholder="选填" />
                  <RowArrow />
                </View>
              }
            />
          </View>
          <Text className="text-[24rpx] text-muted-foreground leading-[1.5] mb-[24rpx] block">
            也可通过机构学员邀请码在「我的」页绑定已有档案。约课填写孩子后会自动出现在此列表。
          </Text>
          <View
            className={cn(
              'h-[96rpx] rounded-2xl center press-scale bg-gradient-primary shadow-elegant',
              addingChild && 'opacity-60',
            )}
            onClick={() => void handleAddChild()}
          >
            <Text className="text-[30rpx] font-semibold text-white">
              {addingChild ? '提交中…' : '确认添加'}
            </Text>
          </View>
        </View>
      </BottomSheet>

      {/* 统一弹窗选择器（PickerSheet 标准组件） */}
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

      <DatePickerSheet
        visible={Boolean(datePickerTarget)}
        title="选择生日"
        value={
          datePickerTarget === 'childBirthday'
            ? childForm.birthday || dayjs().format('YYYY-MM-DD')
            : draft.birthday || dayjs().format('YYYY-MM-DD')
        }
        onClose={() => setDatePickerTarget(null)}
        onConfirm={(date) => {
          if (datePickerTarget === 'childBirthday') {
            setChildForm((prev) => ({ ...prev, birthday: date }));
          } else {
            updateField('birthday', date);
          }
          setDatePickerTarget(null);
        }}
      />

      <BindEmailSheet
        visible={showBindEmail}
        submitting={bindingEmail}
        onClose={() => setShowBindEmail(false)}
        onSendCode={sendBindEmailCode}
        onSubmit={handleBindEmail}
      />
    </View>
  );
};

export default ProfileEdit;
