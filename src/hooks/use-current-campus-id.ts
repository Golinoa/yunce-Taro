/**
 * 当前校区 ID —— 全站「按校区取数」的唯一入口
 *
 * 背景（2026-09-24 统一数据源改造）：
 * 项目里曾经同时存在两个校区来源，导致「切了校区，列表还是旧校区数据」：
 *   1. `useCampusStore.currentCampusId` —— 用户在校区切换弹窗里选的（持久化）
 *   2. `profile.currentContext.campusId` —— 登录身份自带的归属校区
 * 后端多数列表接口（student/class/lead/schedule/statistics…）支持 campusId 过滤，
 * 不传时回落 `req.user!.campusId`（身份校区），于是只改 1 而取数用 2 或不传的页面都不会变。
 *
 * 规范：L1 所有按校区取数的地方一律用本 hook 取值；
 *      L2 缓存键（TanStack queryKey / zustand cacheKey）必须带上它；
 *      L3 调用 service 时显式传入它。
 *
 * 兜底：store 尚未初始化（冷启动 / 未选过校区）时回退身份校区，保证首帧行为不变。
 */
import { useCampusStore } from '@/stores/campus';
import { useAuth } from '@/utils/auth';

export function useCurrentCampusId(): string {
  const selectedCampusId = useCampusStore((s) => s.currentCampusId);
  const identityCampusId = useAuth().profile?.currentContext?.campusId;
  return selectedCampusId || identityCampusId || '';
}
