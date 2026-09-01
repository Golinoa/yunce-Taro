/**
 * 微信登录整链单飞（wx.login + POST /wechat-login）
 *
 * 对齐 request.ts refreshInFlight：防止跨页/连点导致同一 code 被重复 POST（40029）。
 * code 不落 Storage。
 */
import Taro from '@tarojs/taro';
import { wechatLogin, type WechatLoginOptions } from '@/services/auth';
import type { LoginResult } from '@/services/auth';

let wechatAuthTask: Promise<LoginResult> | null = null;
let wxLoginCodeTask: Promise<string> | null = null;

async function obtainWxLoginCode(): Promise<string> {
  if (wxLoginCodeTask) {
    return wxLoginCodeTask;
  }

  wxLoginCodeTask = (async () => {
    const { code } = await Taro.login();
    if (!code) {
      throw new Error('微信授权失败，请重试');
    }
    return code;
  })().finally(() => {
    wxLoginCodeTask = null;
  });

  return wxLoginCodeTask;
}

/** 测试专用：重置 module 级单飞状态 */
export function resetWechatLoginCoordinatorForTests(): void {
  wechatAuthTask = null;
  wxLoginCodeTask = null;
}

/**
 * wx.login + wechatLogin 作为一个原子任务单飞。
 * 失败后在 finally 释放，允许重试。
 */
export function performWechatAuth(options?: WechatLoginOptions): Promise<LoginResult> {
  if (wechatAuthTask) {
    return wechatAuthTask;
  }

  wechatAuthTask = (async () => {
    const code = await obtainWxLoginCode();
    return wechatLogin(code, options);
  })().finally(() => {
    wechatAuthTask = null;
  });

  return wechatAuthTask;
}
