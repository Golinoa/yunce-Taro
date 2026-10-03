/**
 * 学员回收站（软删除的学员）
 *
 * 入口：学员页「学员操作」→ 回收站（在「门店黑名单」下面）。
 *
 * 设计口径（用户已定稿）：
 * - **极简卡片**：姓名 / 删除时间 / 剩余课时 / 有无家长 —— 课时数是老师判断
 *   「该不该恢复」的依据，也是防"课时莫名其妙没了"的凭据，必须显示；
 * - **恢复**：课时与上课记录原样回来（它们一直没被删过）；班级 / 课表 / 家长绑定
 *   在删除时已解除，需要重新办。原负责老师**仍在职** → 让用户选归还原老师还是归自己；
 *   **已离职** → 后端强制归操作人，前端不弹框；
 * - **彻底删除**：不可恢复，且**有剩余课时一律不给删**（后端 409 兜底）；
 *   弹窗里逐条列出会被一并清掉的流水，看清代价再点。
 */
import { View, Text, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import StudentDeleteSheet from '@/components/student/StudentDeleteSheet';
import { studentService } from '@/services/student';
import type { RecycleBinStudent, StudentDeletePreview } from '@/services/student';
import { REFRESH_SIGNAL, setRefreshSignal } from '@/utils/refresh-signal';
import { withRouteGuard } from '@/utils/route-guard';

const PAGE_SIZE = 20;

/** 删除时间：`YYYY-MM-DD HH:mm`（拿不到时间就给个占位，不显示 NaN） */
const formatDeletedAt = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

const RecycleBinPage: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [list, setList] = useState<RecycleBinStudent[]>([]);
  const [loading, setLoading] = useState(true);
  /** 首次加载失败：给出可见的错误态 + 重试，绝不静默转圈 */
  const [loadError, setLoadError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actingId, setActingId] = useState<null | string>(null);

  // 彻底删除的二次确认（带"会被清掉什么"的清单）
  const [purgeTarget, setPurgeTarget] = useState<null | RecycleBinStudent>(null);
  const [purgePreview, setPurgePreview] = useState<null | StudentDeletePreview>(null);
  const [purgeLoading, setPurgeLoading] = useState(false);

  const load = useCallback(async (nextPage: number, kw: string, append: boolean) => {
    setLoading(true);
    try {
      const result = await studentService.getRecycleBin({
        page: nextPage,
        pageSize: PAGE_SIZE,
        keyword: kw || undefined,
      });
      setList((prev) => (append ? [...prev, ...result.list] : result.list));
      setPage(result.pagination.page);
      setTotalPages(result.pagination.totalPages || 1);
      setLoadError(false);
    } catch {
      // 首次加载失败必须给出页面上的错误态：只 toast 一下的话，列表会一直转圈看不出问题
      if (!append) setLoadError(true);
      Taro.showToast({ title: '加载失败，请重试', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, []);

  /** 首挂载去重：挂载时 useEffect 已拉过一次，useDidShow 首次显示不再重复拉 */
  const isFirstMount = useRef(true);

  /**
   * 首屏必须在**挂载时**就发起请求，不能只靠 useDidShow。
   *
   * 原因：`withRouteGuard` 在拿到 profile 之前渲染的是 Loading 占位（页面本体不挂载），
   * 而 Taro 的 `useDidShow` 是在挂载时才把回调注册进页面实例、**且不会补触发已过去的
   * onShow**。守卫放行必然晚于页面 onShow（要等 auth 就绪），于是这次 onShow 永远
   * 收不到 ⇒ 只靠 useDidShow 取数的页面会一直停在「加载中」。
   */
  useEffect(() => {
    // 用原生导航栏（自带返回），页面内不自绘；标题在这里设
    void Taro.setNavigationBarTitle({ title: '回收站' });
    void load(1, '', false);
  }, [load]);

  /** 再次进入本页时刷新（子页/其它页改过数据）；首挂载跳过，避免重复拉一次 */
  useDidShow(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    void load(1, keyword, false);
  });

  /** 恢复：先问归属（仅当原老师在职），再恢复 */
  const handleRestore = useCallback(
    async (item: RecycleBinStudent) => {
      let assignee: 'me' | 'original' = 'original';
      if (item.originalTeacherActive) {
        try {
          const res = await Taro.showActionSheet({
            itemList: [
              item.originalTeacherName ? `归还原老师（${item.originalTeacherName}）` : '归还原老师',
              '归给我',
            ],
          });
          assignee = res.tapIndex === 1 ? 'me' : 'original';
        } catch {
          return; // 用户取消
        }
      }

      setActingId(item.id);
      try {
        await studentService.restore(item.id, assignee);
        setRefreshSignal(REFRESH_SIGNAL.students);
        Taro.showToast({ title: '已恢复', icon: 'success' });
        await load(1, keyword, false);
      } catch {
        Taro.showToast({ title: '恢复失败，请重试', icon: 'none' });
      } finally {
        setActingId(null);
      }
    },
    [keyword, load],
  );

  const handleOpenPurge = useCallback(async (item: RecycleBinStudent) => {
    setPurgeTarget(item);
    setPurgePreview(null);
    setPurgeLoading(true);
    try {
      const preview = await studentService.getDeletePreview(item.id);
      setPurgePreview(preview);
    } catch {
      setPurgeTarget(null);
      Taro.showToast({ title: '检查失败，请重试', icon: 'none' });
    } finally {
      setPurgeLoading(false);
    }
  }, []);

  const handleConfirmPurge = useCallback(async () => {
    if (!purgeTarget) return;
    setActingId(purgeTarget.id);
    try {
      await studentService.purge(purgeTarget.id);
      setRefreshSignal(REFRESH_SIGNAL.students);
      Taro.showToast({ title: '已彻底删除', icon: 'success' });
      setPurgeTarget(null);
      await load(1, keyword, false);
    } catch {
      // 后端会拦住"还有剩余课时"的学员（409），如实提示
      Taro.showToast({ title: '该学员还有剩余课时，不能彻底删除', icon: 'none' });
    } finally {
      setActingId(null);
    }
  }, [purgeTarget, keyword, load]);

  return (
    <PageContainer>
      {/* 标题与返回都用原生导航栏（app.config 里配了「回收站」），页面内不再自绘 */}

      {/* 搜索 */}
      <View className="px-[32rpx] pt-[24rpx] pb-[20rpx]">
        <Input
          className="h-[76rpx] rounded-[16rpx] bg-muted px-[24rpx] text-[27rpx] text-foreground"
          placeholder="搜索学员姓名 / 手机号"
          placeholderClass="text-muted-foreground"
          value={keyword}
          confirmType="search"
          onInput={(e) => setKeyword(e.detail.value)}
          onConfirm={() => load(1, keyword, false)}
        />
      </View>

      <View className="px-[32rpx] pb-[40rpx]">
        {loading && list.length === 0 ? (
          <Loading text="加载中..." />
        ) : loadError && list.length === 0 ? (
          <Empty
            icon="mdi-cloud-off-outline"
            description="加载失败，请检查网络后重试"
            actionText="重新加载"
            onAction={() => void load(1, keyword, false)}
          />
        ) : list.length === 0 ? (
          <Empty icon="mdi-delete-outline" description="回收站是空的" />
        ) : (
          <>
            {list.map((item) => (
              <View
                key={item.id}
                className="mb-[20rpx] rounded-[20rpx] bg-white px-[24rpx] py-[24rpx]"
              >
                <View className="flex items-center justify-between">
                  <Text className="text-[30rpx] font-semibold text-foreground">{item.name}</Text>
                  <Text className="text-[24rpx] text-muted-foreground">
                    {formatDeletedAt(item.deletedAt)} 删除
                  </Text>
                </View>

                <View className="mt-[10rpx] flex items-center gap-[20rpx]">
                  <Text
                    className={cn(
                      'text-[26rpx]',
                      item.remainingHours > 0
                        ? 'font-medium text-warning'
                        : 'text-muted-foreground',
                    )}
                  >
                    剩余 {item.remainingHours} 课时
                  </Text>
                  <Text className="text-[26rpx] text-muted-foreground">
                    {item.parentCount > 0 ? `已绑 ${item.parentCount} 位家长` : '未绑家长'}
                  </Text>
                </View>

                {item.originalTeacherName ? (
                  <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
                    原归属：{item.originalTeacherName}
                    {item.originalTeacherActive ? '' : '（已离职）'}
                  </Text>
                ) : null}

                <View className="mt-[20rpx] flex gap-[16rpx]">
                  <View
                    className={cn(
                      'flex-1 h-[76rpx] rounded-[14rpx] bg-primary flex items-center justify-center',
                      actingId === item.id ? 'opacity-60' : 'active:opacity-90',
                    )}
                    onClick={() => {
                      if (actingId) return;
                      void handleRestore(item);
                    }}
                  >
                    <Text className="text-[27rpx] font-semibold text-primary-foreground">恢复</Text>
                  </View>
                  <View
                    className={cn(
                      'flex-1 h-[76rpx] rounded-[14rpx] bg-muted flex items-center justify-center',
                      actingId === item.id ? 'opacity-60' : 'active:opacity-80',
                    )}
                    onClick={() => {
                      if (actingId) return;
                      void handleOpenPurge(item);
                    }}
                  >
                    <Text className="text-[27rpx] font-medium text-destructive">彻底删除</Text>
                  </View>
                </View>
              </View>
            ))}

            {page < totalPages ? (
              <View
                className="py-[28rpx] flex items-center justify-center"
                onClick={() => {
                  if (loading) return;
                  void load(page + 1, keyword, true);
                }}
              >
                <Text className="text-[26rpx] text-primary">
                  {loading ? '加载中...' : '加载更多'}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>

      {/* 彻底删除：红色二次确认 + 会被清掉的流水清单 */}
      <StudentDeleteSheet
        visible={Boolean(purgeTarget)}
        studentName={purgeTarget?.name ?? ''}
        preview={purgePreview}
        mode="purge"
        loading={purgeLoading}
        submitting={Boolean(actingId)}
        onClose={() => {
          if (actingId) return;
          setPurgeTarget(null);
        }}
        onFreeze={() => undefined}
        onConfirm={() => void handleConfirmPurge()}
      />
    </PageContainer>
  );
};

export default withRouteGuard(RecycleBinPage);
