import { View, Text, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useCallback, useEffect } from 'react';
import ActionButton from '@/components/ActionButton';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import type { UserRole } from '@/types/profile';
import { useAuth } from '@/utils/auth';
import { withRouteGuard } from '@/utils/route-guard';

/** 注册页 */
const Register: React.FC = () => {
  const { signUpWithUsername, signInWithUsername, validateInviteCode } = useAuth();

  const [role, setRole] = useState<UserRole>('teacher');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteCodeLocked, setInviteCodeLocked] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 从 URL 参数读取角色和邀请码
  const loadParams = useCallback(() => {
    const instance = Taro.getCurrentInstance();
    const params = instance?.router?.params || {};
    const paramRole = params.role || '';
    const paramInviteCode = params.inviteCode || '';

    if (paramRole === 'teacher' || paramRole === 'parent') {
      setRole(paramRole);
    }
    if (paramInviteCode) {
      const decoded = decodeURIComponent(paramInviteCode).toUpperCase();
      setInviteCode(decoded);
      setInviteCodeLocked(true);
    }
  }, []);

  useEffect(() => {
    loadParams();
  }, [loadParams]);
  useDidShow(() => {
    loadParams();
  });

  // 提交注册
  const handleSubmit = useCallback(async () => {
    if (!username.trim() || !password.trim() || !name.trim()) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }
    if (password.length < 6) {
      Taro.showToast({ title: '密码至少6位', icon: 'none' });
      return;
    }
    if (!agreed) {
      Taro.showToast({ title: '请先同意用户协议', icon: 'none' });
      return;
    }
    if (role === 'parent' && !inviteCode.trim()) {
      Taro.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }

    if (role === 'parent' && inviteCode.trim()) {
      setSubmitting(true);
      const result = await validateInviteCode(inviteCode.trim().toUpperCase());
      if (!result.valid) {
        setSubmitting(false);
        Taro.showToast({ title: '邀请码无效', icon: 'none' });
        return;
      }
    }

    setSubmitting(true);
    const { error: regError } = await signUpWithUsername(
      username.trim(),
      password.trim(),
      role,
      name.trim(),
      role === 'parent' ? inviteCode.trim().toUpperCase() : undefined,
    );

    if (regError) {
      setSubmitting(false);
      Taro.showToast({ title: regError.message || '注册失败', icon: 'none' });
      return;
    }

    const { error: loginError } = await signInWithUsername(username.trim(), password.trim());
    setSubmitting(false);

    if (loginError) {
      Taro.showToast({ title: '注册成功，请登录', icon: 'success' });
      setTimeout(() => Taro.redirectTo({ url: '/pages/login/index' }), 1500);
      return;
    }

    Taro.showToast({ title: '注册成功', icon: 'success' });
    Taro.setStorageSync('justLoggedIn', 'true');
    setTimeout(() => {
      Taro.reLaunch({ url: '/pages/home/index' });
    }, 1500);
  }, [
    username,
    password,
    name,
    role,
    inviteCode,
    agreed,
    signUpWithUsername,
    signInWithUsername,
    validateInviteCode,
  ]);

  return (
    <PageContainer safeTop>
      <View className="min-h-screen flex flex-col pt-8 pb-8 bg-gradient-subtle">
        {/* 标题 */}
        <Text className="text-[40rpx] font-bold gradient-text mb-6">注册账号</Text>

        {/* 角色选择 */}
        <View className="flex gap-3 mb-6">
          <View
            className={`flex-1 py-3 rounded-xl flex items-center justify-center press-scale ${role === 'teacher' ? 'bg-gradient-primary border-none shadow-elegant' : `bg-card border-2 border-input`} ${inviteCodeLocked ? 'state-disabled' : ''}`}
            onClick={() => {
              if (!inviteCodeLocked) setRole('teacher');
            }}
          >
            <Text
              className={`text-lg ${role === 'teacher' ? 'text-primary-foreground font-medium' : 'text-muted-foreground'}`}
            >
              我是教师
            </Text>
          </View>
          <View
            className={`flex-1 py-3 rounded-xl flex items-center justify-center press-scale ${role === 'parent' ? 'bg-gradient-accent border-none shadow-elegant' : 'bg-card border-2 border-input'}`}
            onClick={() => {
              if (!inviteCodeLocked) setRole('parent');
            }}
          >
            <Text
              className={`text-lg ${role === 'parent' ? 'text-accent-foreground font-medium' : 'text-muted-foreground'}`}
            >
              我是家长
            </Text>
          </View>
        </View>

        {/* 表单 */}
        <View>
          <View className="border-2 border-input rounded-xl py-3 px-4 bg-card shadow-soft overflow-hidden mb-3">
            <Input
              className="flex-1 text-lg text-foreground bg-transparent leading-normal"
              placeholder="用户名（仅字母、数字、下划线）"
              value={username}
              onInput={(e) => setUsername(e.detail.value)}
            />
          </View>

          <View className="border-2 border-input rounded-xl py-3 px-4 bg-card shadow-soft overflow-hidden mb-3">
            <Input
              className="flex-1 text-lg text-foreground bg-transparent leading-normal"
              placeholder="姓名"
              value={name}
              onInput={(e) => setName(e.detail.value)}
            />
          </View>

          <View className="border-2 border-input rounded-xl py-3 px-4 bg-card shadow-soft overflow-hidden mb-3">
            <Input
              className="flex-1 text-lg text-foreground bg-transparent leading-normal"
              placeholder="密码（至少6位）"
              password
              value={password}
              onInput={(e) => setPassword(e.detail.value)}
            />
          </View>

          {/* 家长邀请码 */}
          {role === 'parent' && (
            <View
              className={`border-2 border-input rounded-xl py-3 px-4 shadow-soft overflow-hidden mb-3 ${inviteCodeLocked ? 'bg-muted' : 'bg-card'}`}
            >
              <View className="flex items-center gap-2">
                <Input
                  className="flex-1 text-lg text-foreground bg-transparent leading-normal"
                  placeholder="学生邀请码"
                  value={inviteCode}
                  disabled={inviteCodeLocked}
                  onInput={(e) => {
                    if (!inviteCodeLocked) {
                      setInviteCode(e.detail.value.toUpperCase());
                    }
                  }}
                />
                {inviteCodeLocked && <Icon name="mdi-lock" size="sm" color="muted" />}
              </View>
            </View>
          )}

          {/* 用户协议 */}
          <View className="flex items-start gap-2 mb-5 mt-1">
            <View
              className={`w-[36rpx] h-[36rpx] min-w-[36rpx] rounded-sm border-2 flex items-center justify-center mt-[4rpx] flex-shrink-0 ${agreed ? 'bg-primary border-primary' : 'border-border'}`}
              onClick={() => setAgreed(!agreed)}
            >
              {agreed && <Text className="text-primary-foreground text-sm font-bold">✓</Text>}
            </View>
            <View className="flex flex-wrap text-sm text-muted-foreground leading-normal">
              <Text>我已阅读并同意</Text>
              <Text className="text-primary font-medium">《用户协议》</Text>
              <Text>和</Text>
              <Text className="text-primary font-medium">《隐私政策》</Text>
            </View>
          </View>

          {/* 注册按钮 */}
          <ActionButton
            text={submitting ? '注册中...' : '注册'}
            onClick={handleSubmit}
            disabled={submitting}
          />
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(Register);
