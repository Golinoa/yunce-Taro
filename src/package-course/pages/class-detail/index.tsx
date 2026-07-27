import { View, Text } from '@tarojs/components';
import React from 'react';
import Avatar from '@/components/Avatar';
import ClassAvatar from '@/components/class/ClassAvatar';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { withRouteGuard } from '@/utils/route-guard';
import AddStudentSheet from './AddStudentSheet';
import { CLASS_GRADIENT, formatDateCN } from './constants';
import TransferSheet from './TransferSheet';
import { useClassDetail } from './useClassDetail';

const ClassDetail: React.FC = () => {
  const detail = useClassDetail();

  const {
    classId,
    classInfo,
    students,
    loading,
    loadError,
    notFound,
    isEnded,
    isUnlimited,
    checkinRecords,
    endingClass,
    addingStudents,
    transferring,
    showAddSheet,
    setShowAddSheet,
    filteredAvailableStudents,
    selectedStudentIds,
    addSearchQuery,
    setAddSearchQuery,
    toggleAddStudent,
    handleOpenAdd,
    handleConfirmAdd,
    showTransferSheet,
    setShowTransferSheet,
    transferStudentName,
    allClasses,
    handleConfirmTransfer,
    expandedCheckins,
    expandedMore,
    toggleCheckinExpand,
    toggleMoreStudents,
    reload,
    goLessonForm,
    goEdit,
    goStudentDetail,
    handleEndClass,
    handleStudentLongPress,
  } = detail;

  if (loading) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-50">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  if (!classInfo) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-gradient-subtle px-8 flex items-center justify-center">
          <Empty
            icon={notFound ? 'mdi-school-outline' : 'mdi-alert-circle'}
            description={
              notFound ? '未找到对应班级信息' : loadError || '班级详情加载失败，请稍后重试'
            }
            actionText={notFound ? '返回上一页' : '重新加载'}
            onAction={notFound ? () => void Taro.navigateBack() : () => void reload()}
          />
        </View>
      </PageContainer>
    );
  }

  const color = isEnded ? 'purple' : classInfo.color || 'primary';

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen bg-gradient-subtle">
        {/* ====== 1. 头部区域 ====== */}
        <View className={`${CLASS_GRADIENT[color]} px-6 pt-10 pb-8`}>
          <View className="flex items-center gap-4">
            <ClassAvatar size="lg" />
            <View className="flex-1 min-w-0">
              <Text className="text-white text-xl font-bold block truncate">{classInfo.name}</Text>
              <View className="flex items-center gap-2 mt-1">
                {isEnded ? (
                  <View className="tag-purple">已结课</View>
                ) : isUnlimited ? (
                  <View className="tag-white">∞ 循环</View>
                ) : (
                  <View className="tag-white">{classInfo.total_lessons}课时制</View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* ====== 2. 内容区域 ====== */}
        <View className="px-5 -mt-4 relative z-10 pb-32">
          {/* 统计卡片 - 3列 */}
          {isEnded ? (
            <View className="bg-white rounded-2xl p-5 shadow-soft mb-3">
              <View className="grid grid-cols-3 gap-2">
                <View className="stat-card bg-purple-bg">
                  <Text className="stat-value text-purple">{classInfo.used_lessons}</Text>
                  <Text className="stat-label">已上课时</Text>
                </View>
                <View className="stat-card bg-purple-bg">
                  <Text className="stat-value text-purple">{classInfo.total_lessons}</Text>
                  <Text className="stat-label">总课时</Text>
                </View>
                <View className="stat-card bg-purple-bg">
                  <Text className="stat-value text-purple">{students.length}</Text>
                  <Text className="stat-label">学生数</Text>
                </View>
              </View>
            </View>
          ) : (
            <View className="bg-white rounded-2xl p-5 shadow-soft mb-3">
              <View className="grid grid-cols-3 gap-2">
                <View className="stat-card bg-primary-bg">
                  {isUnlimited ? (
                    <Text className="stat-value text-primary">∞</Text>
                  ) : (
                    <Text className="stat-value text-primary">{classInfo.used_lessons}</Text>
                  )}
                  <Text className="stat-label">已上课时</Text>
                </View>
                <View className="stat-card bg-primary-bg">
                  {isUnlimited ? (
                    <Text className="stat-value text-primary">∞</Text>
                  ) : (
                    <Text className="stat-value text-primary">{classInfo.total_lessons}</Text>
                  )}
                  <Text className="stat-label">总课时</Text>
                </View>
                <View className="stat-card bg-primary-bg">
                  <Text className="stat-value text-primary">{students.length}</Text>
                  <Text className="stat-label">学生数</Text>
                </View>
              </View>
            </View>
          )}

          {/* 上课安排 */}
          <View className="bg-white rounded-2xl p-5 shadow-soft mb-3">
            <Text className="text-base font-semibold text-foreground block mb-2">上课安排</Text>
            {classInfo.schedule && (
              <Text className="text-sm text-muted-foreground block">{classInfo.schedule}</Text>
            )}
            {classInfo.campus_name && (
              <Text className="text-sm text-muted-foreground block mt-1">
                校区：{classInfo.campus_name}
              </Text>
            )}
            {classInfo.start_date && classInfo.end_date && (
              <Text className="text-sm text-muted-foreground block mt-1">
                {formatDateCN(classInfo.start_date)} - {formatDateCN(classInfo.end_date)}
              </Text>
            )}
            {classInfo.note && (
              <Text className="text-sm text-muted-foreground/70 block mt-2">{classInfo.note}</Text>
            )}
          </View>

          {/* 课时进度 */}
          <View className="bg-white rounded-2xl p-5 shadow-soft mb-3">
            <Text className="text-base font-semibold text-foreground block mb-3">课时进度</Text>
            {isEnded ? (
              <View>
                <View className="flex justify-between mb-2">
                  <Text className="text-sm text-muted-foreground">课时进度</Text>
                  <Text className="text-sm font-semibold text-purple">
                    {classInfo.used_lessons} / {classInfo.total_lessons} 已完成
                  </Text>
                </View>
                <View className="h-2 rounded-sm overflow-hidden bg-progress-purple-track">
                  <View className="h-full rounded-sm bg-progress-purple w-full" />
                </View>
              </View>
            ) : isUnlimited ? (
              <View>
                <View className="flex justify-between mb-2">
                  <Text className="text-sm text-muted-foreground">上课进度</Text>
                  <Text className="text-sm font-semibold text-primary">循环上课</Text>
                </View>
                <View className="h-2 rounded-sm overflow-hidden bg-progress-primary" />
              </View>
            ) : (
              <View>
                <View className="flex justify-between mb-2">
                  <Text className="text-sm text-muted-foreground">课时进度</Text>
                  <Text className="text-sm font-semibold text-primary">
                    {classInfo.used_lessons} / {classInfo.total_lessons}
                  </Text>
                </View>
                <View className="h-2 rounded-sm overflow-hidden bg-progress-primary-track">
                  <View
                    className="h-full rounded-sm bg-progress-primary"
                    style={{
                      width: `${classInfo.total_lessons ? Math.round((classInfo.used_lessons / classInfo.total_lessons) * 100) : 0}%`,
                    }}
                  />
                </View>
              </View>
            )}
          </View>

          {/* ====== 已结课：收费与流水 ====== */}
          {isEnded && (
            <View className="bg-white rounded-2xl p-5 shadow-soft mb-3">
              <Text className="text-base font-semibold text-foreground block mb-3">收费与流水</Text>
              <View className="grid grid-cols-3 gap-2">
                <View className="stat-card bg-purple-10">
                  <Text className="stat-value text-purple">¥{classInfo.pricePerLesson ?? '-'}</Text>
                  <Text className="stat-label">每课时单价</Text>
                </View>
                <View className="stat-card bg-purple-10">
                  <Text className="stat-value text-purple">¥{classInfo.packagePrice ?? '-'}</Text>
                  <Text className="stat-label">课包价格/人</Text>
                </View>
                <View className="stat-card bg-primary-5">
                  <Text className="stat-value text-primary">¥{classInfo.totalRevenue ?? '-'}</Text>
                  <Text className="stat-label">总流水</Text>
                </View>
              </View>
            </View>
          )}

          {/* ====== 已结课：上课记录 ====== */}
          {isEnded && checkinRecords.length > 0 && (
            <View className="bg-white rounded-2xl p-5 shadow-soft mb-3">
              <Text className="text-base font-semibold text-foreground block mb-3">上课记录</Text>
              <View className="flex flex-col gap-2">
                {checkinRecords.map((record, idx) => {
                  const isExpanded = expandedCheckins.has(idx);
                  const isMoreExpanded = expandedMore.has(idx);
                  const visibleStudents = isMoreExpanded
                    ? record.students
                    : record.students.slice(0, 8);
                  const hasMore = record.students.length > 8 && !isMoreExpanded;

                  return (
                    <View
                      key={idx}
                      className="bg-background rounded-xl p-3"
                      onClick={() => toggleCheckinExpand(idx)}
                    >
                      <View className="flex items-center gap-2">
                        <View className="w-dot h-dot rounded-full bg-purple flex-shrink-0" />
                        <Text className="text-sm font-semibold text-foreground flex-1">
                          {record.date}
                        </Text>
                        <Text className="text-sm text-muted-foreground">👤 {record.count}人</Text>
                        <Text className="text-sm text-purple font-medium">👩‍🏫 {record.teacher}</Text>
                        <Text
                          className={`text-sm text-muted-foreground transition ${isExpanded ? 'rotate-180' : ''}`}
                        >
                          ▼
                        </Text>
                      </View>
                      {isExpanded && (
                        <View className="pt-3 mt-3 border-t border-border flex flex-wrap gap-1">
                          {visibleStudents.map((name, si) => (
                            <View
                              key={si}
                              className="flex items-center gap-1 bg-white rounded-full px-2 py-1"
                            >
                              <Avatar name={name} size="sm" />
                              <Text className="text-xs text-foreground">{name}</Text>
                            </View>
                          ))}
                          {hasMore && (
                            <View
                              className="bg-purple-10 rounded-full px-3 py-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMoreStudents(idx);
                              }}
                            >
                              <Text className="text-xs text-purple font-medium">
                                +{record.students.length - 8}人
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ====== 学生列表 ====== */}
          <View className="bg-white rounded-2xl p-5 shadow-soft mb-3">
            <View className="flex items-center justify-between mb-3">
              <Text className="text-base font-semibold text-foreground">
                学员 ({students.length})
              </Text>
              {!isEnded && (
                <View
                  className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary-5"
                  onClick={handleOpenAdd}
                >
                  <Text className="text-sm text-primary font-medium">+ 添加</Text>
                </View>
              )}
            </View>
            {students.length === 0 ? (
              <View className="py-8 text-center">
                <Text className="text-sm text-muted-foreground">暂无学员</Text>
              </View>
            ) : (
              <View className="flex flex-col gap-2">
                {students.map((stu) => (
                  <View
                    key={stu.id}
                    className="flex items-center gap-3 py-2"
                    onClick={() => goStudentDetail(stu.id)}
                    onLongPress={() => handleStudentLongPress(stu.id, stu.name)}
                  >
                    <Avatar name={stu.name} avatarUrl={stu.avatar_url} size="sm" />
                    <View className="flex-1 min-w-0">
                      <Text className="text-base font-medium text-foreground">{stu.name}</Text>
                      {stu.phone && (
                        <Text className="text-sm text-muted-foreground block mt-0_d5">
                          {stu.phone}
                        </Text>
                      )}
                    </View>
                    <Text className="text-sm text-muted-foreground">›</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ====== 底部操作栏 ====== */}
        <View className="fixed bottom-0 left-0 right-0 px-5 py-4 bg-white/95 backdrop-blur-sm border-t border-input flex gap-3 z-50">
          {addingStudents || transferring || endingClass ? (
            <View className="absolute left-5 right-5 top-[-64rpx] rounded-[16rpx] bg-white/95 px-4 py-3 shadow-soft">
              <Text className="text-sm text-muted-foreground">
                {addingStudents
                  ? '正在添加学员，请稍候...'
                  : transferring
                    ? '正在调班，请稍候...'
                    : '正在结课，请稍候...'}
              </Text>
            </View>
          ) : null}
          {isEnded ? (
            <View className="btn-primary flex-1 border border-input bg-white" onClick={goEdit}>
              <Text className="text-base font-semibold text-muted-foreground">编辑</Text>
            </View>
          ) : (
            <>
              <View
                className={`btn-primary flex-1 ${addingStudents || transferring || endingClass ? 'bg-border' : 'shadow-elegant bg-gradient-primary'}`}
                onClick={addingStudents || transferring || endingClass ? undefined : goLessonForm}
              >
                <Text
                  className={`text-base font-semibold ${addingStudents || transferring || endingClass ? 'text-muted-foreground' : 'text-white'}`}
                >
                  消课
                </Text>
              </View>
              <View
                className={`btn-primary flex-1 border ${addingStudents || transferring || endingClass ? 'border-border bg-muted' : 'border-input bg-white'}`}
                onClick={addingStudents || transferring || endingClass ? undefined : goEdit}
              >
                <Text className="text-base font-semibold text-muted-foreground">编辑</Text>
              </View>
              <View
                className={`btn-primary flex-1 border ${addingStudents || transferring || endingClass ? 'border-border bg-muted' : 'border-purple bg-white'}`}
                onClick={addingStudents || transferring || endingClass ? undefined : handleEndClass}
              >
                <Text
                  className={`text-base font-semibold ${addingStudents || transferring || endingClass ? 'text-muted-foreground' : 'text-purple'}`}
                >
                  {endingClass ? '结课中...' : '结课'}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* ====== 添加学员弹窗 ====== */}
        <AddStudentSheet
          show={showAddSheet}
          availableStudents={filteredAvailableStudents}
          selectedStudentIds={selectedStudentIds}
          addSearchQuery={addSearchQuery}
          confirming={addingStudents}
          onSearchChange={setAddSearchQuery}
          onToggleStudent={toggleAddStudent}
          onConfirm={handleConfirmAdd}
          onClose={() => setShowAddSheet(false)}
        />

        {/* ====== 调班弹窗 ====== */}
        <TransferSheet
          show={showTransferSheet}
          studentName={transferStudentName}
          currentClassId={classId}
          allClasses={allClasses}
          submitting={transferring}
          onConfirm={handleConfirmTransfer}
          onClose={() => setShowTransferSheet(false)}
        />
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(ClassDetail);
