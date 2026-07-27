import { View, Text, Input, ScrollView, Image } from '@tarojs/components';
import Taro, { useLoad, useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { homeService } from '@/services';
import { useAuth } from '@/utils/auth';

interface MemberItem {
  id: string;
  name: string;
  phone?: string;
  avatar_url?: string;
}

/**
 * 选择会员页面
 *
 * 从「添加代约」页面进入，支持搜索、排序、多选会员，
 * 选择完成后通过本地存储将结果回传给上一页。
 */

const RESULT_STORAGE_KEY = 'yunce:proxy-member-select:result';

interface PageParams {
  teacherId?: string;
  excludedIds?: string;
}

interface SelectedMember {
  id: string;
  name: string;
  avatarUrl?: string;
  phone?: string;
}

const ProxyMemberSelectPage: React.FC = () => {
  const { profile } = useAuth();
  const campusId = profile?.currentContext?.campusId || '';

  const [params, setParams] = useState<PageParams>({});
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useLoad((options) => {
    const opt = options as Record<string, string>;
    setParams({
      teacherId: opt.teacherId,
      excludedIds: opt.excludedIds ? decodeURIComponent(opt.excludedIds) : undefined,
    });
  });

  // 页面显示时清空上一次可能残留的存储结果
  useDidShow(() => {
    try {
      Taro.removeStorageSync(RESULT_STORAGE_KEY);
    } catch {
      // 忽略清理失败
    }
  });

  useEffect(() => {
    const loadMembers = async () => {
      const teacherId = params.teacherId;
      if (!teacherId || !campusId) return;
      setLoading(true);
      try {
        const list = (await homeService.getStudents(teacherId, 200)) as MemberItem[];
        const excludedSet = new Set(
          (params.excludedIds || '')
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean),
        );
        setMembers(list.filter((item) => !excludedSet.has(item.id)));
      } catch {
        Taro.showToast({ title: '加载会员失败', icon: 'none' });
      } finally {
        setLoading(false);
      }
    };
    void loadMembers();
  }, [campusId, params.excludedIds, params.teacherId]);

  const filteredMembers = useMemo(() => {
    if (!keyword.trim()) return members;
    const kw = keyword.trim().toLowerCase();
    return members.filter(
      (item) =>
        item.name.toLowerCase().includes(kw) ||
        (item.phone && item.phone.toLowerCase().includes(kw)),
    );
  }, [keyword, members]);

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const selectedMembers: SelectedMember[] = members
      .filter((item) => selectedIds.has(item.id))
      .map((item) => ({
        id: item.id,
        name: item.name,
        avatarUrl: item.avatar_url || undefined,
        phone: item.phone || undefined,
      }));

    try {
      Taro.setStorageSync(RESULT_STORAGE_KEY, JSON.stringify(selectedMembers));
    } catch {
      Taro.showToast({ title: '保存选择失败', icon: 'none' });
      return;
    }
    void Taro.navigateBack();
  }, [members, selectedIds]);

  return (
    <View className="flex h-screen flex-col bg-background">
      {/* 搜索框 + 排序 */}
      <View className="flex-shrink-0 px-[24rpx] py-[16rpx]">
        <View className="flex items-center gap-[16rpx]">
          <View className="flex flex-1 items-center gap-[16rpx] rounded-[36rpx] bg-card px-[24rpx] py-[16rpx]">
            <Icon name="mdi-magnify" size="sm" color="#94a3b8" />
            <Input
              className="flex-1 text-[28rpx] text-foreground"
              placeholder="搜索你要代约的会员"
              placeholderClass="text-muted-foreground"
              value={keyword}
              onInput={(e) => setKeyword(e.detail.value || '')}
              confirmType="search"
            />
          </View>
          <View className="flex items-center gap-[6rpx] px-[12rpx] py-[8rpx]">
            <Text className="text-[26rpx] text-foreground">排序·加入时间</Text>
            <Icon name="mdi-arrow-down" size={18} color="#999999" />
          </View>
        </View>
      </View>

      {/* 会员列表 */}
      <ScrollView scrollY className="min-h-0 flex-1 px-[24rpx]">
        <View className="flex flex-col gap-[16rpx] pb-[24rpx]">
          {filteredMembers.map((item) => {
            const checked = selectedIds.has(item.id);
            return (
              <View
                key={item.id}
                className="flex items-center gap-[20rpx] rounded-[24rpx] bg-card px-[24rpx] py-[24rpx]"
                onClick={() => handleToggle(item.id)}
              >
                {item.avatar_url ? (
                  <Image
                    className="h-[72rpx] w-[72rpx] flex-shrink-0 rounded-full"
                    src={item.avatar_url}
                    mode="aspectFill"
                  />
                ) : (
                  <View className="center h-[72rpx] w-[72rpx] flex-shrink-0 rounded-full bg-muted">
                    <Text className="text-[28rpx] font-medium text-muted-foreground">
                      {item.name.slice(0, 1)}
                    </Text>
                  </View>
                )}
                <View className="min-w-0 flex-1">
                  <View className="flex items-center gap-[12rpx]">
                    <Text className="text-[30rpx] font-medium text-foreground">{item.name}</Text>
                    <Icon name="mdi-gender-female" size={24} color="#ff8a4c" />
                  </View>
                  {item.phone && (
                    <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
                      {item.phone}
                    </Text>
                  )}
                </View>
                <View
                  className={cn(
                    'center h-[40rpx] w-[40rpx] flex-shrink-0 rounded-full border-[3rpx]',
                    checked ? 'border-[#ff8a4c] bg-[#ff8a4c]' : 'border-[#cccccc] bg-white',
                  )}
                >
                  {checked && <Icon name="mdi-check" size={20} className="text-white" />}
                </View>
              </View>
            );
          })}
          {filteredMembers.length === 0 && !loading && (
            <View className="rounded-[20rpx] bg-card px-[24rpx] py-[48rpx]">
              <Text className="text-center text-[26rpx] text-muted-foreground">未找到匹配会员</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 底部确认按钮 */}
      <View className="flex-shrink-0 border-t border-border-light bg-white px-[32rpx] pb-safe-bar pt-[20rpx]">
        <View className="flex items-center justify-between gap-[24rpx]">
          <View className="flex items-baseline gap-[4rpx]">
            <Text className="text-[28rpx] text-foreground">已选</Text>
            <Text className="text-[32rpx] font-bold text-[#ff8a4c]">{selectedIds.size}</Text>
            <Text className="text-[28rpx] text-foreground">人</Text>
          </View>
          <View
            className={cn(
              'h-[76rpx] rounded-full px-[48rpx] center',
              selectedIds.size > 0 ? 'bg-[#ff8a4c]' : 'bg-[#e0e0e0]',
            )}
            onClick={selectedIds.size > 0 ? handleConfirm : undefined}
          >
            <Text className="text-[28rpx] font-medium text-white">确定添加</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

definePageConfig({
  navigationBarTitleText: '选择会员',
});

export default ProxyMemberSelectPage;
