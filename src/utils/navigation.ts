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

/**
 * 单飞 navigateTo：浮层按钮/列表项快速双击不再把两层相同页面压栈。
 * 背景（2026-09-19 场地事故）：双击「添加」FAB 压入两层相同表单，
 * 保存后 navigateBack 只关顶层，露出底层同款表单 —— 表现为「保存成功但没关闭页面」。
 * 仅锁同 URL：不同页面的连续导航不受影响。所有**推入表单型**入口必须使用本函数
 * （规则见 .harness/rules/50-state-and-types.md 校区数据条目同款约定）。
 */
let pendingNavigateUrl = '';

export function navigateToOnce(url: string): void {
  const normalizedUrl = normalizeUrl(url);
  if (pendingNavigateUrl === normalizedUrl) return;

  // 幂等护栏（2026-09-19 场地事故根因）：若当前栈顶已是目标页，直接忽略。
  // 仅靠上面的「同 tick 锁」挡不住**慢速双击**——navigateTo 的 complete 很快释放锁，
  // 第二下会再压入一层同款页面；写后 navigateBack 只退一层、露出底层同款表单，
  // 表现为「保存成功但没关页」（删除是单次点击进入，故不受影响，形成对照）。
  const pages = Taro.getCurrentPages?.() ?? [];
  const topRoute = (pages[pages.length - 1] as { route?: string } | undefined)?.route ?? '';
  const targetPath = normalizedUrl.split('?')[0].replace(/^\//, '');
  if (topRoute && (topRoute === targetPath || topRoute.endsWith(targetPath))) return;

  pendingNavigateUrl = normalizedUrl;
  Taro.navigateTo({
    url: normalizedUrl,
    complete: () => {
      if (pendingNavigateUrl === normalizedUrl) pendingNavigateUrl = '';
    },
  });
}
