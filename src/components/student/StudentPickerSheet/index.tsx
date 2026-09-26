/**
 * StudentPickerSheet — 学员单选底部弹窗（B9 / R8 推荐关系）
 *
 * 用途：**添加/编辑学员表单的「推荐人」** 与 **学员详情的「手动关联推荐人」** 两个入口
 * 共用这一个组件（说明书 §4 R8：两处共用一个学员选择器，避免各写一套导致行为漂移）。
 *
 * 设计要点：
 * - **只能选，不能手输**：推荐关系存 `studentId`，不存姓名快照（改名要跟随）；
 *   手输姓名无法保证指向唯一学员，也是本迭代 R2 明确否掉的交互。
 * - **分页 + 搜索**：不一次性拉全量学员；搜索走后端 `keyword`，触底续拉下一页。
 * - **排除本人**：`excludeStudentId` 用于编辑态，防止把学员自己设成推荐人
 *   （后端也会拦，但前端先不让选，体验更好）。
 * - **可清除**：顶部固定一行「不设置推荐人」，回调 `onSelect(null)`。
 * - 已删除（软删除）学员由 `filterActiveStudents` 过滤，不出现在候选里。
 */
import { Input, ScrollView, View, Text } from '@tarojs/components';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import StudentListCard from '@/components/student/StudentListCard';
import { studentService } from '@/services/student';
import type { Student } from '@/types/student';
import { filterActiveStudents } from '@/utils/student-visibility';

const PAGE_SIZE = 20;

export interface StudentPickerSheetProps {
  visible: boolean;
  /** 弹窗标题（表单用「选择推荐人」，详情用「关联推荐人」） */
  title?: string;
  /** 当前已选学员 ID（用于高亮） */
  selectedId?: string;
  /** 需要排除的学员 ID（编辑态传学员自己） */
  excludeStudentId?: string;
  /** 选中结果；`null` 表示「不设置 / 清除」 */
  onSelect: (student: Student | null) => void;
  onClose: () => void;
}

const StudentPickerSheet: React.FC<StudentPickerSheetProps> = ({
  visible,
  title = '选择推荐人',
  selectedId,
  excludeStudentId,
  onSelect,
  onClose,
}) => {
  const [keyword, setKeyword] = useState('');
  const [list, setList] = useState<Student[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  /** 只保留最后一次请求的结果，避免快速输入时旧请求覆盖新结果 */
  const requestIdRef = useRef(0);
  const loadingRef = useRef(false);

  const runLoad = useCallback(
    async (targetPage: number, reset: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      try {
        const result = await studentService.getPageByTeacher(
          '',
          targetPage,
          PAGE_SIZE,
          undefined,
          keyword.trim() || undefined,
        );
        // 过期请求直接丢弃
        if (requestId !== requestIdRef.current) return;
        const rows = filterActiveStudents(result.list).filter((s) => s.id !== excludeStudentId);
        setList((prev) => (reset ? rows : [...prev, ...rows]));
        setPage(targetPage);
        setHasMore(targetPage < result.pagination.totalPages);
      } catch {
        if (requestId === requestIdRef.current) {
          setList([]);
          setHasMore(false);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [excludeStudentId, keyword],
  );

  // 打开时重置并拉第一页；关键词变化后重新搜索（300ms 防抖，避免每敲一个字都发请求）
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(
      () => {
        void runLoad(1, true);
      },
      keyword ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [visible, keyword, runLoad]);

  const handleSelect = (student: Student | null) => {
    onSelect(student);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      title={title}
      onClose={onClose}
      heightRatio={2 / 3}
      fillHeight
      // 与 StudentMultiSelectSheet 同款：外层不包 ScrollView，由本组件内部 flex-1 ScrollView 管理列表
      scrollable={false}
    >
      <View className="flex flex-col h-full px-[32rpx]">
        {/* 搜索栏 */}
        <View className="shrink-0 flex flex-row items-center gap-[16rpx] pt-[8rpx] pb-[24rpx]">
          <View className="flex-1 h-[72rpx] px-[24rpx] rounded-button bg-muted flex flex-row items-center gap-[12rpx]">
            <Icon name="mdi-magnify" size={32} color="mutedForeground" />
            <Input
              className="flex-1 text-[28rpx] text-foreground"
              placeholder="搜索学员姓名/手机号"
              placeholderClass="text-muted-foreground"
              value={keyword}
              onInput={(e) => setKeyword(e.detail.value || '')}
              confirmType="search"
            />
            {keyword.length > 0 && (
              <View
                className="w-[40rpx] h-[40rpx] rounded-full bg-muted-foreground/20 flex items-center justify-center active:opacity-70"
                onClick={() => setKeyword('')}
              >
                <Icon name="mdi-close" size={24} color="mutedForeground" />
              </View>
            )}
          </View>
        </View>

        {/* 「不设置推荐人」：显式清除入口 —— 单选字段必须能回到"无"，否则选错就没法改回来 */}
        <View
          className="shrink-0 mb-[16rpx] py-[20rpx] flex flex-row items-center justify-between press-scale"
          onClick={() => handleSelect(null)}
        >
          <Text className="text-[28rpx] text-muted-foreground">不设置推荐人</Text>
          {!selectedId && <Text className="text-primary text-[32rpx] font-semibold">✓</Text>}
        </View>

        <ScrollView
          scrollY
          className="flex-1 min-h-0"
          onScrollToLower={() => {
            if (hasMore && !loading) void runLoad(page + 1, false);
          }}
        >
          {list.map((stu) => {
            const selected = stu.id === selectedId;
            return (
              <StudentListCard
                key={stu.id}
                variant="row"
                name={stu.name}
                nickname={stu.nickname}
                avatarUrl={stu.avatar_url}
                selected={selected}
                subtitle={stu.phone || '暂无手机号'}
                right={
                  selected ? (
                    <Text className="text-primary text-[32rpx] font-semibold">✓</Text>
                  ) : null
                }
                onClick={() => handleSelect(stu)}
              />
            );
          })}

          {list.length === 0 && !loading && (
            <Empty description={keyword ? '没有匹配的学员' : '暂无可选学员'} />
          )}
          {loading && (
            <View className="py-[24rpx] text-center">
              <Text className="text-[26rpx] text-muted-foreground">加载中...</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </BottomSheet>
  );
};

export default StudentPickerSheet;
