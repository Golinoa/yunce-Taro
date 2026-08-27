/**
 * 注册 Step3：完善角色信息
 * 对齐设计稿 04-register-step3-*.html
 * 顶部装饰背景 + 步骤指示器 + 角色头部 + 表单卡片 + 跳过按钮
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ActionButton from '@/components/ActionButton';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import RegisterStepper from '@/components/RegisterStepper';
import { authCapabilities } from '@/services/auth';
import type { ParentRoleInfo, PrincipalRoleInfo, TeacherRoleInfo, UserRole } from '@/types/profile';
import { useAuth } from '@/utils/auth';
import { navigateAfterLogin } from '@/utils/route-guard';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

/** 角色头部配置 */
const ROLE_HEADER_META: Record<
  UserRole,
  {
    title: string;
    subtitle: string;
    icon: string;
    gradientClass: string;
    pageTitle: string;
    pageSubtitle: string;
  }
> = {
  admin: {
    title: '管理员',
    subtitle: '机构管理员',
    icon: 'crown',
    gradientClass: 'bg-gradient-principal',
    pageTitle: '完善管理员信息',
    pageSubtitle: '创建您的机构，开始管理',
  },
  principal: {
    title: '校长',
    subtitle: '机构负责人',
    icon: 'crown',
    gradientClass: 'bg-gradient-principal',
    pageTitle: '完善校长信息',
    pageSubtitle: '创建您的机构，开始管理',
  },
  teacher: {
    title: '教师',
    subtitle: '授课教师',
    icon: 'book-open',
    gradientClass: 'bg-gradient-teacher',
    pageTitle: '完善教师信息',
    pageSubtitle: '绑定校区，开始授课',
  },
  assistant: {
    title: '助教',
    subtitle: '辅助教学',
    icon: 'book-open',
    gradientClass: 'bg-gradient-teacher',
    pageTitle: '完善助教信息',
    pageSubtitle: '绑定校区，协助教学',
  },
  parent: {
    title: '家长',
    subtitle: '学生家长',
    icon: 'account-group',
    gradientClass: 'bg-gradient-parent',
    pageTitle: '完善家长信息',
    pageSubtitle: '绑定孩子，查看学习进度',
  },
};

const RegisterRoleInfo: React.FC = () => {
  const { registerDraft, signUpStep3 } = useAuth();
  const navHeight = useNavSafeHeight();

  // 校长字段
  const [orgName, setOrgName] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // 教师字段
  const [campusCode, setCampusCode] = useState('');

  // 家长字段
  const [studentCode, setStudentCode] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const role = registerDraft?.role;

  // 必须先完成 Step2
  useEffect(() => {
    if (!registerDraft?.tempToken) {
      Taro.redirectTo({ url: '/package-auth/pages/register/index' });
      return;
    }
    if (!role) {
      Taro.redirectTo({ url: '/package-auth/pages/register/role-select' });
    }
  }, [registerDraft, role]);

  const headerMeta = useMemo(() => {
    if (!role) return null;
    return ROLE_HEADER_META[role];
  }, [role]);

  /** 跳过绑定，直接完成注册 */
  const handleSkip = useCallback(async () => {
    if (submitting || !role) return;

    setSubmitting(true);
    let roleInfo: PrincipalRoleInfo | TeacherRoleInfo | ParentRoleInfo;
    if (role === 'principal') {
      Taro.showToast({ title: '请填写必填信息', icon: 'none' });
      setSubmitting(false);
      return;
    } else if (role === 'teacher') {
      roleInfo = {};
    } else {
      roleInfo = {};
    }

    const { error } = await signUpStep3(roleInfo);
    setSubmitting(false);

    if (error) {
      Taro.showToast({ title: error.message || '注册失败', icon: 'none' });
      return;
    }

    Taro.showToast({ title: '注册成功', icon: 'success' });
    setTimeout(() => {
      navigateAfterLogin();
    }, 800);
  }, [submitting, role, signUpStep3]);

  const validate = useCallback(() => {
    if (role === 'principal') {
      if (!orgName.trim()) {
        Taro.showToast({ title: '请输入机构名称', icon: 'none' });
        return false;
      }
      if (authCapabilities.usesMockRegister) {
        if (!contactPhone.trim()) {
          Taro.showToast({ title: '请输入负责人手机号', icon: 'none' });
          return false;
        }
        if (!/^1\d{10}$/.test(contactPhone.trim())) {
          Taro.showToast({ title: '请输入正确的手机号', icon: 'none' });
          return false;
        }
      }
    }
    return true;
  }, [role, orgName, contactPhone]);

  const handleSubmit = useCallback(async () => {
    if (submitting || !role) return;
    if (!validate()) return;

    setSubmitting(true);
    let roleInfo: PrincipalRoleInfo | TeacherRoleInfo | ParentRoleInfo;
    if (role === 'principal') {
      roleInfo = {
        organizationName: orgName.trim(),
        organizationAddress: orgAddress.trim() || undefined,
        contactPhone: authCapabilities.usesMockRegister
          ? contactPhone.trim()
          : registerDraft?.phone || contactPhone.trim(),
      };
    } else if (role === 'teacher') {
      roleInfo = { campusCode: campusCode.trim().toUpperCase() || undefined };
    } else {
      roleInfo = { studentCode: studentCode.trim().toUpperCase() || undefined };
    }

    const { error } = await signUpStep3(roleInfo);
    setSubmitting(false);

    if (error) {
      Taro.showToast({ title: error.message || '注册失败', icon: 'none' });
      return;
    }

    Taro.showToast({ title: '注册成功', icon: 'success' });
    setTimeout(() => {
      navigateAfterLogin();
    }, 800);
  }, [
    submitting,
    role,
    validate,
    orgName,
    orgAddress,
    contactPhone,
    campusCode,
    studentCode,
    signUpStep3,
  ]);

  if (!role || !headerMeta) return null;

  return (
    <View className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* 顶部装饰背景：覆盖状态栏，统一颜色 */}
      <View className="absolute top-0 left-0 right-0 h-[440rpx] overflow-hidden bg-register-deco">
        <View className="absolute w-[360rpx] h-[360rpx] rounded-full bg-register-circle -top-[100rpx] -right-[100rpx]" />
      </View>

      {/* 导航安全区占位 */}
      <View style={{ height: `${navHeight}px` }} className="relative z-10 flex-shrink-0" />

      {/* 步骤指示器 */}
      <View className="relative px-page-padding mt-[16rpx] mb-[32rpx] z-10">
        <RegisterStepper current={3} />
      </View>

      {/* 表单内容 */}
      <View className="relative px-page-padding flex-1 z-10">
        {/* 标题 */}
        <View className="mb-[28rpx]">
          <Text className="text-[48rpx] font-bold text-foreground mb-[12rpx] block">
            {headerMeta.pageTitle}
          </Text>
          <Text className="text-[28rpx] text-muted-foreground">{headerMeta.pageSubtitle}</Text>
        </View>

        {/* 角色头部 */}
        <View className="flex items-center gap-[24rpx] mb-[32rpx]">
          <View
            className={`w-[96rpx] h-[96rpx] rounded-[28rpx] flex items-center justify-center flex-shrink-0 ${headerMeta.gradientClass}`}
          >
            <Icon name={headerMeta.icon} size={48} className="text-white" />
          </View>
          <View>
            <Text className="text-[32rpx] font-bold text-foreground block">{headerMeta.title}</Text>
            <Text className="text-[24rpx] text-muted-foreground mt-[4rpx] block">
              {headerMeta.subtitle}
            </Text>
          </View>
        </View>

        {/* 表单卡片 */}
        <View className="bg-card rounded-[24rpx] p-[28rpx] border-[2rpx] border-solid border-border-light shadow-card">
          {/* 分组标题 */}
          <View className="flex items-center gap-[16rpx] mb-[28rpx]">
            <View className="w-[8rpx] h-[28rpx] rounded-[4rpx] bg-primary" />
            <Text className="text-[30rpx] font-semibold text-foreground">
              {role === 'principal' ? '机构信息' : '绑定信息'}
            </Text>
          </View>

          {role === 'principal' && (
            <>
              <FormInput
                label="机构名称"
                required
                placeholder="请输入培训机构名称"
                value={orgName}
                onInput={(e) => setOrgName(e.detail.value)}
                className="mb-[24rpx]"
              />

              <FormInput
                label="机构地址"
                placeholder="请输入机构详细地址"
                value={orgAddress}
                onInput={(e) => setOrgAddress(e.detail.value)}
                className="mb-[24rpx]"
                hint="该地址将在活动页面展示给家长，请如实填写"
              />

              {authCapabilities.usesMockRegister && (
                <FormInput
                  label="负责人手机号"
                  required
                  placeholder="请输入11位手机号"
                  value={contactPhone}
                  onInput={(e) => setContactPhone(e.detail.value)}
                  maxlength={11}
                />
              )}
            </>
          )}

          {role === 'teacher' && (
            <>
              <FormInput
                label="校区码"
                placeholder="请输入校区码（选填）"
                value={campusCode}
                onInput={(e) => setCampusCode(e.detail.value.toUpperCase())}
                hint="输入校区码可绑定到对应校区，也可稍后在 App 内绑定"
              />
              {/* 提示框 */}
              <View className="flex items-start gap-[16rpx] p-[24rpx] rounded-[20rpx] mt-[24rpx] bg-register-hint-blue">
                <Icon
                  name="information"
                  size={32}
                  className="text-primary flex-shrink-0 mt-[2rpx]"
                />
                <Text className="text-[24rpx] text-muted-foreground leading-normal">
                  校区码由校长在校区设置中生成，一个校区一个码。如暂无校区码，可点击下方“稍后绑定”跳过。
                </Text>
              </View>
            </>
          )}

          {role === 'parent' && (
            <>
              <FormInput
                label="学生邀请码"
                placeholder="请输入学生邀请码（选填）"
                value={studentCode}
                onInput={(e) => setStudentCode(e.detail.value.toUpperCase())}
                hint="输入学生邀请码可绑定对应孩子，也可稍后在 App 内绑定"
              />
              {/* 提示框 */}
              <View className="flex items-start gap-[16rpx] p-[24rpx] rounded-[20rpx] mt-[24rpx] bg-register-hint-purple">
                <Icon
                  name="information"
                  size={32}
                  className="text-accent flex-shrink-0 mt-[2rpx]"
                />
                <Text className="text-[24rpx] text-muted-foreground leading-normal">
                  学生邀请码由教师在学员详情中生成，一个学员一个码，一次性使用。如暂无邀请码，可点击下方“稍后绑定”跳过。
                </Text>
              </View>
            </>
          )}
        </View>

        {/* 稍后绑定按钮（教师/家长可选跳过） */}
        {role !== 'principal' && (
          <View
            className="flex items-center justify-center gap-[8rpx] w-full h-[80rpx] border-[2rpx] border-dashed border-border rounded-[24rpx] mt-[24rpx]"
            onClick={handleSkip}
          >
            <Icon name="mdi-clock-outline" size={28} className="text-muted-foreground" />
            <Text className="text-[26rpx] text-muted-foreground">稍后绑定</Text>
          </View>
        )}
      </View>

      {/* 底部 */}
      <View className="relative px-page-padding pb-[calc(48rpx+env(safe-area-inset-bottom))] z-10">
        <ActionButton
          text={submitting ? '提交中...' : '完成注册'}
          onClick={handleSubmit}
          disabled={submitting}
        />
      </View>
    </View>
  );
};

export default RegisterRoleInfo;
