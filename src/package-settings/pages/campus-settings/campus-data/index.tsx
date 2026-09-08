/**
 * 运营数据详情页 — 能力预留，暂未接通真实统计接口
 */
import { View } from '@tarojs/components';
import Empty from '@/components/Empty';
import PageContainer from '@/components/PageContainer';
import { useCardNavigationBar } from '@/utils/navigation-bar';

const CampusDataPage: React.FC = () => {
  useCardNavigationBar();

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen px-[32rpx] flex items-center justify-center">
        <Empty icon="mdi-chart-box-outline" description="运营数据即将开放" />
      </View>
    </PageContainer>
  );
};

export default CampusDataPage;
