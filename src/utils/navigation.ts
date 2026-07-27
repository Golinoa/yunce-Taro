import Taro from '@tarojs/taro';

const TAB_BAR_PAGES = [
  '/pages/home/index',
  '/pages/schedule/index',
  '/pages/statistics/index',
  '/pages/profile/index',
];

const RE_LAUNCH_LOCK_MS = 1500;

let pendingReLaunchUrl = '';
let pendingReLaunchAt = 0;

function normalizeUrl(url: string) {
  return url.startsWith('/') ? url : `/${url}`;
}

export function isTabBarPage(path: string) {
  return TAB_BAR_PAGES.some((page) => path.includes(page));
}

export async function safeReLaunch(url: string) {
  const normalizedUrl = normalizeUrl(url);
  const now = Date.now();

  if (pendingReLaunchUrl === normalizedUrl && now - pendingReLaunchAt < RE_LAUNCH_LOCK_MS) {
    return;
  }

  pendingReLaunchUrl = normalizedUrl;
  pendingReLaunchAt = now;

  try {
    await Taro.reLaunch({ url: normalizedUrl });
  } catch {
    if (isTabBarPage(normalizedUrl)) {
      await Taro.switchTab({ url: normalizedUrl });
      return;
    }

    await Taro.redirectTo({ url: normalizedUrl });
  } finally {
    setTimeout(() => {
      if (pendingReLaunchUrl === normalizedUrl) {
        pendingReLaunchUrl = '';
        pendingReLaunchAt = 0;
      }
    }, RE_LAUNCH_LOCK_MS);
  }
}
