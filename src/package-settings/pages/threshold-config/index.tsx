/**
 * 预警阈值配置页 package-settings/pages/threshold-config/index
 *
 * 使用场景：系统设置 → 课时不足预警阈值（仅管理员可编辑）
 * 功能说明：单字段表单（数字输入，FormRow + FormInput），保存后统计页运营预警实时按新阈值过滤。
 * 设计语言参考 package-course/pages/course-form（Card + FormRow）。
 */
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import Card from '@/components/Card';
import FormRow from '@/components/FormRow';
import PageContainer from '@/components/PageContainer';
import { auditLogService } from '@/services/audit-log';
import {
  DEFAULT_ALERT_THRESHOLD_HOURS,
  getAlertThreshold,
  setAlertThreshold,
} from '@/utils/alert-config';
import { isAdmin, useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { useCardNavigationBar } from '@/utils/navigation-bar';

const ThresholdConfig: React.FC = () => {
  useCardNavigationBar();
  const { currentRole, profile } = useAuth();
  const [hours, setHours] = useState<string>(String(getAlertThreshold()));
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!isAdmin(currentRole)) {
      Taro.switchTab({ url: '/pages/home/index' });
    }
  }, [currentRole]);

  const handleSave = useCallback(() => {
    const v = Number(hours);
    if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
      setError('请输入不小于 0 的整数（课时）');
      return;
    }
    setAlertThreshold(v);
    // 审计日志（用户口径 2026-08-22）：预警阈值变更属系统配置操作
    try {
      void auditLogService
        .record({
          action: 'settings.threshold',
          operatorId: profile?.id || '',
          operatorName: profile?.name || '未知',
          operatorRole: profile?.currentContext?.role || 'unknown',
          targetType: 'settings',
          detail: `修改预警阈值：课时不足预警阈值调整为 ${v} 课时`,
          meta: { threshold: v },
        })
        .catch((e) => logError('audit settings.threshold', e));
    } catch (e) {
      logError('audit settings.threshold', e);
    }
    Taro.showToast({ title: '已保存', icon: 'success' });
    setTimeout(() => Taro.navigateBack(), 600);
  }, [hours, profile]);

  if (!isAdmin(currentRole)) return null;

  return (
    <PageContainer safeBottom>
      <View className="px-[32rpx] pt-[32rpx] pb-[160rpx]">
        <Text className="text-[32rpx] font-semibold text-foreground">预警阈值</Text>
        <Text className="mt-[8rpx] block text-[26rpx] text-muted-foreground">
          学员剩余课时 ≤ 阈值时触发「课时不足」预警（默认 {DEFAULT_ALERT_THRESHOLD_HOURS} 课时）
        </Text>
        <Text className="mt-[8rpx] block text-[24rpx] text-muted-foreground/80">
          剩余课时用尽（0 课时，最后一节课上完）时始终提醒一次，不受阈值影响
        </Text>

        <View className="mt-[32rpx]">
          <Card className="p-[32rpx]">
            <FormRow
              label="课时不足预警阈值"
              required
              editable
              inputType="number"
              suffix="课时"
              placeholder={String(DEFAULT_ALERT_THRESHOLD_HOURS)}
              value={hours}
              onInput={(e) => {
                setHours(e.detail.value);
                if (error) setError(undefined);
              }}
              error={error}
              helperText="统计页运营预警的过滤条件；修改后立即生效"
            />
          </Card>
        </View>

        <View
          className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] bg-primary text-primary-foreground rounded-full py-[28rpx] flex items-center justify-center"
          onClick={handleSave}
        >
          <Text className="text-[30rpx] font-medium">保存</Text>
        </View>
      </View>
    </PageContainer>
  );
};

export default ThresholdConfig;
