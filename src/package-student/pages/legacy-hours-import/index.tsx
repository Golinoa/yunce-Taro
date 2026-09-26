/**
 * 老生课时批量导入（R2 / B7）
 *
 * 流程（说明书 3.4）：下载模板 → 填写 → 上传预览校验 → 同名点选消歧 → 确认导入 → 结果 + 导入记录。
 * 硬门禁：存在「同名待消歧」且未点选的行不允许提交（课时不能导到别人头上）；错误行不阻塞其余行，
 * 只提交可导入的行，错误行按「失败名单」改后重传。
 */
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useState } from 'react';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { legacyHoursImportService } from '@/services/legacy-hours-import';
import type {
  LegacyImportPreview,
  LegacyImportPreviewRow,
  LegacyImportRecord,
} from '@/services/legacy-hours-import';
import { REFRESH_SIGNAL, setRefreshSignal } from '@/utils/refresh-signal';
import { withRouteGuard } from '@/utils/route-guard';

const STATUS_LABEL: Record<LegacyImportPreviewRow['status'], string> = {
  ok: '可导入',
  pending: '待确认',
  new: '新建档案',
  error: '有错误',
};

const LegacyHoursImportPage: React.FC = () => {
  const [preview, setPreview] = useState<LegacyImportPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selections, setSelections] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ batchNo: string; successRows: number } | null>(null);
  const [records, setRecords] = useState<LegacyImportRecord[]>([]);

  const loadRecords = useCallback(() => {
    legacyHoursImportService
      .listRecords()
      .then((payload) => setRecords(payload.list ?? []))
      .catch(() => setRecords([]));
  }, []);

  React.useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      await legacyHoursImportService.downloadTemplate();
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '模板下载失败',
        icon: 'none',
      });
    }
  }, []);

  const handleChooseFile = useCallback(async () => {
    setPreviewing(true);
    try {
      const next = await legacyHoursImportService.chooseAndPreview();
      setPreview(next);
      setSelections({});
      setResult(null);
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '预览失败',
        icon: 'none',
      });
    } finally {
      setPreviewing(false);
    }
  }, []);

  const handlePickCandidate = useCallback((rowNo: number, studentId: string) => {
    setSelections((current) => ({ ...current, [rowNo]: studentId }));
  }, []);

  const submitable = React.useMemo(() => {
    if (!preview) return false;
    const importable = preview.rows.filter((row) => row.status !== 'error');
    if (importable.length === 0) return false;
    // 硬门禁：待消歧的行必须点选学员后才能提交（课时不能导到别人头上）
    const unresolved = importable.some((row) => row.status === 'pending' && !selections[row.rowNo]);
    return !unresolved;
  }, [preview, selections]);

  const errorRowCount = preview?.rows.filter((row) => row.status === 'error').length ?? 0;

  const handleSubmit = useCallback(async () => {
    if (!preview) return;
    // 错误行不阻塞其余行（说明书 3.4）：只提交可导入的行，错误行修正后重新上传
    const rows = preview.rows
      .filter((row) => row.status !== 'error')
      .map((row) => {
        const studentId = row.status === 'pending' ? selections[row.rowNo] : row.studentId;
        return {
          rowNo: row.rowNo,
          studentId: studentId || undefined,
          newStudent:
            row.status === 'new'
              ? {
                  name: row.name,
                  gender: row.gender,
                  birthday: row.birthday,
                  phone: row.phone || undefined,
                }
              : undefined,
          cardTypeId: row.cardTypeId!,
          remainingCount: row.remainingCount,
          expiry: row.expiry,
        };
      });
    if (rows.length === 0) {
      Taro.showToast({ title: '没有可导入的行', icon: 'none' });
      return;
    }
    const batchNo = `imp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSubmitting(true);
    try {
      const committed = await legacyHoursImportService.commit({ batchNo, rows });
      setResult(committed);
      setPreview(null);
      setSelections({});
      loadRecords();
      /**
       * ⚠️ 必须通知学员列表重拉：导入会**新建学员**。
       * 列表页只在消费到 `students` 信号时才 invalidate，否则用户返回列表
       * 看不到刚导入的学员（会误以为导入失败）。
       */
      setRefreshSignal(REFRESH_SIGNAL.students);
      Taro.showToast({ title: `导入成功 ${committed.successRows} 条`, icon: 'success' });
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '导入失败，请重试',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
    }
  }, [preview, selections, loadRecords]);

  return (
    <PageContainer>
      <View className="px-[24rpx] pb-[60rpx] flex flex-col gap-[20rpx]">
        <Text className="text-[38rpx] font-bold text-foreground px-[8rpx] pt-[8rpx]">
          批量导入课时
        </Text>
        {/* 步骤一：模板 */}
        <View className="bg-card rounded-[24rpx] p-[28rpx]">
          <Text className="text-[30rpx] font-bold text-foreground">第一步 · 下载并填写模板</Text>
          <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx] leading-[36rpx]">
            以学员姓名为键，手机号选填（同名时用来区分）；一行一个科目；学员已建档的档案列可留空。
            建议先导 5~10 行验证无误，再导全量。
          </Text>
          <Button className="mt-[20rpx]" onClick={handleDownloadTemplate}>
            下载 Excel 模板
          </Button>
        </View>

        {/* 步骤二：上传预览 */}
        <View className="bg-card rounded-[24rpx] p-[28rpx]">
          <Text className="text-[30rpx] font-bold text-foreground">第二步 · 上传并预览</Text>
          <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
            从聊天记录中选择填好的 .xlsx 文件
          </Text>
          <Button
            className="mt-[20rpx]"
            type="primary"
            loading={previewing}
            disabled={previewing}
            onClick={handleChooseFile}
          >
            选择文件并预览
          </Button>
        </View>

        {/* 预览结果 */}
        {previewing && <Loading text="解析中..." />}
        {preview && !previewing && (
          <View className="bg-card rounded-[24rpx] p-[28rpx]">
            <Text className="text-[30rpx] font-bold text-foreground">第三步 · 确认导入</Text>
            <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx] leading-[36rpx]">
              共 {preview.summary.totalRows} 行：可导入 {preview.summary.okRows} · 待确认{' '}
              {preview.summary.pendingRows} · 新建档 {preview.summary.newRows} · 有错误{' '}
              {preview.summary.errorRows}；将新建 {preview.summary.newStudents} 个档案、复用{' '}
              {preview.summary.reusedStudents} 个已有档案。
            </Text>

            <View className="mt-[20rpx] flex flex-col gap-[16rpx]">
              {preview.rows.length === 0 && (
                <Empty icon="mdi-inbox" description="没有可导入的数据行" />
              )}
              {preview.rows.map((row) => {
                const selectedStudentId = selections[row.rowNo];
                const isPendingUnresolved = row.status === 'pending' && !selectedStudentId;
                return (
                  <View
                    key={row.rowNo}
                    className={`rounded-[20rpx] p-[24rpx] ${
                      row.status === 'error'
                        ? 'bg-status-danger/10'
                        : isPendingUnresolved
                          ? 'bg-warning/10'
                          : 'bg-muted'
                    }`}
                  >
                    <View className="flex items-center justify-between">
                      <Text className="text-[28rpx] font-medium text-foreground">
                        第 {row.rowNo} 行 · {row.name}
                      </Text>
                      <Text
                        className={`text-[24rpx] ${
                          row.status === 'error'
                            ? 'text-status-danger'
                            : row.status === 'pending'
                              ? 'text-warning'
                              : 'text-primary'
                        }`}
                      >
                        {STATUS_LABEL[row.status]}
                      </Text>
                    </View>
                    <Text className="block text-[24rpx] text-muted-foreground mt-[6rpx]">
                      {row.subjectName} · {row.remainingCount} 课时 ·{' '}
                      {row.expiry ? `有效期至 ${row.expiry}` : '永久有效'}
                      {row.status === 'ok' && row.studentName ? ` · ${row.studentName}` : ''}
                    </Text>
                    {row.status === 'error' && (
                      <Text className="block text-[24rpx] text-status-danger mt-[6rpx]">
                        {row.reason}
                      </Text>
                    )}
                    {row.status === 'new' && (
                      <Text className="block text-[24rpx] text-primary mt-[6rpx]">
                        将新建学员档案（性别/生日等留空列不会覆盖已有值）
                      </Text>
                    )}
                    {row.status === 'pending' && (
                      <View className="mt-[12rpx]">
                        <Text className="block text-[24rpx] text-warning">
                          {isPendingUnresolved
                            ? '请点选是哪一位学员：'
                            : `已选择：${row.candidates?.find((candidate) => candidate.studentId === selectedStudentId)?.name ?? ''}`}
                        </Text>
                        {row.candidates?.map((candidate) => (
                          <View
                            key={candidate.studentId}
                            className={`mt-[10rpx] rounded-[16rpx] p-[18rpx] flex items-center justify-between ${
                              selectedStudentId === candidate.studentId
                                ? 'bg-primary/10 border border-primary'
                                : 'bg-card border border-border'
                            }`}
                            onClick={() => handlePickCandidate(row.rowNo, candidate.studentId)}
                          >
                            <Text className="text-[26rpx] text-foreground">{candidate.name}</Text>
                            <Text className="text-[24rpx] text-muted-foreground">
                              {candidate.phone || '无手机号'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            <Button
              className="mt-[24rpx]"
              type="primary"
              loading={submitting}
              disabled={!submitable || submitting}
              onClick={handleSubmit}
            >
              确认导入
            </Button>
            {errorRowCount > 0 && submitable && (
              <Text className="block text-[22rpx] text-status-danger mt-[10rpx]">
                有 {errorRowCount} 行有错误，本次不会导入；修正后可重新上传
              </Text>
            )}
            {!submitable && (
              <Text className="block text-[22rpx] text-muted-foreground mt-[10rpx]">
                请先为「待确认」的行点选学员；没有可导入的行时不能提交
              </Text>
            )}
          </View>
        )}

        {/* 导入结果 */}
        {result && (
          <View className="bg-card rounded-[24rpx] p-[28rpx]">
            <Text className="text-[30rpx] font-bold text-foreground">导入结果</Text>
            <Text className="block text-[26rpx] text-muted-foreground mt-[10rpx]">
              批次 {result.batchNo}：成功导入 {result.successRows} 条，已进入对应学员的卡包。
            </Text>
          </View>
        )}

        {/* 导入记录 */}
        <View className="bg-card rounded-[24rpx] p-[28rpx]">
          <Text className="text-[30rpx] font-bold text-foreground">导入记录</Text>
          {records.length === 0 ? (
            <Text className="block text-[24rpx] text-muted-foreground mt-[10rpx]">
              暂无导入记录
            </Text>
          ) : (
            <View className="mt-[16rpx] flex flex-col gap-[12rpx]">
              {records.map((record) => (
                <View
                  key={record.id}
                  className="flex items-center justify-between bg-muted rounded-[16rpx] p-[20rpx]"
                >
                  <View>
                    <Text className="text-[26rpx] text-foreground block">{record.batchNo}</Text>
                    <Text className="text-[22rpx] text-muted-foreground">
                      {new Date(record.createdAt).toLocaleString('zh-CN')}
                    </Text>
                  </View>
                  <Text className="text-[26rpx] text-primary">
                    成功 {record.successRows}/{record.totalRows}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(LegacyHoursImportPage);
