/**
 * 小程序启动场景值工具
 *
 * 用于识别桌面图标、我的小程序、最近使用等快捷入口冷启动场景。
 * @see https://developers.weixin.qq.com/miniprogram/dev/reference/scene-list.html
 *
 * 注意：Android 从桌面再次进入时，系统可能**保留上一次** scene 而非 1023。
 */
import Taro from '@tarojs/taro';

/** 安卓系统桌面图标启动 */
export const SCENE_ANDROID_DESKTOP = 1023;

/** 我的小程序列表启动 */
export const SCENE_MY_MINI_PROGRAM = 1028;

/** 微信聊天主界面下拉「最近使用」栏（用户常误以为桌面快捷方式） */
export const SCENE_RECENT_USE_BAR = 1089;

/** 发现栏小程序主入口 */
export const SCENE_DISCOVER = 1001;

/** 冷启动后保护窗口（ms）：此期间避免弹窗 / 跳转 / 同步 Storage */
export const COLD_START_GRACE_MS = 2000;

let lastLaunchScene: number | undefined;
let appBootAt = Date.now();
let coldStartHandled = false;

export interface SafeLaunchOptions {
  scene: number;
  query: Record<string, string>;
  path: string;
}

/** 记录 App 冷启动时刻（useLaunch 首行调用） */
export function markAppColdStart(options?: Taro.getLaunchOptionsSync.LaunchOptions): void {
  if (coldStartHandled) {
    return;
  }
  coldStartHandled = true;
  appBootAt = Date.now();
  recordLaunchScene(parseLaunchOptions(options).scene);
}

/** 是否仍处于冷启动保护窗口 */
export function isColdStartGracePeriod(withinMs = COLD_START_GRACE_MS): boolean {
  return Date.now() - appBootAt < withinMs;
}

/** 记录本次冷启动 scene */
export function recordLaunchScene(scene: number): void {
  lastLaunchScene = scene;
}

/** 读取 useLaunch 写入的 scene（优先，无同步 API 调用） */
export function getLastLaunchScene(): number | undefined {
  return lastLaunchScene;
}

/**
 * 安全解析启动参数，避免 options.query / referrerInfo 为空时解构报错。
 */
export function parseLaunchOptions(
  options?: Partial<Taro.getLaunchOptionsSync.LaunchOptions> | null,
): SafeLaunchOptions {
  const scene = typeof options?.scene === 'number' ? options.scene : 0;
  const query =
    options?.query && typeof options.query === 'object'
      ? (options.query as Record<string, string>)
      : {};
  const path = typeof options?.path === 'string' ? options.path : '';
  return { scene, query, path };
}

/** 是否从桌面 / 我的小程序 / 最近使用等快捷入口进入 */
export function isShortcutEntryScene(scene: number): boolean {
  return (
    scene === SCENE_ANDROID_DESKTOP ||
    scene === SCENE_MY_MINI_PROGRAM ||
    scene === SCENE_RECENT_USE_BAR
  );
}

/** @deprecated 使用 isShortcutEntryScene */
export function isDesktopEntryScene(scene: number): boolean {
  return isShortcutEntryScene(scene);
}

/**
 * 从运行时读取 scene（仅在冷启动保护期结束后调用，避免过早 sync API）。
 */
export function readRuntimeScene(): number | undefined {
  if (isColdStartGracePeriod()) {
    return lastLaunchScene;
  }

  try {
    if (typeof Taro.getEnterOptionsSync === 'function') {
      const enterScene = Taro.getEnterOptionsSync()?.scene;
      if (typeof enterScene === 'number') {
        return enterScene;
      }
    }
    if (typeof Taro.getLaunchOptionsSync === 'function') {
      const launchScene = Taro.getLaunchOptionsSync()?.scene;
      if (typeof launchScene === 'number') {
        return launchScene;
      }
    }
  } catch {
    // 低版本或桌面冷启动时 sync API 可能不可用
  }
  return lastLaunchScene;
}

/** 当前是否从快捷入口冷启动 */
export function isShortcutEntryLaunch(): boolean {
  const scene = readRuntimeScene();
  return scene !== undefined && isShortcutEntryScene(scene);
}

/** @deprecated 使用 isShortcutEntryLaunch */
export function isDesktopEntryLaunch(): boolean {
  return isShortcutEntryLaunch();
}

/**
 * 冷启动日志（始终打印）。
 * 注意：weapp 构建 NODE_ENV=production，不能用 production 门控，否则真机永远看不到。
 * 桌面图标启动是独立进程，不会连到「真机调试」控制台；请用开发者工具「模拟 scene 1023」查看。
 */
export function logLaunchOptions(options?: Partial<Taro.getLaunchOptionsSync.LaunchOptions>): void {
  try {
    const parsed = parseLaunchOptions(options);
    // eslint-disable-next-line no-console
    console.warn('[App Launch]', parsed.scene, parsed.path, parsed.query);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[App Launch] parse failed', err);
  }
}
