/**
 * 添加新身份页
 * 用于已登录用户新增一个身份（校长/教师/家长）
 * 流程：选择角色 → 补全角色信息 → 调用 addIdentity
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import ActionButton from '@/components/ActionButton';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import RoleCard from '@/components/RoleCard';
import type { ParentRoleInfo, PrincipalRoleInfo, TeacherRoleInfo, UserRole } from '@/types/profile';
import { useAuth } from '@/utils/auth';

const ROLE_OPTIONS: { role: UserRole; title: string; description: string }[] = [
  { role: 'principal', title: '我是校长/负责人', description: '创建并管理自己的培训机构' },
  { role: 'teacher', title: '我是教师', description: '管理班级、课程与学员信息' },
  { role: 'parent', title: '我是家长', description: '查看孩子学习进度与课程安排' },
];

const AddRole: React.FC = () => {
  const { identities, addIdentity } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  // 校长字段
  const [orgName, setOrgName] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // 教师字段
  const [campusCode, setCampusCode] = useState('');

  // 家长字段
  const [studentCode, setStudentCode] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const existingRoles = useMemo(() => new Set(identities.map((i) => i.role)), [identities]);

  const availableRoles = useMemo(
    () => ROLE_OPTIONS.filter((option) => !existingRoles.has(option.role)),
    [existingRoles],
  );

  const title = useMemo(() => {
    if (step === 1) return '选择新身份';
    switch (selectedRole) {
      case 'principal':
        return '完善机构信息';
      case 'teacher':
        return '绑定校区';
      case 'parent':
        return '绑定孩子';
      default:
        return '完善信息';
    }
  }, [step, selectedRole]);

  const handleBack = useCallback(() => {
    if (step === 2) {
      setStep(1);
      return;
    }
    Taro.navigateBack();
  }, [step]);

  const handleSelectRole = useCallback((role: UserRole) => {
    setSelectedRole(role);
    setStep(2);
  }, []);

  const validate = useCallback(() => {
    if (selectedRole === 'principal') {
      if (!orgName.trim()) {
        Taro.showToast({ title: '请输入机构名称', icon: 'none' });
        return false;
      }
      if (!contactPhone.trim()) {
        Taro.showToast({ title: '请输入负责人手机号', icon: 'none' });
        return false;
      }
      if (!/^1\d{10}$/.test(contactPhone.trim())) {
        Taro.showToast({ title: '请输入正确的手机号', icon: 'none' });
        return false;
      }
    }
    return true;
  }, [selectedRole, orgName, contactPhone]);

  const handleSubmit = useCallback(async () => {
    if (submitting || !selectedRole) return;
    if (!validate()) return;

    setSubmitting(true);
    let roleInfo: PrincipalRoleInfo | TeacherRoleInfo | ParentRoleInfo;
    if (selectedRole === 'principal') {
      roleInfo = {
        organizationName: orgName.trim(),
        organizationAddress: orgAddress.trim() || undefined,
        contactPhone: contactPhone.trim(),
      };
    } else if (selectedRole === 'teacher') {
      roleInfo = { campusCode: campusCode.trim().toUpperCase() || undefined };
    } else {
      roleInfo = { studentCode: studentCode.trim().toUpperCase() || undefined };
    }

    const { error } = await addIdentity(selectedRole, roleInfo);
    setSubmitting(false);

    if (error) {
      Taro.showToast({ title: error.message || '添加失败', icon: 'none' });
      return;
    }

    Taro.showToast({ title: '添加成功', icon: 'success' });
    setTimeout(() => {
      Taro.reLaunch({ url: '/pages/home/index' });
    }, 800);
  }, [
    submitting,
    selectedRole,
    validate,
    orgName,
    orgAddress,
    contactPhone,
    campusCode,
    studentCode,
    addIdentity,
  ]);

  return (
    <View className="min-h-screen flex flex-col bg-background">
      {/* 顶部导航 */}
      <View className="pt-safe px-page-padding">
        <View className="h-[88rpx] flex items-center">
          <View
            className="w-[64rpx] h-[64rpx] flex items-center justify-center"
            onClick={handleBack}
          >
            <Icon name="arrow-left" size={32} className="text-foreground" />
          </View>
          <Text className="text-[32rpx] font-semibold text-foreground ml-[16rpx]">{title}</Text>
        </View>
      </View>

      {/* 步骤 1：选择角色 */}
      {step === 1 && (
        <>
          <View className="px-page-padding flex-1">
            <View className="mt-[24rpx] mb-[48rpx]">
              <Text className="text-[36rpx] font-bold text-foreground mb-[12rpx]">添加新身份</Text>
              <Text className="text-[26rpx] text-muted-foreground">一个账号可以拥有多个身份</Text>
            </View>

            {availableRoles.length === 0 ? (
              <View className="flex flex-col items-center justify-center py-[80rpx]">
                <Text className="text-[28rpx] text-muted-foreground">您已拥有所有身份</Text>
              </View>
            ) : (
              <View className="space-y-[24rpx]">
                {availableRoles.map((option) => (
                  <RoleCard
                    key={option.role}
                    role={option.role}
                    title={option.title}
                    description={option.description}
                    selected={selectedRole === option.role}
                    mode="radio"
                    onClick={() => handleSelectRole(option.role)}
                  />
                ))}
              </View>
            )}
          </View>
        </>
      )}

      {/* 步骤 2：补全信息 */}
      {step === 2 && selectedRole && (
        <>
          <View className="px-page-padding flex-1">
            <View className="mt-[24rpx] mb-[48rpx]">
              <Text className="text-[36rpx] font-bold text-foreground mb-[12rpx]">{title}</Text>
              <Text className="text-[26rpx] text-muted-foreground">补充信息即可完成身份添加</Text>
            </View>

            {selectedRole === 'principal' && (
              <>
                <FormInput
                  label="机构名称"
                  placeholder="请输入机构名称"
                  value={orgName}
                  onInput={(e) => setOrgName(e.detail.value)}
                  className="mb-[24rpx]"
                />

                <FormInput
                  label="机构地址"
                  placeholder="请输入机构地址（选填）"
                  value={orgAddress}
                  onInput={(e) => setOrgAddress(e.detail.value)}
                  className="mb-[24rpx]"
                />

                <FormInput
                  label="负责人手机号"
                  placeholder="请输入负责人手机号"
                  value={contactPhone}
                  onInput={(e) => setContactPhone(e.detail.value)}
                  maxlength={11}
                />
              </>
            )}

            {selectedRole === 'teacher' && (
              <FormInput
                label="校区码"
                placeholder="请输入校区码（选填）"
                value={campusCode}
                onInput={(e) => setCampusCode(e.detail.value.toUpperCase())}
              />
            )}

            {selectedRole === 'parent' && (
              <FormInput
                label="学生邀请码"
                placeholder="请输入学生邀请码（选填）"
                value={studentCode}
                onInput={(e) => setStudentCode(e.detail.value.toUpperCase())}
              />
            )}
          </View>

          <View className="px-page-padding pb-[calc(48rpx+env(safe-area-inset-bottom))]">
            <ActionButton
              text={submitting ? '提交中...' : '完成添加'}
              onClick={handleSubmit}
              disabled={submitting}
            />
          </View>
        </>
      )}
    </View>
  );
};

export default AddRole;
