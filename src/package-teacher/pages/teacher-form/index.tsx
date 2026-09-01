/**
 * 老师详情 / 编辑页
 *
 * 用于新增或编辑员工信息，包含：
 * - 头像、身份、姓名、手机、性别、生日
 * - 老师简介
 * - 教师宣传图（最多 5 张，单张不超过 5M）
 * - 私教设置：是否展示在私教老师列表
 *
 * 进入编辑态时首次弹出「私教展示提醒」引导。
 */
import { View, Text, ScrollView, Switch, Image } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BindEmailSheet from '@/components/BindEmailSheet';
import DatePickerSheet from '@/components/DatePickerSheet';
import FormCell from '@/components/FormCell';
import FormInput from '@/components/FormInput';
import ImageUploaderList from '@/components/ImageUploaderList';
import Loading from '@/components/Loading';
import PageIntroSheet from '@/components/PageIntroSheet';
import PickerSheet from '@/components/PickerSheet';
import { BRAND_LOGO } from '@/constants/brand';
import { GENDER_OPTIONS, TEACHER_IDENTITY_OPTIONS } from '@/constants/teacher-ui';
import { auditLogService } from '@/services/audit-log';
import { subscribeMessageService } from '@/services/subscribe-message';
import { useTeacherStore } from '@/stores/teacher';
import { useThemeStore } from '@/stores/theme';
import { getThemeHexColors } from '@/theme';
import type { Gender, TeacherIdentity, TeacherUIModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { useThemedNavigationBar } from '@/utils/navigation-bar';

const INTRO_STORAGE_KEY = 'teacher_form_intro_v1';

interface FormState {
  identity: TeacherIdentity;
  name: string;
  phone: string;
  gender?: Gender;
  birthday: string;
  intro: string;
  promoImages: string[];
  showInPrivateList: boolean;
}

const EMPTY_FORM: FormState = {
  identity: 'teacher',
  name: '',
  phone: '',
  birthday: '',
  intro: '',
  promoImages: [],
  showInPrivateList: false,
};

const DEFAULT_IDENTITY_TO_ROLE: Record<TeacherIdentity, TeacherUIModel['role']> = {
  principal: 'lead',
  teacher: 'lead',
  assistant: 'assist',
  reception: 'parttime',
};

const TeacherFormPage: React.FC = () => {
  // 与「我的」页同款淡主题色头部
  useThemedNavigationBar((themeHex) => ({
    backgroundColor: themeHex.primarySoftBg,
    frontColor: '#000000',
  }));
  const { profile, bindAccountEmail, sendBindEmailCode } = useAuth();
  const { id } = useRouter().params;
  const isEdit = !!id;
  const { activeTheme } = useThemeStore();
  const { teachers, addTeacher, updateTeacher, fetchAll, loading } = useTeacherStore();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [showBindEmail, setShowBindEmail] = useState(false);
  const [bindingEmail, setBindingEmail] = useState(false);
  const [birthdayPickerVisible, setBirthdayPickerVisible] = useState(false);
  const [picker, setPicker] = useState<{
    type: 'identity' | 'gender';
    visible: boolean;
  }>({ type: 'identity', visible: false });
  const formInitializedRef = useRef(false);

  // 加载老师数据
  useEffect(() => {
    if (!isEdit) {
      setForm(EMPTY_FORM);
      formInitializedRef.current = true;
      // 新增时检查是否需要展示引导
      try {
        const stored = Taro.getStorageSync(INTRO_STORAGE_KEY);
        if (!stored) setShowIntro(true);
      } catch {
        setShowIntro(true);
      }
      return;
    }

    const teacher = teachers.find((t) => t.id === id);
    if (teacher) {
      setForm({
        identity: teacher.identity || 'teacher',
        name: teacher.name,
        phone: teacher.phone,
        gender: teacher.gender,
        birthday: teacher.birthday || '',
        intro: teacher.intro || '',
        promoImages: teacher.promoImages || [],
        showInPrivateList: teacher.showInPrivateList ?? teacher.role === 'lead',
      });
      formInitializedRef.current = true;
      // 编辑时检查是否需要展示引导
      try {
        const stored = Taro.getStorageSync(INTRO_STORAGE_KEY);
        if (!stored) setShowIntro(true);
      } catch {
        setShowIntro(true);
      }
    } else if (!loading && !formInitializedRef.current) {
      void fetchAll();
    }
  }, [id, isEdit, teachers, loading, fetchAll]);

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const displayIdentity = useMemo(
    () => TEACHER_IDENTITY_OPTIONS.find((o) => o.value === form.identity)?.label || '请选择',
    [form.identity],
  );
  const displayGender = useMemo(
    () => GENDER_OPTIONS.find((o) => o.value === form.gender)?.label || '请选择',
    [form.gender],
  );

  const validate = useCallback((): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) nextErrors.name = '请输入姓名';
    if (!form.phone.trim()) {
      nextErrors.phone = '请输入手机号';
    } else if (!/^1[3-9]\d{9}$/.test(form.phone.trim())) {
      nextErrors.phone = '手机号格式不正确';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [form]);

  const hasChanged = useMemo(() => {
    if (!isEdit) return true;
    const teacher = teachers.find((t) => t.id === id);
    if (!teacher) return true;
    return (
      form.identity !== (teacher.identity || 'teacher') ||
      form.name !== teacher.name ||
      form.phone !== teacher.phone ||
      form.gender !== teacher.gender ||
      form.birthday !== (teacher.birthday || '') ||
      form.intro !== (teacher.intro || '') ||
      form.showInPrivateList !== (teacher.showInPrivateList ?? teacher.role === 'lead') ||
      JSON.stringify(form.promoImages) !== JSON.stringify(teacher.promoImages || [])
    );
  }, [form, isEdit, id, teachers]);

  const handleSave = useCallback(async () => {
    if (!validate() || saving) return;
    setSaving(true);
    try {
      const identityLabel =
        TEACHER_IDENTITY_OPTIONS.find((o) => o.value === form.identity)?.label || '老师';
      const base: Partial<TeacherUIModel> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        identity: form.identity,
        gender: form.gender,
        birthday: form.birthday || undefined,
        intro: form.intro.trim(),
        promoImages: form.promoImages,
        showInPrivateList: form.showInPrivateList,
        role: DEFAULT_IDENTITY_TO_ROLE[form.identity],
        roleText: identityLabel,
      };

      if (isEdit && id) {
        await updateTeacher(id, base);
        Taro.showToast({ title: '保存成功', icon: 'success' });
      } else {
        await addTeacher({
          ...base,
          id: `t${Date.now()}`,
          accessScope: 'self',
          accessScopeText: '本人',
          subject: '',
          hours: 0,
          students: 0,
          classes: 0,
          base: 0,
          rate: 0,
          attend: 0,
          perf: 0,
          salaryStatus: 'pending',
          modelIdx: 1,
          color: 'success',
          initial: form.name[0] || '?',
          deductions: [],
          status: 'active',
        } as TeacherUIModel);
        // 审计日志（用户口径 2026-08-22）：新增教师属人事变更
        try {
          await auditLogService.record({
            action: 'staff.add',
            operatorId: profile?.id || '',
            operatorName: profile?.name || '未知',
            operatorRole: profile?.currentContext?.role || 'unknown',
            targetType: 'teacher',
            detail: `新增教师：「${base.name?.trim()}」（${identityLabel}）`,
            meta: { teacherName: base.name?.trim(), identity: form.identity },
          });
        } catch (e) {
          logError('audit staff.add', e);
        }
        Taro.showToast({ title: '添加成功', icon: 'success' });
        try {
          Taro.hideToast();
          await subscribeMessageService.runFlow('E11', {
            teacherName: base.name?.trim() || form.name.trim(),
            role: profile?.currentContext?.role,
            campusId: profile?.currentContext?.campusId,
          });
        } catch (error) {
          logError('subscribe E11 after teacher create', error);
        }
      }
      setTimeout(() => Taro.navigateBack(), 800);
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [form, isEdit, id, saving, validate, addTeacher, updateTeacher, profile]);

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

  if (isEdit && loading && !formInitializedRef.current) {
    return (
      <View
        className={cn(
          `theme-${activeTheme}`,
          'flex flex-col h-screen bg-background items-center justify-center',
        )}
      >
        <Loading text="加载老师信息中..." />
      </View>
    );
  }

  return (
    <View className={cn(`theme-${activeTheme}`, 'flex flex-col h-screen bg-background')}>
      <ScrollView scrollY enhanced scrollWithAnimation className="flex-1 pb-[200rpx]">
        {/* 头部：与「我的」同款淡主题弥散渐变 */}
        <View className="bg-gradient-diffuse-top px-[32rpx] pb-[32rpx] relative overflow-hidden">
          <View className="flex flex-col items-center pt-[24rpx] pb-[16rpx]">
            <View className="w-[160rpx] h-[160rpx] rounded-full p-[6rpx] border-[3rpx] border-border bg-card">
              <Image
                className="w-full h-full rounded-full"
                src={BRAND_LOGO}
                mode="aspectFill"
                lazyLoad
              />
            </View>
            <Text className="mt-[20rpx] text-[32rpx] font-bold text-foreground">
              {form.name || (isEdit ? '老师资料' : '新增老师')}
            </Text>
          </View>
        </View>

        <View className="px-[32rpx]">
          {/* 基础信息 */}
          <View className="bg-card rounded-[32rpx] px-[32rpx] mb-[24rpx]">
            <FormCell
              label="身份"
              divider
              showArrow
              onClick={() => setPicker({ type: 'identity', visible: true })}
            >
              <Text
                className={cn(
                  'text-[30rpx]',
                  form.identity ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {displayIdentity}
              </Text>
            </FormCell>

            <View>
              <FormCell label="姓名" divider>
                <FormInput
                  variant="ghost"
                  placeholder="必填项"
                  value={form.name}
                  onInput={(e) => updateField('name', e.detail.value)}
                  maxlength={20}
                />
              </FormCell>
              {errors.name && (
                <Text className="text-[24rpx] text-destructive mt-[8rpx] ml-[2rpx]">
                  {errors.name}
                </Text>
              )}
            </View>

            <View>
              <FormCell label="手机" divider>
                <FormInput
                  variant="ghost"
                  placeholder="必填项"
                  value={form.phone}
                  type="number"
                  maxlength={11}
                  onInput={(e) => updateField('phone', e.detail.value)}
                />
              </FormCell>
              {errors.phone && (
                <Text className="text-[24rpx] text-destructive mt-[8rpx] ml-[2rpx]">
                  {errors.phone}
                </Text>
              )}
            </View>

            <FormCell
              label="绑定邮箱"
              divider
              showArrow={!boundEmail}
              onClick={boundEmail ? undefined : () => setShowBindEmail(true)}
            >
              {boundEmail ? (
                <Text className="text-[30rpx] text-foreground">{boundEmail}</Text>
              ) : (
                <View
                  className="rounded-full bg-primary/10 px-[24rpx] py-[8rpx] active:opacity-80"
                  onClick={(e) => {
                    e.stopPropagation?.();
                    setShowBindEmail(true);
                  }}
                >
                  <Text className="text-[26rpx] font-semibold text-primary">去绑定</Text>
                </View>
              )}
            </FormCell>

            <FormCell
              label="性别"
              divider
              showArrow
              onClick={() => setPicker({ type: 'gender', visible: true })}
            >
              <Text
                className={cn(
                  'text-[30rpx]',
                  form.gender ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {displayGender}
              </Text>
            </FormCell>

            <FormCell label="生日" divider={false} onClick={() => setBirthdayPickerVisible(true)}>
              <Text
                className={cn(
                  'text-[30rpx]',
                  form.birthday ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {form.birthday || '选填项'}
              </Text>
            </FormCell>
          </View>

          {/* 老师简介 */}
          <View className="bg-card rounded-[32rpx] p-[32rpx] mb-[24rpx] flex flex-col gap-[20rpx]">
            <Text className="text-[30rpx] font-medium text-foreground">老师简介</Text>
            <FormInput
              multiline
              placeholder="暂无"
              value={form.intro}
              onInput={(e) => updateField('intro', e.detail.value)}
              minHeight="160rpx"
              inputClassName="text-[28rpx] leading-relaxed"
            />
          </View>

          {/* 教师宣传图 */}
          <View className="bg-card rounded-[32rpx] p-[32rpx] mb-[24rpx]">
            <View className="flex flex-row items-center justify-between mb-[20rpx]">
              <Text className="text-[30rpx] font-medium text-foreground">教师宣传图</Text>
            </View>
            <ImageUploaderList
              value={form.promoImages}
              onChange={(value) => updateField('promoImages', value)}
              maxCount={5}
              maxSizeMB={5}
              placeholder="上传"
            />
          </View>

          {/* 私教设置 — 信息分层：标题 + 状态指示 + 补充说明 */}
          <View className="bg-card rounded-[32rpx] p-[32rpx] mb-[24rpx]">
            <View className="flex flex-row items-start justify-between gap-[24rpx]">
              <View className="flex-1 flex flex-col gap-[8rpx]">
                <Text className="text-[30rpx] font-medium text-foreground">展示在私教老师列表</Text>
                {form.showInPrivateList ? (
                  <Text className="text-[24rpx] text-primary leading-relaxed">
                    开启后，该老师会出现在首页私教课程的可选老师列表
                  </Text>
                ) : (
                  <Text className="text-[24rpx] text-muted-foreground leading-relaxed">
                    关闭后，该老师将不会出现在首页私教课程的老师列表
                  </Text>
                )}
              </View>
              <Switch
                checked={form.showInPrivateList}
                onChange={(e) => updateField('showInPrivateList', e.detail.value)}
                color={getThemeHexColors(activeTheme).primary}
              />
            </View>
          </View>

          {isEdit ? (
            <View
              className="bg-card rounded-[32rpx] p-[32rpx] mb-[24rpx] flex flex-row items-center justify-between press-bg"
              onClick={() => {
                Taro.navigateTo({
                  url: `/package-teacher/pages/staff-invite/index?teacherId=${encodeURIComponent(String(id))}`,
                });
              }}
            >
              <View className="flex-1 min-w-0">
                <Text className="text-[30rpx] font-medium text-foreground block">邀请绑定微信</Text>
                <Text className="text-[24rpx] text-muted-foreground mt-[8rpx] block">
                  生成临时码，让员工微信绑定到本资料
                </Text>
              </View>
              <Text className="text-[26rpx] text-primary shrink-0">去邀请</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* 底部保存按钮 */}
      <View className="fixed left-0 right-0 bottom-0 bg-card px-[32rpx] pt-[16rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))] border-t-[2rpx] border-border">
        <View
          className={cn(
            'rounded-[48rpx] py-[26rpx] flex items-center justify-center',
            hasChanged && !saving ? 'bg-primary press-scale' : 'bg-muted',
          )}
          onClick={hasChanged && !saving ? handleSave : undefined}
        >
          <Text
            className={cn(
              'text-[32rpx] font-semibold',
              hasChanged && !saving ? 'text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            {saving ? '保存中...' : '保存'}
          </Text>
        </View>
      </View>

      <BindEmailSheet
        visible={showBindEmail}
        submitting={bindingEmail}
        onClose={() => setShowBindEmail(false)}
        onSendCode={sendBindEmailCode}
        onSubmit={handleBindEmail}
      />

      {/* 身份 / 性别选择器 */}
      <PickerSheet
        visible={picker.visible}
        title={picker.type === 'identity' ? '选择身份' : '选择性别'}
        options={picker.type === 'identity' ? TEACHER_IDENTITY_OPTIONS : GENDER_OPTIONS}
        value={picker.type === 'identity' ? form.identity : form.gender}
        onClose={() => setPicker((prev) => ({ ...prev, visible: false }))}
        onConfirm={(value) => {
          if (picker.type === 'identity') {
            updateField('identity', value as TeacherIdentity);
          } else {
            updateField('gender', value as Gender);
          }
        }}
      />

      {/* 私教展示引导弹窗 */}
      <PageIntroSheet
        visible={showIntro}
        onClose={() => setShowIntro(false)}
        storageKey={INTRO_STORAGE_KEY}
        stepLabel="员工管理"
        title="私教展示提醒"
        description="如果该员工不教私教课，请关闭下方「展示在私教老师列表」开关，避免首页私教老师列表出现无关员工。"
        bulletPoints={[
          '只有真的教私教课的员工，才建议保留开启。',
          '老师角色默认开启；前台和店长默认关闭。',
          '如果后续角色变化，可再手动调整这个开关。',
        ]}
        themeColor="primary"
      />

      <DatePickerSheet
        visible={birthdayPickerVisible}
        title="选择生日"
        value={form.birthday || dayjs().subtract(25, 'year').format('YYYY-MM-DD')}
        onClose={() => setBirthdayPickerVisible(false)}
        onConfirm={(date) => {
          updateField('birthday', date);
          setBirthdayPickerVisible(false);
        }}
      />
    </View>
  );
};

export default TeacherFormPage;
