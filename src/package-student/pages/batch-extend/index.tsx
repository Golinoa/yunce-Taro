/**
 * 批量延期（R3 / B8）
 *
 * 流程（说明书 3.5）：多选学员 → 选择延期方式 → 预览逐卡结果 → 确认 → 逐卡写账本流水。
 * - 加 N 天：从「原到期日 / 今天」取较晚者起算 ⇒ 过期卡复活、绝不缩短（服务端计算）；
 * - 设为新到期日：必须晚于该卡当前到期日，否则该卡标红、不许提交；
 * - 永久卡（无到期日）不参与，单独列出跳过原因。
 */
import { View, Text, Input, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { memberCardService } from '@/services/member-card';
import type { BatchExtendCardOutcome } from '@/services/member-card';
import { studentService } from '@/services/student';
import type { Student } from '@/types/student';
import { withRouteGuard } from '@/utils/route-guard';

type ExtendMode = 'add_days' | 'set_date';

const OUTCOME_LABEL: Record<BatchExtendCardOutcome['outcome'], string> = {
  extend: '将延期',
  skip_permanent: '永久卡跳过',
  invalid: '无法延期',
};

const BatchExtendPage: React.FC = () => {
  // 第一步：多选学员
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student[]>([]);

  // 第二步：延期方式 + 预览
  const [mode, setMode] = useState<ExtendMode>('add_days');
  const [days, setDays] = useState('');
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<BatchExtendCardOutcome[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ extendedCount: number; skippedCount: number } | null>(
    null,
  );

  const selectedIds = useMemo(() => selected.map((student) => student.id), [selected]);

  const handleSearch = useCallback(async () => {
    const keyword = query.trim();
    if (!keyword) {
      Taro.showToast({ title: '请输入姓名或手机号', icon: 'none' });
      return;
    }
    setSearching(true);
    try {
      const list = await studentService.search('', keyword);
      setResults(list.filter((item) => item.status !== 'deleted').slice(0, 8));
      if (list.length === 0) Taro.showToast({ title: '未找到学员', icon: 'none' });
    } catch {
      Taro.showToast({ title: '搜索失败，请重试', icon: 'none' });
    } finally {
      setSearching(false);
    }
  }, [query]);

  const addStudent = useCallback((student: Student) => {
    setSelected((current) =>
      current.some((item) => item.id === student.id) ? current : [...current, student],
    );
  }, []);

  const removeStudent = useCallback((studentId: string) => {
    setSelected((current) => current.filter((item) => item.id !== studentId));
    setPreview(null); // 选员变化后旧预览作废
  }, []);

  const handlePreview = useCallback(async () => {
    if (selectedIds.length === 0) {
      Taro.showToast({ title: '请先添加学员', icon: 'none' });
      return;
    }
    if (mode === 'add_days' && (!Number.isInteger(Number(days)) || Number(days) <= 0)) {
      Taro.showToast({ title: '请填写正整数延期天数', icon: 'none' });
      return;
    }
    if (mode === 'set_date' && !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      Taro.showToast({ title: '请填写新到期日（YYYY-MM-DD）', icon: 'none' });
      return;
    }
    setPreviewing(true);
    try {
      const outcome = await memberCardService.previewBatchExtend({
        studentIds: selectedIds,
        mode,
        days: mode === 'add_days' ? Number(days) : undefined,
        newDate: mode === 'set_date' ? newDate : undefined,
      });
      setPreview(outcome.cards);
      setResult(null);
      if (outcome.cardCount === 0) {
        Taro.showToast({ title: '所选学员名下没有课时卡', icon: 'none' });
      }
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '预览失败，请重试',
        icon: 'none',
      });
    } finally {
      setPreviewing(false);
    }
  }, [selectedIds, mode, days, newDate]);

  const invalidCount = preview?.filter((row) => row.outcome === 'invalid').length ?? 0;
  const extendCount = preview?.filter((row) => row.outcome === 'extend').length ?? 0;

  const handleSubmit = useCallback(async () => {
    if (!preview) return;
    if (invalidCount > 0) {
      Taro.showToast({ title: '存在无法延期的卡，请调整新到期日', icon: 'none' });
      return;
    }
    const batchNo = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSubmitting(true);
    try {
      const committed = await memberCardService.commitBatchExtend({
        studentIds: selectedIds,
        mode,
        days: mode === 'add_days' ? Number(days) : undefined,
        newDate: mode === 'set_date' ? newDate : undefined,
        reason: reason.trim() || undefined,
        batchNo,
      });
      setResult({ extendedCount: committed.extendedCount, skippedCount: committed.skippedCount });
      setPreview(null);
      Taro.showToast({ title: `已延期 ${committed.extendedCount} 张卡`, icon: 'success' });
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '提交失败，请重试',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
    }
  }, [preview, invalidCount, selectedIds, mode, days, newDate, reason]);

  return (
    <PageContainer>
      <View className="px-[24rpx] pb-[60rpx] flex flex-col gap-[20rpx]">
        <Text className="text-[38rpx] font-bold text-foreground px-[8rpx] pt-[8rpx]">批量延期</Text>

        {/* 第一步：多选学员 */}
        <View className="bg-card rounded-[24rpx] p-[28rpx]">
          <Text className="text-[30rpx] font-bold text-foreground">第一步 · 选择学员</Text>
          <View className="flex gap-[16rpx] mt-[16rpx]">
            <Input
              className="flex-1 border border-border rounded-[12rpx] p-[18rpx]"
              type="text"
              placeholder="姓名或手机号"
              value={query}
              onInput={(event) => setQuery(event.detail.value)}
            />
            <Button type="primary" loading={searching} disabled={searching} onClick={handleSearch}>
              搜索
            </Button>
          </View>
          {results.map((student) => (
            <View
              key={student.id}
              className="mt-[12rpx] bg-muted rounded-[16rpx] p-[20rpx] flex items-center justify-between"
              onClick={() => addStudent(student)}
            >
              <Text className="text-[26rpx] text-foreground">{student.name}</Text>
              <Text className="text-[24rpx] text-primary">添加 +</Text>
            </View>
          ))}
          {selected.length > 0 && (
            <View className="mt-[16rpx] flex flex-wrap gap-[12rpx]">
              {selected.map((student) => (
                <View
                  key={student.id}
                  className="bg-primary/10 rounded-full px-[20rpx] py-[8rpx] flex items-center gap-[8rpx]"
                  onClick={() => removeStudent(student.id)}
                >
                  <Text className="text-[24rpx] text-primary">{student.name}</Text>
                  <Text className="text-[22rpx] text-muted-foreground">移除 ×</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 第二步：延期方式 */}
        <View className="bg-card rounded-[24rpx] p-[28rpx]">
          <Text className="text-[30rpx] font-bold text-foreground">第二步 · 延期方式</Text>
          <View className="mt-[16rpx] flex flex-col gap-[12rpx]">
            <View
              className={`rounded-[16rpx] p-[20rpx] ${mode === 'add_days' ? 'bg-primary/10 border border-primary' : 'bg-muted'}`}
              onClick={() => {
                setMode('add_days');
                setPreview(null);
              }}
            >
              <Text className="text-[28rpx] font-medium text-foreground">加 N 天</Text>
              <Text className="block text-[22rpx] text-muted-foreground mt-[4rpx]">
                从「原到期日 / 今天」较晚者起算，过期卡会正确复活
              </Text>
            </View>
            <View
              className={`rounded-[16rpx] p-[20rpx] ${mode === 'set_date' ? 'bg-primary/10 border border-primary' : 'bg-muted'}`}
              onClick={() => {
                setMode('set_date');
                setPreview(null);
              }}
            >
              <Text className="text-[28rpx] font-medium text-foreground">设为新到期日</Text>
              <Text className="block text-[22rpx] text-muted-foreground mt-[4rpx]">
                统一对齐到某一天；必须晚于各卡当前到期日
              </Text>
            </View>
          </View>
          <Input
            className="mt-[16rpx] border border-border rounded-[12rpx] p-[18rpx]"
            type={mode === 'add_days' ? 'number' : 'text'}
            placeholder={mode === 'add_days' ? '延期天数（正整数）' : '新到期日（YYYY-MM-DD）'}
            value={mode === 'add_days' ? days : newDate}
            onInput={(event) =>
              mode === 'add_days' ? setDays(event.detail.value) : setNewDate(event.detail.value)
            }
          />
          <Input
            className="mt-[16rpx] border border-border rounded-[12rpx] p-[18rpx]"
            type="text"
            placeholder="备注（选填，会记入导入/延期记录）"
            value={reason}
            onInput={(event) => setReason(event.detail.value)}
          />
          <Button
            className="mt-[20rpx]"
            type="primary"
            loading={previewing}
            disabled={previewing}
            onClick={handlePreview}
          >
            预览延期结果
          </Button>
        </View>

        {/* 预览结果 */}
        {previewing && <Loading text="计算中..." />}
        {preview && !previewing && (
          <View className="bg-card rounded-[24rpx] p-[28rpx]">
            <Text className="text-[30rpx] font-bold text-foreground">第三步 · 确认</Text>
            <Text className="block text-[24rpx] text-muted-foreground mt-[10rpx] leading-[36rpx]">
              将延期 {extendCount} 张卡；跳过永久卡{' '}
              {preview.filter((row) => row.outcome === 'skip_permanent').length} 张。
            </Text>
            <View className="mt-[16rpx] flex flex-col gap-[12rpx]">
              {preview.length === 0 && (
                <Empty icon="mdi-inbox" description="所选学员名下没有课时卡" />
              )}
              {preview.map((row) => (
                <View
                  key={row.memberCardId}
                  className={`rounded-[16rpx] p-[20rpx] ${
                    row.outcome === 'invalid'
                      ? 'bg-status-danger/10'
                      : row.outcome === 'extend'
                        ? 'bg-muted'
                        : 'bg-warning/10'
                  }`}
                >
                  <View className="flex items-center justify-between">
                    <Text className="text-[26rpx] font-medium text-foreground">
                      {row.studentName} · {row.cardTypeName}
                    </Text>
                    <Text
                      className={`text-[24rpx] ${
                        row.outcome === 'invalid'
                          ? 'text-status-danger'
                          : row.outcome === 'extend'
                            ? 'text-primary'
                            : 'text-warning'
                      }`}
                    >
                      {OUTCOME_LABEL[row.outcome]}
                    </Text>
                  </View>
                  <Text className="block text-[22rpx] text-muted-foreground mt-[4rpx]">
                    当前到期：{row.currentExpiry ?? '永久'}
                    {row.outcome === 'extend' ? ` → ${row.newExpiry}` : ''} · {row.detail}
                  </Text>
                </View>
              ))}
            </View>
            <Button
              className="mt-[20rpx]"
              type="primary"
              loading={submitting}
              disabled={!preview || extendCount === 0 || invalidCount > 0 || submitting}
              onClick={handleSubmit}
            >
              确认延期
            </Button>
            {invalidCount > 0 && (
              <Text className="block text-[22rpx] text-status-danger mt-[10rpx]">
                {invalidCount} 张卡的新到期日不晚于当前到期日，请调整后重试
              </Text>
            )}
          </View>
        )}

        {result && (
          <View className="bg-card rounded-[24rpx] p-[28rpx]">
            <Text className="text-[30rpx] font-bold text-foreground">延期结果</Text>
            <Text className="block text-[26rpx] text-muted-foreground mt-[10rpx]">
              成功延期 {result.extendedCount} 张卡
              {result.skippedCount > 0 ? `；${result.skippedCount} 张永久卡已跳过` : ''}。
              每张卡都写入了可追溯的延期流水。
            </Text>
          </View>
        )}
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(BatchExtendPage);
