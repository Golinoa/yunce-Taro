import { View, Text, Input, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';

/**
 * ProxyUserSelectSheet - 代约用户选择底部弹窗
 *
 * 参照快速消课页「添加学员」交互模式：
 * 双 Tab 切换（线索/会员），单选，搜索过滤，可滚动列表，底部悬浮确认按钮。
 * 线索 Tab 顶部提供「快捷添加线索」入口，只需填姓名+手机号即可创建并自动选中。
 */

export interface ProxyUserOption {
  id: string;
  name: string;
  subTitle?: string;
  avatarNode?: React.ReactNode;
}

export interface ProxyUserSelectResult {
  id: string;
  name: string;
  type: 'lead' | 'member';
  subTitle?: string;
  avatarUrl?: string;
}

export interface ProxyUserSelectSheetProps {
  /** 弹窗是否可见 */
  visible: boolean;
  /** 线索列表 */
  leadOptions: ProxyUserOption[];
  /** 会员列表 */
  memberOptions: ProxyUserOption[];
  /** 快捷创建线索回调：返回新创建的线索 */
  onQuickCreateLead: (name: string, phone: string) => Promise<ProxyUserOption | null>;
  /** 关闭回调 */
  onClose: () => void;
  /** 确认回调：选中单个用户后触发 */
  onConfirm: (user: ProxyUserSelectResult) => void;
  /** 选择模式：all 双 Tab，member 仅会员 */
  mode?: 'all' | 'member';
}

/** Tab 类型：线索在前 */
type UserTab = 'lead' | 'member';

const TAB_CONFIG: { key: UserTab; label: string; placeholder: string }[] = [
  { key: 'lead', label: '线索', placeholder: '搜索线索姓名或家长手机号' },
  { key: 'member', label: '会员', placeholder: '搜索会员姓名或手机号' },
];

const ProxyUserSelectSheet: React.FC<ProxyUserSelectSheetProps> = ({
  visible,
  leadOptions,
  memberOptions,
  onQuickCreateLead,
  onClose,
  onConfirm,
  mode = 'all',
}) => {
  const [activeTab, setActiveTab] = useState<UserTab>('lead');
  const [keyword, setKeyword] = useState('');
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);

  // 快捷添加线索表单
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickCreating, setQuickCreating] = useState(false);

  const isMemberOnly = mode === 'member';
  const showTabs = !isMemberOnly && leadOptions.length > 0 && memberOptions.length > 0;
  const sheetTitle = isMemberOnly ? '选择会员' : '选择用户';
  const hasSelected = Boolean(localSelectedId);

  // 弹窗打开时重置状态
  useEffect(() => {
    if (visible) {
      setActiveTab(isMemberOnly || leadOptions.length === 0 ? 'member' : 'lead');
      setKeyword('');
      setLocalSelectedId(null);
      setShowQuickForm(false);
      setQuickName('');
      setQuickPhone('');
      setQuickCreating(false);
    }
  }, [visible, isMemberOnly, leadOptions.length]);

  const handleTabChange = useCallback((tab: UserTab) => {
    setActiveTab(tab);
    setKeyword('');
    setLocalSelectedId(null);
    setShowQuickForm(false);
    setQuickName('');
    setQuickPhone('');
  }, []);

  const currentOptions = activeTab === 'lead' ? leadOptions : memberOptions;

  const filteredOptions = useMemo(() => {
    if (!keyword.trim()) return currentOptions;
    const kw = keyword.trim().toLowerCase();
    return currentOptions.filter(
      (item) =>
        item.name.toLowerCase().includes(kw) ||
        (item.subTitle && item.subTitle.toLowerCase().includes(kw)),
    );
  }, [keyword, currentOptions]);

  const currentPlaceholder = TAB_CONFIG.find((t) => t.key === activeTab)?.placeholder || '搜索用户';

  const selectedOption = useMemo(
    () => (localSelectedId ? currentOptions.find((o) => o.id === localSelectedId) : null),
    [localSelectedId, currentOptions],
  );

  /** 点击即选中，再点其他项自动换选 */
  const handleSelect = useCallback((id: string) => {
    setLocalSelectedId(id);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!localSelectedId || !selectedOption) return;
    onConfirm({
      id: selectedOption.id,
      name: selectedOption.name,
      type: activeTab,
      subTitle: selectedOption.subTitle,
    });
    onClose();
  }, [localSelectedId, selectedOption, activeTab, onConfirm, onClose]);

  /** 快捷创建线索 */
  const handleQuickCreate = useCallback(async () => {
    if (!quickName.trim()) return;
    setQuickCreating(true);
    try {
      const newLead = await onQuickCreateLead(quickName.trim(), quickPhone.trim());
      if (newLead) {
        // 创建成功后自动选中新线索
        setLocalSelectedId(newLead.id);
        setShowQuickForm(false);
        setQuickName('');
        setQuickPhone('');
      }
    } finally {
      setQuickCreating(false);
    }
  }, [quickName, quickPhone, onQuickCreateLead]);

  return (
    <BottomSheet
      visible={visible}
      title={sheetTitle}
      onClose={onClose}
      height="70vh"
      scrollable={false}
    >
      <View className="flex flex-col" style={{ height: 'calc(70vh - 120rpx)' }}>
        {/* Tab 切换 */}
        {showTabs && (
          <View className="flex px-[32rpx] pt-[8rpx] pb-[12rpx] gap-[16rpx] flex-shrink-0">
            {TAB_CONFIG.map((tab) => (
              <View
                key={tab.key}
                className={cn(
                  'flex-1 center py-[16rpx] rounded-[12rpx] transition-colors',
                  activeTab === tab.key ? 'bg-primary' : 'bg-muted',
                )}
                onClick={() => handleTabChange(tab.key)}
              >
                <Text
                  className={cn(
                    'text-[28rpx] font-medium',
                    activeTab === tab.key ? 'text-primary-foreground' : 'text-muted-foreground',
                  )}
                >
                  {tab.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* 搜索框 + 排序 */}
        <View className="flex-shrink-0 px-[32rpx] pb-[20rpx] pt-[8rpx]">
          <View className="flex items-center gap-[16rpx]">
            <View className="flex flex-1 items-center gap-[16rpx] rounded-[36rpx] bg-muted px-[24rpx] py-[16rpx]">
              <Icon name="mdi-magnify" size="sm" color="#94a3b8" />
              <Input
                className="flex-1 text-[28rpx] text-foreground"
                placeholder={currentPlaceholder}
                placeholderClass="input-placeholder"
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

        {/* 用户列表 — 可滚动 */}
        <ScrollView scrollY className="min-h-0 flex-1 bg-white px-[32rpx] py-[24rpx]">
          <View className="flex flex-col gap-[16rpx] pb-[12rpx]">
            {/* 线索 Tab：快捷添加入口 */}
            {activeTab === 'lead' && !showQuickForm && (
              <View
                className="flex items-center justify-center gap-[8rpx] rounded-[24rpx] border border-dashed border-primary bg-primary/5 px-[24rpx] py-[20rpx]"
                onClick={() => setShowQuickForm(true)}
              >
                <Icon name="mdi-plus-circle-outline" size="sm" color="#3B6EF5" />
                <Text className="text-[26rpx] font-medium text-primary">快捷添加线索</Text>
              </View>
            )}

            {/* 线索 Tab：快捷添加内联表单 */}
            {activeTab === 'lead' && showQuickForm && (
              <View className="rounded-[24rpx] border border-primary bg-primary/5 px-[24rpx] py-[20rpx]">
                <View className="flex items-center justify-between mb-[16rpx]">
                  <Text className="text-[26rpx] font-medium text-primary">快捷添加线索</Text>
                  <View
                    className="h-[40rpx] w-[40rpx] center rounded-full active:bg-muted"
                    onClick={() => {
                      setShowQuickForm(false);
                      setQuickName('');
                      setQuickPhone('');
                    }}
                  >
                    <Icon name="mdi-close" size={18} className="text-muted-foreground" />
                  </View>
                </View>
                <View className="flex gap-[16rpx]">
                  <View className="flex-1 rounded-[12rpx] bg-white px-[20rpx] py-[16rpx]">
                    <Input
                      className="text-[26rpx] text-foreground"
                      placeholder="孩子姓名"
                      placeholderClass="text-muted-foreground"
                      value={quickName}
                      onInput={(e) => setQuickName(e.detail.value || '')}
                    />
                  </View>
                  <View className="flex-1 rounded-[12rpx] bg-white px-[20rpx] py-[16rpx]">
                    <Input
                      className="text-[26rpx] text-foreground"
                      placeholder="家长手机号（选填）"
                      placeholderClass="text-muted-foreground"
                      type="number"
                      maxlength={11}
                      value={quickPhone}
                      onInput={(e) => setQuickPhone(e.detail.value || '')}
                    />
                  </View>
                </View>
                <View
                  className={cn(
                    'mt-[16rpx] rounded-[12rpx] py-[14rpx] center',
                    quickName.trim() && !quickCreating ? 'bg-primary' : 'bg-border',
                  )}
                  onClick={quickName.trim() && !quickCreating ? handleQuickCreate : undefined}
                >
                  <Text className="text-[24rpx] font-medium text-white">
                    {quickCreating ? '创建中...' : '创建并选中'}
                  </Text>
                </View>
              </View>
            )}

            {filteredOptions.map((item) => {
              const checked = localSelectedId === item.id;
              return (
                <View
                  key={item.id}
                  className="flex items-center gap-[20rpx] border-b border-border-light py-[20rpx] last:border-b-0"
                  onClick={() => handleSelect(item.id)}
                >
                  {item.avatarNode || (
                    <View className="center h-[72rpx] w-[72rpx] flex-shrink-0 rounded-full bg-muted">
                      <Text className="text-[28rpx] font-medium text-muted-foreground">
                        {item.name.slice(0, 1)}
                      </Text>
                    </View>
                  )}
                  <View className="min-w-0 flex-1">
                    <Text className="text-[30rpx] font-medium text-foreground">{item.name}</Text>
                    {item.subTitle && (
                      <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
                        {item.subTitle}
                      </Text>
                    )}
                  </View>
                  <View
                    className={cn(
                      'center h-[40rpx] w-[40rpx] rounded-full border-[3rpx]',
                      checked ? 'border-[#ff8a4c] bg-[#ff8a4c]' : 'border-[#cccccc] bg-white',
                    )}
                  >
                    {checked && <Icon name="mdi-check" size={20} className="text-white" />}
                  </View>
                </View>
              );
            })}
            {filteredOptions.length === 0 && !showQuickForm && (
              <View className="rounded-[20rpx] bg-muted px-[24rpx] py-[24rpx]">
                <Text className="text-[24rpx] text-muted-foreground">未找到匹配用户</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* 底部确认按钮 — 悬浮固定 */}
        <View className="border-t border-border-light bg-white px-[32rpx] pb-safe-bar pt-[20rpx] flex-shrink-0">
          <View className="flex items-center justify-between gap-[24rpx]">
            <View className="flex items-baseline gap-[4rpx]">
              <Text className="text-[28rpx] text-foreground">已选</Text>
              <Text className="text-[32rpx] font-bold text-[#ff8a4c]">{hasSelected ? 1 : 0}</Text>
              <Text className="text-[28rpx] text-foreground">人</Text>
            </View>
            <View
              className={cn(
                'h-[76rpx] rounded-full px-[48rpx] center',
                hasSelected ? 'bg-[#ff8a4c]' : 'bg-[#e0e0e0]',
              )}
              onClick={hasSelected ? handleConfirm : undefined}
            >
              <Text className="text-[28rpx] font-medium text-white">确定添加</Text>
            </View>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

export default ProxyUserSelectSheet;
