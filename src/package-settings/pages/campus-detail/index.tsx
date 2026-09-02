/**
 * 门店详情页 package-settings/pages/campus-detail/index
 *
 * 展示校区基本信息，支持「主营业态」多选标签编辑。
 * 点击主营业态右侧「修改」展开标签选择器，
 * 选择后底部保存按钮高亮，保存成功后更新视图显示。
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BusinessCategoryPicker from '@/components/business/BusinessCategoryPicker';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import {
  formatBusinessCategories,
  type SelectedBusinessCategory,
} from '@/constants/business-categories';
import { campusService } from '@/services/campus';
import type { CampusUIModel } from '@/types/campus';
import { logError } from '@/utils/logger';

/** 信息行Props */
interface InfoRowProps {
  label: string;
  value?: string;
  placeholder?: string;
  onClick?: () => void;
  showArrow?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, placeholder, onClick, showArrow }) => (
  <View
    className={cn(
      'flex flex-row items-center justify-between py-[28rpx] border-b-[2rpx] border-border/50',
      onClick && 'press-bg',
    )}
    onClick={onClick}
  >
    <Text className="text-[30rpx] text-foreground">{label}</Text>
    <View className="flex flex-row items-center flex-1 justify-end min-w-0 ml-[24rpx]">
      <Text
        className={cn('text-[30rpx] truncate', value ? 'text-foreground' : 'text-muted-foreground')}
      >
        {value || placeholder || ''}
      </Text>
      {showArrow && <Icon name="mdi-chevron-right" size={32} color="muted" className="ml-[8rpx]" />}
    </View>
  </View>
);

const CampusDetail: React.FC = () => {
  const [campus, setCampus] = useState<CampusUIModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [draftCategories, setDraftCategories] = useState<SelectedBusinessCategory[]>([]);

  const campusId = useMemo(() => {
    const router = Taro.getCurrentInstance().router;
    return router?.params?.id || '';
  }, []);

  const loadCampus = useCallback(async () => {
    if (!campusId) return;
    setLoading(true);
    try {
      const data = await campusService.getById(campusId);
      if (data) {
        setCampus(data);
        setDraftCategories(data.businessCategories || []);
      }
    } catch (err) {
      logError('CampusDetail loadCampus', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [campusId]);

  useEffect(() => {
    void loadCampus();
  }, [loadCampus]);

  Taro.useDidShow(() => {
    void loadCampus();
  });

  /** 当前展示用的格式化文本 */
  const categoryDisplay = useMemo(
    () => formatBusinessCategories(campus?.businessCategories || []),
    [campus?.businessCategories],
  );

  /** 是否有未保存的营业态变更 */
  const hasCategoryChanged = useMemo(() => {
    return JSON.stringify(draftCategories) !== JSON.stringify(campus?.businessCategories || []);
  }, [draftCategories, campus?.businessCategories]);

  /** 保存营业态 */
  const handleSave = useCallback(async () => {
    if (!campusId || !hasCategoryChanged) return;
    setSaving(true);
    try {
      const updated = await campusService.update(campusId, {
        businessCategories: draftCategories,
      });
      if (updated) {
        setCampus(updated);
        setIsEditingCategory(false);
        Taro.showToast({ title: '保存成功', icon: 'success' });
      } else {
        Taro.showToast({ title: '保存失败', icon: 'none' });
      }
    } catch (err) {
      logError('CampusDetail save', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [campusId, draftCategories, hasCategoryChanged]);

  /** 进入营业态编辑 */
  const handleEditCategory = useCallback(() => {
    setDraftCategories(campus?.businessCategories || []);
    setIsEditingCategory(true);
  }, [campus?.businessCategories]);

  if (loading && !campus) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载门店信息中..." />
        </View>
      </PageContainer>
    );
  }

  if (!campus) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center px-[32rpx]">
          <Text className="text-[30rpx] text-muted-foreground">未找到门店信息</Text>
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      <View className="px-[32rpx] pt-[24rpx] pb-[180rpx]">
        {/* 基本信息 */}
        <View className="bg-white rounded-[32rpx] px-[32rpx] mb-[24rpx]">
          <InfoRow label="门店名称" value={campus.name} />
          <InfoRow label="营业执照名称" placeholder="请输入" />
          <InfoRow label="联系人" value={campus.name} />
          <InfoRow label="类型" value={campus.isMain ? '总店' : '分店'} />
          <InfoRow label="联系方式" value={campus.phone} />
          <InfoRow label="所在地区" value="河南省-郑州市-惠济区" showArrow />
          <InfoRow label="详细地址" value={campus.address} />
          <InfoRow label="营业时间" value="08:00:00至22:00:00" />
        </View>

        {/* 主营业态 */}
        <View className="bg-white rounded-[32rpx] px-[32rpx] py-[28rpx] mb-[24rpx]">
          <View className="flex flex-row items-center justify-between mb-[16rpx]">
            <Text className="text-[32rpx] font-semibold text-foreground">主营业态</Text>
            {!isEditingCategory && (
              <Text
                className="text-[28rpx] text-primary font-medium press-bg"
                onClick={handleEditCategory}
              >
                修改
              </Text>
            )}
          </View>

          {!isEditingCategory ? (
            <Text className="text-[28rpx] text-foreground leading-relaxed">
              {categoryDisplay || '未设置'}
            </Text>
          ) : (
            <BusinessCategoryPicker value={draftCategories} onChange={setDraftCategories} />
          )}
        </View>

        {/* 门店介绍 */}
        <View className="bg-white rounded-[32rpx] px-[32rpx] py-[28rpx] mb-[24rpx]">
          <Text className="text-[32rpx] font-semibold text-foreground mb-[16rpx]">
            {campus.name}的介绍
          </Text>
          <Text className="text-[28rpx] text-muted-foreground leading-relaxed">暂无介绍</Text>
        </View>

        {/* 门店环境 */}
        <View className="bg-white rounded-[32rpx] px-[32rpx] py-[28rpx]">
          <Text className="text-[32rpx] font-semibold text-foreground mb-[16rpx]">门店环境</Text>
          <View className="w-[160rpx] h-[160rpx] rounded-[24rpx] bg-muted flex items-center justify-center">
            <Icon name="mdi-image-plus" size={48} color="muted-foreground" />
          </View>
        </View>
      </View>

      {/* 底部保存按钮 */}
      <View className="fixed left-0 right-0 bottom-0 bg-white px-[32rpx] pt-[16rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))] border-t-[2rpx] border-border">
        <View
          className={cn(
            'rounded-[48rpx] py-[28rpx] flex items-center justify-center',
            hasCategoryChanged && !saving ? 'bg-primary press-scale' : 'bg-muted',
          )}
          onClick={hasCategoryChanged && !saving ? handleSave : undefined}
        >
          <Text
            className={cn(
              'text-[30rpx] font-semibold',
              hasCategoryChanged && !saving ? 'text-white' : 'text-muted-foreground',
            )}
          >
            {saving ? '保存中...' : '保存'}
          </Text>
        </View>
      </View>
    </PageContainer>
  );
};

export default CampusDetail;
