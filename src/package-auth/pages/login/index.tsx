/**
 * 登录首页 - 登录布局与交互优化版
 * 保持原有配色，只调整登录方式切换、分阶段输入和错误兜底交互
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AgreementDialog from '@/components/AgreementDialog';
import Icon from '@/components/Icon';
import LoginDecisionDialog from '@/components/LoginDecisionDialog';
import LoginFlowPopover from '@/components/LoginFlowPopover';
import LoginIssueSheet from '@/components/LoginIssueSheet';
import {
  authCapabilities,
  checkLoginAccount,
  prepareEmailLogin,
  testAccounts,
  testPassword,
} from '@/services/auth';
import { useAgreementStore } from '@/stores/agreement';
import { ACCOUNT_RULE_TEXT, isAccountFormatValid, sanitizeAccountInput } from '@/utils/account';
import { useAuth } from '@/utils/auth';
import { navigateAfterLogin } from '@/utils/route-guard';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

type LoginMethod = 'wechat' | 'account' | 'email';
type AccountStep = 'account' | 'password';
type EmailStep = 'email' | 'code';
type ActivePopover = 'account' | 'password' | 'email' | 'code' | null;
type PendingAction = 'wechat' | 'account' | 'email' | null;
type DialogType =
  | 'none'
  | 'account-not-found'
  | 'password-error'
  | 'email-not-found'
  | 'email-not-bound';

interface DialogState {
  visible: boolean;
  type: DialogType;
  title: string;
  description: string;
  primaryText: string;
  secondaryText?: string;
}

interface LoginInputRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const FORGOT_ACCOUNT_PAGE = '/package-auth/pages/login/forgot-account/index';
const FORGOT_PASSWORD_PAGE = '/package-auth/pages/login/forgot-password/index';
const CONTACT_SUPPORT_PAGE = '/package-auth/pages/login/contact-support/index';

const LOGIN_OPTIONS: Array<{
  key: LoginMethod;
  label: string;
  icon: 'wechat' | 'account' | 'email';
}> = [
  { key: 'wechat', label: '微信登录', icon: 'wechat' },
  { key: 'account', label: '账户密码', icon: 'account' },
  { key: 'email', label: '邮箱登录', icon: 'email' },
];

const UNSUPPORTED_LOGIN_MESSAGE = '当前联调阶段仅开放微信登录';

const INITIAL_DIALOG_STATE: DialogState = {
  visible: false,
  type: 'none',
  title: '',
  description: '',
  primaryText: '',
};

const Login: React.FC = () => {
  const { profile, signInWithWechat, signInWithUsername, signInWithEmailCode } = useAuth();
  const { agreed, setAgreed } = useAgreementStore();
  const navHeight = useNavSafeHeight();

  const [currentMethod, setCurrentMethod] = useState<LoginMethod>('wechat');
  const [accountStep, setAccountStep] = useState<AccountStep>('account');
  const [emailStep, setEmailStep] = useState<EmailStep>('email');
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const [showAgreementDialog, setShowAgreementDialog] = useState(false);
  const [showIssueSheet, setShowIssueSheet] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [dialogState, setDialogState] = useState<DialogState>(INITIAL_DIALOG_STATE);
  const [wechatSubmitting, setWechatSubmitting] = useState(false);
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const [accountValue, setAccountValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [emailCodeValue, setEmailCodeValue] = useState('');
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [inputRect, setInputRect] = useState<LoginInputRect | null>(null);
  const [buttonRect, setButtonRect] = useState<LoginInputRect | null>(null);
  const isMockMode = testAccounts.length > 0;

  useEffect(() => {
    if (profile) {
      navigateAfterLogin(profile);
    }
  }, [profile]);

  const closeDialog = useCallback(() => {
    setDialogState(INITIAL_DIALOG_STATE);
  }, []);

  const openDialog = useCallback((nextState: Omit<DialogState, 'visible'>) => {
    setDialogState({ visible: true, ...nextState });
  }, []);

  const executeWechatLogin = useCallback(async () => {
    if (wechatSubmitting) return;

    setWechatSubmitting(true);
    try {
      const { code: wxCode } = await Taro.login();
      const { error } = await signInWithWechat(wxCode);
      if (error) {
        Taro.showToast({ title: error.message || '微信登录失败', icon: 'none' });
        setWechatSubmitting(false);
        return;
      }
      Taro.setStorageSync('justLoggedIn', 'true');
    } catch {
      Taro.showToast({ title: '微信登录失败', icon: 'none' });
      setWechatSubmitting(false);
    }
  }, [wechatSubmitting, signInWithWechat]);

  const executeAccountLogin = useCallback(async () => {
    if (accountSubmitting) return;

    setAccountSubmitting(true);
    const { error } = await signInWithUsername(accountValue.trim(), passwordValue.trim());
    setAccountSubmitting(false);

    if (error) {
      if (!authCapabilities.supportsAccountPasswordLogin) {
        Taro.showToast({ title: error.message || UNSUPPORTED_LOGIN_MESSAGE, icon: 'none' });
        return;
      }
      openDialog({
        type: 'password-error',
        title: '账户或密码错误',
        description: '账户或密码错误，请重新输入',
        primaryText: '重新输入',
        secondaryText: '邮箱验证码登录',
      });
      return;
    }

    Taro.setStorageSync('justLoggedIn', 'true');
  }, [accountSubmitting, accountValue, openDialog, passwordValue, signInWithUsername]);

  const executeEmailLogin = useCallback(async () => {
    if (emailSubmitting || !resolvedEmail) return;

    setEmailSubmitting(true);
    const { error } = await signInWithEmailCode(resolvedEmail, emailCodeValue.trim());
    setEmailSubmitting(false);

    if (error) {
      Taro.showToast({
        title:
          error.message ||
          (authCapabilities.supportsEmailCodeLogin ? '验证码错误' : UNSUPPORTED_LOGIN_MESSAGE),
        icon: 'none',
      });
      setActivePopover('code');
      return;
    }

    Taro.setStorageSync('justLoggedIn', 'true');
  }, [emailCodeValue, emailSubmitting, resolvedEmail, signInWithEmailCode]);

  const measureLoginLayout = useCallback((): Promise<{
    inputRect: LoginInputRect | null;
    buttonRect: LoginInputRect | null;
  }> => {
    return new Promise((resolve) => {
      const query = Taro.createSelectorQuery();
      query.select('#login-input-trigger').boundingClientRect();
      query.select('#login-primary-trigger').boundingClientRect();
      query.exec((res) => {
        const nextInputRect = res?.[0]
          ? {
              left: res[0].left,
              top: res[0].top,
              width: res[0].width,
              height: res[0].height,
            }
          : null;
        const nextButtonRect = res?.[1]
          ? {
              left: res[1].left,
              top: res[1].top,
              width: res[1].width,
              height: res[1].height,
            }
          : null;
        resolve({
          inputRect: nextInputRect,
          buttonRect: nextButtonRect,
        });
      });
    });
  }, []);

  const handleOpenCurrentPopover = useCallback(async () => {
    const { inputRect: nextInputRect, buttonRect: nextButtonRect } = await measureLoginLayout();
    setInputRect(nextInputRect);
    setButtonRect(nextButtonRect);

    if (currentMethod === 'account') {
      setActivePopover(accountStep === 'account' ? 'account' : 'password');
      return;
    }
    if (currentMethod === 'email') {
      setActivePopover(emailStep === 'email' ? 'email' : 'code');
      return;
    }
  }, [accountStep, currentMethod, emailStep, measureLoginLayout]);

  const handleClosePopover = useCallback(() => {
    setActivePopover(null);
  }, []);

  const handleSelectMethod = useCallback((method: LoginMethod) => {
    if (method === 'account' && !authCapabilities.supportsAccountPasswordLogin) {
      Taro.showToast({ title: UNSUPPORTED_LOGIN_MESSAGE, icon: 'none' });
      return;
    }

    if (method === 'email' && !authCapabilities.supportsEmailCodeLogin) {
      Taro.showToast({ title: UNSUPPORTED_LOGIN_MESSAGE, icon: 'none' });
      return;
    }

    setCurrentMethod(method);
    setActivePopover(null);
    if (method === 'wechat') {
      setInputRect(null);
      setButtonRect(null);
    }

    if (method === 'account') {
      setAccountStep('account');
      return;
    }

    if (method === 'email') {
      setEmailStep('email');
    }
  }, []);

  useEffect(() => {
    if (currentMethod === 'wechat') {
      setInputRect(null);
      setButtonRect(null);
      return;
    }

    Taro.nextTick(() => {
      void measureLoginLayout().then(({ inputRect: nextInputRect, buttonRect: nextButtonRect }) => {
        if (nextInputRect) {
          setInputRect(nextInputRect);
        }
        if (nextButtonRect) {
          setButtonRect(nextButtonRect);
        }
      });
    });
  }, [currentMethod, accountStep, emailStep, measureLoginLayout]);

  const handlePrepareEmailFromAccount = useCallback(async () => {
    const result = await prepareEmailLogin(accountValue.trim(), 'account');
    if (result.status === 'ready' && result.email) {
      setCurrentMethod('email');
      setEmailStep('code');
      setEmailValue(result.email);
      setResolvedEmail(result.email);
      setMaskedEmail(result.maskedEmail || result.email);
      setEmailCodeValue('');
      setActivePopover('code');
      Taro.showToast({
        title: `验证码已发送至${result.maskedEmail || result.email}`,
        icon: 'none',
      });
      return;
    }

    if (result.status === 'email_not_bound') {
      openDialog({
        type: 'email-not-bound',
        title: '未绑定邮箱',
        description: '该账户未绑定邮箱，请重新输入账户或切换其他登录方式',
        primaryText: '重新输入',
        secondaryText: '返回账户登录',
      });
      return;
    }

    openDialog({
      type: 'account-not-found',
      title: '账户不存在',
      description: '未找到该账户，请重新输入后再试',
      primaryText: '重新输入',
    });
  }, [accountValue, openDialog]);

  const handlePrimaryAction = useCallback(async () => {
    if (currentMethod === 'wechat') {
      if (!agreed) {
        setPendingAction('wechat');
        setShowAgreementDialog(true);
        return;
      }
      executeWechatLogin();
      return;
    }

    if (currentMethod === 'account') {
      if (accountStep === 'account') {
        if (!isAccountFormatValid(accountValue.trim())) {
          Taro.showToast({ title: `账号仅支持${ACCOUNT_RULE_TEXT}`, icon: 'none' });
          setActivePopover('account');
          return;
        }
        const result = await checkLoginAccount(accountValue.trim());
        if (!result.exists) {
          openDialog({
            type: 'account-not-found',
            title: '账户不存在',
            description: '未找到该账户，请重新输入后再试',
            primaryText: '重新输入',
          });
          return;
        }

        setAccountValue(result.account);
        setAccountStep('password');
        setActivePopover('password');
        return;
      }

      if (!passwordValue.trim()) {
        setActivePopover('password');
        return;
      }

      if (!agreed) {
        setPendingAction('account');
        setShowAgreementDialog(true);
        return;
      }

      executeAccountLogin();
      return;
    }

    if (emailStep === 'email') {
      const result = await prepareEmailLogin(emailValue.trim(), 'email');
      if (result.status === 'ready' && result.email) {
        setEmailValue(result.email);
        setResolvedEmail(result.email);
        setMaskedEmail(result.maskedEmail || result.email);
        setEmailStep('code');
        setEmailCodeValue('');
        setActivePopover('code');
        Taro.showToast({
          title: `验证码已发送至${result.maskedEmail || result.email}`,
          icon: 'none',
        });
        return;
      }

      openDialog({
        type: 'email-not-found',
        title: '邮箱不存在',
        description: '未找到该邮箱，请重新输入正确的邮箱地址',
        primaryText: '重新输入',
        secondaryText: '返回账户登录',
      });
      return;
    }

    if (!emailCodeValue.trim()) {
      setActivePopover('code');
      return;
    }

    if (!agreed) {
      setPendingAction('email');
      setShowAgreementDialog(true);
      return;
    }

    executeEmailLogin();
  }, [
    accountStep,
    accountValue,
    agreed,
    currentMethod,
    emailCodeValue,
    emailStep,
    emailValue,
    executeAccountLogin,
    executeEmailLogin,
    executeWechatLogin,
    openDialog,
    passwordValue,
  ]);

  const handleConfirmAgreement = useCallback(() => {
    setAgreed(true);
    setShowAgreementDialog(false);

    if (pendingAction === 'wechat') {
      executeWechatLogin();
    } else if (pendingAction === 'account') {
      executeAccountLogin();
    } else if (pendingAction === 'email') {
      executeEmailLogin();
    }

    setPendingAction(null);
  }, [executeAccountLogin, executeEmailLogin, executeWechatLogin, pendingAction, setAgreed]);

  const handleRegister = useCallback(() => {
    Taro.navigateTo({ url: '/package-auth/pages/register/index' });
  }, []);

  const handleFeedback = useCallback(() => {
    setShowIssueSheet(true);
  }, []);

  const handleOpenForgotAccount = useCallback(() => {
    setShowIssueSheet(false);
    Taro.navigateTo({ url: FORGOT_ACCOUNT_PAGE });
  }, []);

  const handleOpenForgotPassword = useCallback(() => {
    setShowIssueSheet(false);
    Taro.navigateTo({ url: FORGOT_PASSWORD_PAGE });
  }, []);

  const handleOpenContactSupport = useCallback(() => {
    setShowIssueSheet(false);
    Taro.navigateTo({ url: CONTACT_SUPPORT_PAGE });
  }, []);

  const handleDialogPrimary = useCallback(() => {
    const { type } = dialogState;
    closeDialog();

    if (type === 'account-not-found') {
      setCurrentMethod('account');
      setAccountStep('account');
      setPasswordValue('');
      setActivePopover('account');
      return;
    }

    if (type === 'password-error') {
      setCurrentMethod('account');
      setAccountStep('password');
      setPasswordValue('');
      setActivePopover('password');
      return;
    }

    if (type === 'email-not-found') {
      setCurrentMethod('email');
      setEmailStep('email');
      setEmailCodeValue('');
      setActivePopover('email');
      return;
    }

    if (type === 'email-not-bound') {
      setCurrentMethod('account');
      setAccountStep('account');
      setActivePopover('account');
    }
  }, [closeDialog, dialogState]);

  const handleDialogSecondary = useCallback(() => {
    const { type } = dialogState;
    closeDialog();

    if (type === 'password-error') {
      handlePrepareEmailFromAccount();
      return;
    }

    if (type === 'email-not-found') {
      setCurrentMethod('account');
      setAccountStep('account');
      setActivePopover('account');
      return;
    }

    if (type === 'email-not-bound') {
      setCurrentMethod('account');
      setAccountStep('account');
      setActivePopover('account');
    }
  }, [closeDialog, dialogState, handlePrepareEmailFromAccount]);

  const primaryButtonText = useMemo(() => {
    if (currentMethod === 'wechat') {
      return wechatSubmitting ? '登录中...' : '微信一键登录';
    }
    if (currentMethod === 'account') {
      if (accountStep === 'account') return '下一步';
      return accountSubmitting ? '登录中...' : '登录';
    }
    if (emailStep === 'email') return '下一步';
    return emailSubmitting ? '登录中...' : '登录';
  }, [accountStep, accountSubmitting, currentMethod, emailStep, emailSubmitting, wechatSubmitting]);

  const inputSummary = useMemo(() => {
    if (currentMethod === 'account') {
      if (accountStep === 'account') {
        return {
          value: accountValue,
          placeholder: '请输入登录账号',
        };
      }

      return {
        value: passwordValue ? '已输入密码' : '',
        placeholder: '请输入密码',
      };
    }

    return emailStep === 'email'
      ? {
          value: emailValue,
          placeholder: '请输入邮箱地址',
        }
      : {
          value: emailCodeValue ? `已发送至 ${maskedEmail || resolvedEmail}` : '',
          placeholder: '请输入邮箱验证码',
        };
  }, [
    accountStep,
    accountValue,
    currentMethod,
    emailCodeValue,
    emailStep,
    emailValue,
    maskedEmail,
    passwordValue,
    resolvedEmail,
  ]);

  const currentPopoverKey = useMemo<Exclude<ActivePopover, null> | null>(() => {
    if (activePopover) {
      return activePopover;
    }
    if (currentMethod === 'account') {
      return accountStep === 'account' ? 'account' : 'password';
    }
    if (currentMethod === 'email') {
      return emailStep === 'email' ? 'email' : 'code';
    }
    return null;
  }, [accountStep, activePopover, currentMethod, emailStep]);

  const currentPopoverProps = useMemo(() => {
    switch (currentPopoverKey) {
      case 'account':
        return {
          title: '输入登录账号',
          placeholder: '请输入登录账号',
          value: accountValue,
          password: false,
          type: 'text' as const,
          hint: `仅支持${ACCOUNT_RULE_TEXT}`,
          onChange: (value: string) => setAccountValue(sanitizeAccountInput(value)),
        };
      case 'password':
        return {
          title: '输入密码',
          placeholder: '请输入密码',
          value: passwordValue,
          password: true,
          type: 'text' as const,
          hint: '',
          onChange: setPasswordValue,
        };
      case 'email':
        return {
          title: '输入邮箱地址',
          placeholder: '请输入邮箱地址',
          value: emailValue,
          password: false,
          type: 'text' as const,
          hint: '',
          onChange: setEmailValue,
        };
      case 'code':
        return {
          title: '输入验证码',
          placeholder: '请输入邮箱验证码',
          value: emailCodeValue,
          password: false,
          type: 'number' as const,
          hint: maskedEmail
            ? `验证码已发送至 ${maskedEmail}，演示环境验证码为 123456`
            : '请输入邮箱验证码',
          onChange: setEmailCodeValue,
        };
      default:
        return null;
    }
  }, [accountValue, currentPopoverKey, emailCodeValue, emailValue, maskedEmail, passwordValue]);

  const otherLoginOptions = LOGIN_OPTIONS.filter((item) => item.key !== currentMethod);
  const isLoginLayoutReady =
    currentMethod === 'wechat' || (Boolean(inputRect) && Boolean(buttonRect));

  return (
    <View className="min-h-screen flex flex-col relative overflow-hidden">
      <View className="absolute inset-0 bg-login-gradient" />

      <View style={{ height: `${navHeight}px` }} className="relative z-10 flex-shrink-0" />

      <View className="relative z-10 flex-1 flex flex-col items-center justify-start pt-[88rpx]">
        <View className="absolute w-[420rpx] h-[420rpx] rounded-full bg-login-glow" />
        <View className="relative w-[220rpx] h-[220rpx] rounded-full bg-login-orb flex items-center justify-center mt-[14rpx]">
          <Icon name="school" size={120} className="text-primary" />
        </View>
      </View>

      <View
        className={cn(
          'relative z-10 px-[48rpx] pb-[40rpx]',
          currentMethod !== 'wechat' && '-mt-[72rpx]',
        )}
      >
        {currentMethod !== 'wechat' ? (
          <View className="pointer-events-none">
            <View id="login-input-trigger" className="mb-[32rpx] h-[96rpx]" />
          </View>
        ) : null}

        <View
          id="login-primary-trigger"
          className={cn(
            'h-[104rpx] rounded-full flex items-center justify-center mb-[24rpx]',
            currentMethod === 'wechat' ? '-mt-[108rpx]' : 'mt-0',
            currentMethod === 'wechat' ? 'bg-gradient-wechat shadow-wechat-btn' : '',
            'active:opacity-90',
            currentMethod !== 'wechat' && 'pointer-events-none opacity-0',
            (wechatSubmitting || accountSubmitting || emailSubmitting) && 'opacity-60',
          )}
          onClick={handlePrimaryAction}
        >
          {currentMethod === 'wechat' ? (
            <Text className={cn('text-[34rpx] font-semibold', 'text-white')}>
              {primaryButtonText}
            </Text>
          ) : null}
        </View>

        <View className="flex flex-col items-center mt-[24rpx] mb-[48rpx]">
          <Text className="text-[24rpx] text-muted-foreground mb-[24rpx]">其他登录方式</Text>
          <View className="flex flex-row items-center justify-center gap-[44rpx]">
            {otherLoginOptions.map((item) => (
              <View
                key={item.key}
                className="flex flex-col items-center gap-[12px] active:opacity-70"
                onClick={() => handleSelectMethod(item.key)}
              >
                <View className="w-[96rpx] h-[96rpx] rounded-full bg-muted flex items-center justify-center">
                  <Icon name={item.icon} size={44} className="text-primary" />
                </View>
                <Text className="text-[22rpx] text-muted-foreground">{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View className="relative z-10 px-[48rpx] pb-[32rpx]">
        <View className="flex items-center justify-center gap-[48rpx]">
          <Text className="text-[28rpx] text-primary" onClick={handleRegister}>
            注册账号
          </Text>
          <Text className="text-[28rpx] text-primary" onClick={handleFeedback}>
            遇到问题
          </Text>
        </View>
      </View>

      {isMockMode ? (
        <View className="relative z-10 px-[48rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))]">
          <View className="bg-card/80 rounded-[20rpx] px-[24rpx] py-[20rpx]">
            <Text className="text-[24rpx] text-muted-foreground font-medium mb-[12rpx] block">
              {`测试账号（密码均为 ${testPassword || '123456'}）：`}
            </Text>
            <View className="space-y-[8rpx]">
              {testAccounts.map((account) => (
                <Text key={account.username} className="text-[22rpx] text-muted-foreground block">
                  {`• ${account.label}：${account.username}`}
                </Text>
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {currentMethod !== 'wechat' && currentPopoverProps && isLoginLayoutReady ? (
        <LoginFlowPopover
          visible={Boolean(activePopover)}
          title={currentPopoverProps.title}
          placeholder={currentPopoverProps.placeholder}
          value={currentPopoverProps.value}
          summaryText={inputSummary.value || inputSummary.placeholder}
          password={currentPopoverProps.password}
          type={currentPopoverProps.type}
          hint={currentPopoverProps.hint}
          sourceRect={inputRect || undefined}
          buttonRect={buttonRect || undefined}
          submitText={primaryButtonText}
          onChange={currentPopoverProps.onChange}
          onOpen={handleOpenCurrentPopover}
          onSubmit={handlePrimaryAction}
          onClose={handleClosePopover}
        />
      ) : null}

      <LoginDecisionDialog
        visible={dialogState.visible}
        title={dialogState.title}
        description={dialogState.description}
        primaryText={dialogState.primaryText}
        secondaryText={dialogState.secondaryText}
        onPrimary={handleDialogPrimary}
        onSecondary={handleDialogSecondary}
        onClose={closeDialog}
      />

      <AgreementDialog
        visible={showAgreementDialog}
        variant="login-compact"
        onClose={() => {
          setShowAgreementDialog(false);
          setPendingAction(null);
        }}
        onConfirm={handleConfirmAgreement}
        confirmText="同意"
        cancelText="不同意"
      />

      <LoginIssueSheet
        visible={showIssueSheet}
        onClose={() => setShowIssueSheet(false)}
        onForgotAccount={handleOpenForgotAccount}
        onForgotPassword={handleOpenForgotPassword}
        onContactSupport={handleOpenContactSupport}
      />
    </View>
  );
};

export default Login;
