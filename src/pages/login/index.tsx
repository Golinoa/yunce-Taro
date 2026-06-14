import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useEffect } from 'react';
import PageContainer from '@/components/PageContainer';
import type { UserRole } from '@/types/profile';
import { useAuth } from '@/utils/auth';
import { withRouteGuard, navigateAfterLogin } from '@/utils/route-guard';

/** 登录页 - 使用 UnoCSS 原子化类名，1:1 对齐原版 */
const Login: React.FC = () => {
  const { profile, signInWithUsername } = useAuth();

  const [role, setRole] = useState<UserRole>('teacher');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 已登录则跳转首页
  useEffect(() => {
    if (profile) {
      Taro.switchTab({ url: '/pages/home/index' });
    }
  }, [profile]);

  const onLoginClick = () => {
    if (submitting) return;

    if (!username.trim() || !password.trim()) {
      wx.showToast({ title: '请输入用户名和密码', icon: 'none' });
      return;
    }

    if (!agreed) {
      wx.showToast({ title: '请先同意用户协议和隐私政策', icon: 'none' });
      return;
    }

    setSubmitting(true);
    signInWithUsername(username.trim(), password.trim()).then(({ error }) => {
      setSubmitting(false);
      if (error) {
        wx.showToast({ title: error.message || '登录失败', icon: 'none' });
      } else {
        wx.setStorageSync('justLoggedIn', 'true');
        navigateAfterLogin();
      }
    });
  };

  return (
    <PageContainer safeTop>
      <View className="min-h-screen bg-gradient-subtle flex flex-col items-center px-6 py-12">
        {/* Logo 区域 */}
        <View className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-elegant mb-6 animate-float">
          <View className="i-mdi-book-open-page-variant text-white text-3xl" />
        </View>
        <Text className="text-3xl font-bold gradient-text mb-1">云策教务</Text>
        <Text className="text-lg text-muted-foreground mb-8">独立教师的贴心助手</Text>

        {/* 角色选择 */}
        <View className="flex gap-3 mb-6 w-full">
          <View
            className={`flex-1 py-3 rounded-2xl text-xl font-medium flex items-center justify-center leading-none ${role === 'teacher' ? 'bg-gradient-primary text-white shadow-elegant' : 'bg-white text-muted-foreground border-2 border-input'}`}
            onClick={() => setRole('teacher')}
          >
            <View className="i-mdi-teach mr-2 text-xl" />
            <Text>我是教师</Text>
          </View>
          <View
            className={`flex-1 py-3 rounded-2xl text-xl font-medium flex items-center justify-center leading-none ${role === 'parent' ? 'bg-gradient-accent text-white shadow-elegant' : 'bg-white text-muted-foreground border-2 border-input'}`}
            onClick={() => setRole('parent')}
          >
            <View className="i-mdi-account-heart mr-2 text-xl" />
            <Text>我是家长</Text>
          </View>
        </View>

        {/* 表单 */}
        <View className="w-full space-y-4">
          <View className="border-2 border-input rounded-2xl px-4 py-3 bg-background overflow-hidden shadow-soft">
            <Input
              className="w-full text-xl text-foreground"
              placeholder="用户名"
              value={username}
              onInput={(e) => setUsername(e.detail.value)}
            />
          </View>
          <View className="border-2 border-input rounded-2xl px-4 py-3 bg-background overflow-hidden shadow-soft">
            <Input
              className="w-full text-xl text-foreground"
              placeholder="密码"
              password
              value={password}
              onInput={(e) => setPassword(e.detail.value)}
            />
          </View>

          {/* 用户协议 */}
          <View className="flex items-start gap-2 mt-4" onClick={() => setAgreed(!agreed)}>
            <View
              className={`rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0_5 ${agreed ? 'bg-primary border-primary' : 'border-border'}`}
              style={{ width: '36rpx', height: '36rpx' }}
            >
              {agreed && <View className="i-mdi-check text-white text-sm" />}
            </View>
            <View className="flex flex-wrap text-base text-muted-foreground leading-relaxed">
              <Text>我已阅读并同意</Text>
              <Text
                className="text-primary font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  Taro.navigateTo({ url: '/pages/agreement/index' });
                }}
              >
                《用户协议》
              </Text>
              <Text>和</Text>
              <Text
                className="text-primary font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  Taro.navigateTo({ url: '/pages/agreement/index' });
                }}
              >
                《隐私政策》
              </Text>
            </View>
          </View>

          {/* 登录按钮 */}
          <View
            className={`w-full mt-6 btn-primary bg-gradient-primary text-white text-xl font-semibold shadow-elegant ${submitting ? 'state-loading' : ''}`}
            onClick={onLoginClick}
          >
            <Text>{submitting ? '登录中...' : '登录'}</Text>
          </View>

          {/* 注册链接 */}
          <View className="text-center mt-6">
            <Text
              className="text-primary text-lg"
              onClick={() => Taro.navigateTo({ url: `/pages/register/index?role=${role}` })}
            >
              还没有账号？去注册
            </Text>
          </View>
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(Login);
