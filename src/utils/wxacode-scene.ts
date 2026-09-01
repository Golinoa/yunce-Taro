/**
 * 小程序码 scene ↔ inviteCode 编解码（与 BE wxacode.service 对齐）
 *
 * 官方：scene 经 query.scene 传入目标页，须 decodeURIComponent（Taro #3851）。
 * 社区：优先 key=value（c=CODE），便于扩展；冷启动时 fallback getLaunchOptionsSync().query.scene。
 */
import Taro, { getCurrentInstance } from '@tarojs/taro';
import { normalizeInviteCodeParam } from './invite-parent-link';
import { parseLaunchOptions } from './launch-scene';

const PREFIXED_INVITE = /^([SEP])[A-HJ-NP-Z2-9]{9}$/;

function decodeSceneRaw(raw: string): string {
  try {
    return decodeURIComponent(String(raw || '').trim());
  } catch {
    return String(raw || '').trim();
  }
}

/**
 * 从页面入参 / 冷启动 query / router 读取原始 scene 字符串（未解析 inviteCode）。
 * 调用方再交给 parseInviteCodeFromWxacodeScene。
 */
export function readWxacodeSceneParam(
  pageOptions?: Record<string, string | undefined> | null,
): string {
  const fromPage = pageOptions?.scene?.trim();
  if (fromPage) return fromPage;

  try {
    if (typeof Taro.getLaunchOptionsSync === 'function') {
      const launchQuery = parseLaunchOptions(Taro.getLaunchOptionsSync()).query;
      const fromLaunch = launchQuery.scene?.trim();
      if (fromLaunch) return fromLaunch;
    }
  } catch {
    // 低版本或部分真机 sync API 不可用
  }

  try {
    const routerScene = getCurrentInstance()?.router?.params?.scene;
    if (typeof routerScene === 'string' && routerScene.trim()) {
      return routerScene.trim();
    }
  } catch {
    // ignore
  }

  return '';
}

/** 扫码 scene → 可用于 share/context 的 inviteCode */
export function parseInviteCodeFromWxacodeScene(raw: string): string {
  const decoded = decodeSceneRaw(raw);

  const kvMatch = decoded.match(/^c=([A-Za-z0-9_-]+)$/i);
  if (kvMatch) {
    return normalizeInviteCodeParam(kvMatch[1]);
  }

  const upper = normalizeInviteCodeParam(decoded);
  if (PREFIXED_INVITE.test(upper)) {
    return upper;
  }

  const compact = upper.replace(/-/g, '');
  if (/^[A-F0-9]{32}$/.test(compact)) {
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`.toLowerCase();
  }

  return upper;
}

/**
 * 邀请落地页统一入口：?code= 优先，其次小程序码 scene（含冷启动 fallback）。
 */
export function resolveInviteCodeFromPageEntry(
  pageOptions?: Record<string, string | undefined> | null,
): string {
  const opt = pageOptions ?? {};
  const fromQuery = opt.code || opt.teacherCode || '';
  if (fromQuery) {
    return normalizeInviteCodeParam(fromQuery);
  }

  const sceneRaw = readWxacodeSceneParam(opt);
  if (sceneRaw) {
    return parseInviteCodeFromWxacodeScene(sceneRaw);
  }

  return '';
}

/** base64 PNG → 小程序 Image 可用 src */
export function buildWxacodeImageSrc(imageBase64: string | null | undefined): string {
  if (!imageBase64) return '';
  if (imageBase64.startsWith('data:image')) return imageBase64;
  return `data:image/png;base64,${imageBase64}`;
}
