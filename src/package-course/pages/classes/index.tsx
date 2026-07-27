import { View, Text, Input } from '@tarojs/components';
import React from 'react';
import ClassAvatar from '@/components/class/ClassAvatar';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import { withRouteGuard } from '@/utils/route-guard';
import CreateClassSheet from './CreateClassSheet';
import { useClasses, TABS } from './useClasses';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

/** 班级管理页面 */
const ClassesPage: React.FC = () => {
  const {
    loading,
    loadError,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    stats,
    groupedClasses,
    goDetail,
    goLessonForm,
    handleDelete,
    // 创建弹窗
    showCreateSheet,
    createVisible,
    openCreateSheet,
    closeCreateSheet,
    name,
    setName,
    classType,
    setClassType,
    teachMode,
    setTeachMode,
    weekdays,
    toggleWeekday,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    teachers,
    toggleTeacher,
    teacherOptions,
    selectedStudentIds,
    saving,
    deletingClassId,
    scheduleText,
    submitBlockedReason,
    canCreate,
    handleCreate,
    selectedPackageId,
    setSelectedPackageId,
    packageTemplates,
    showPackagePicker,
    setShowPackagePicker,
    packagePickerVisible,
    setPackagePickerVisible,
    showStudentPicker,
    pickerVisible,
    openStudentPicker,
    closeStudentPicker,
    pickerSearch,
    setPickerSearch,
    pickerTempIds,
    togglePickerStudent,
    confirmStudentPicker,
    filteredStudents,
    color,
    setColor,
    icon,
    setIcon,
    reload,
  } = useClasses();

  /** 格式化日期为短格式 M/D */
  const formatShortDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // 渲染类型标签
  const renderTypeTag = (cls: { type: string; total_lessons?: number }) => {
    if (cls.type === 'unlimited') {
      return <View className="tag-primary">循环</View>;
    }
    return <View className="tag-amber">{cls.total_lessons ?? 0}课时</View>;
  };

  // 渲染状态标签
  const renderStatusTag = (cls: { status: string }) => {
    if (cls.status === 'ended') {
      return <View className="tag-purple">已结课</View>;
    }
    return null; // 进行中不显示标签，减少文字叠加
  };

  // 渲染右侧统计区（对齐设计稿：数值+箭头按钮）
  const renderStat = (cls: {
    id: string;
    status: string;
    type: string;
    used_lessons: number;
    total_lessons?: number;
  }) => {
    if (cls.type === 'unlimited') {
      return (
        <View className="flex items-center gap-2 flex-shrink-0">
          <View className="flex flex-col items-end">
            <Text className="text-primary text-lg font-bold">∞</Text>
            <Text className="text-muted-foreground text-[20rpx]">循环</Text>
          </View>
          {cls.status === 'active' && (
            <View
              className="w-[60rpx] h-[60rpx] rounded-[16rpx] bg-primary-bg flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                goLessonForm(cls.id);
              }}
            >
              <Icon name="mdi-arrow-right" size={28} color="primary" />
            </View>
          )}
        </View>
      );
    }
    return (
      <View className="flex items-center gap-2 flex-shrink-0">
        <View className="flex flex-col items-end">
          <Text className="text-foreground text-base font-bold">
            {cls.used_lessons}/{cls.total_lessons}
          </Text>
          <Text className="text-muted-foreground text-[20rpx]">已消/总课时</Text>
        </View>
        {cls.status === 'active' && (
          <View
            className="w-[60rpx] h-[60rpx] rounded-[16rpx] bg-primary-bg flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              goLessonForm(cls.id);
            }}
          >
            <Icon name="mdi-arrow-right" size={28} color="primary" />
          </View>
        )}
      </View>
    );
  };

  // 骨架屏
  if (loading) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-gradient-subtle">
          <View className="bg-gradient-primary px-5 pt-10 pb-5">
            <View className="flex items-center justify-between">
              <Text className="text-2xl font-bold text-white">班级管理</Text>
            </View>
            <View className="flex items-center gap-2 mt-3">
              <View className="flex-1 rounded-xl px-4 py-2_d5 flex items-center gap-2 bg-glass-25">
                <Text className="text-white/60 text-sm">🔍</Text>
                <Input
                  className="flex-1 text-sm text-white"
                  placeholder="搜索班级..."
                  placeholderClass="text-white/60"
                  value={searchQuery}
                  onInput={(e) => setSearchQuery(e.detail.value)}
                />
              </View>
              <View
                className="w-10 h-10 rounded-xl bg-white/25 center press-scale"
                onClick={openCreateSheet}
              >
                <Text className="text-white text-lg font-bold">+</Text>
              </View>
            </View>
            <View className="mt-3 rounded-xl px-4 py-3 flex bg-glass-15">
              <View className="flex-1 center-col">
                <Text className="text-white text-lg font-bold">{stats.totalClasses}</Text>
                <Text className="text-white/70 text-sm">班级总数</Text>
              </View>
              <View className="w-px h-10 bg-white/20" />
              <View className="flex-1 center-col">
                <Text className="text-white text-lg font-bold">{stats.totalStudents}</Text>
                <Text className="text-white/70 text-sm">学生总数</Text>
              </View>
              <View className="w-px h-10 bg-white/20" />
              <View className="flex-1 center-col">
                <Text className="text-white text-lg font-bold">{stats.totalUsedLessons}</Text>
                <Text className="text-white/70 text-sm">已消课时</Text>
              </View>
            </View>
          </View>
          <View className="px-5 mt-4 flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <View key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <View className="flex items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-gray-100" />
                  <View className="flex-1">
                    <View className="h-4 w-24 bg-gray-100 rounded mb-2" />
                    <View className="h-3 w-32 bg-gray-100 rounded" />
                  </View>
                </View>
              </View>
            ))}
          </View>
          <CreateClassSheet
            show={showCreateSheet}
            visible={createVisible}
            onClose={closeCreateSheet}
            name={name}
            setName={setName}
            classType={classType}
            setClassType={setClassType}
            teachMode={teachMode}
            setTeachMode={setTeachMode}
            weekdays={weekdays}
            toggleWeekday={toggleWeekday}
            startTime={startTime}
            setStartTime={setStartTime}
            endTime={endTime}
            setEndTime={setEndTime}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            teachers={teachers}
            toggleTeacher={toggleTeacher}
            teacherOptions={teacherOptions}
            selectedStudentIds={selectedStudentIds}
            scheduleText={scheduleText}
            saving={saving}
            handleCreate={handleCreate}
            selectedPackageId={selectedPackageId}
            setSelectedPackageId={setSelectedPackageId}
            packageTemplates={packageTemplates}
            showPackagePicker={showPackagePicker}
            setShowPackagePicker={setShowPackagePicker}
            packagePickerVisible={packagePickerVisible}
            setPackagePickerVisible={setPackagePickerVisible}
            showStudentPicker={showStudentPicker}
            pickerVisible={pickerVisible}
            openStudentPicker={openStudentPicker}
            closeStudentPicker={closeStudentPicker}
            pickerSearch={pickerSearch}
            setPickerSearch={setPickerSearch}
            pickerTempIds={pickerTempIds}
            togglePickerStudent={togglePickerStudent}
            confirmStudentPicker={confirmStudentPicker}
            filteredStudents={filteredStudents}
            canCreate={canCreate}
            submitBlockedReason={submitBlockedReason}
            color={color}
            setColor={setColor}
            icon={icon}
            setIcon={setIcon}
          />
        </View>
      </PageContainer>
    );
  }

  if (loadError) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-gradient-subtle px-8 flex items-center justify-center">
          <Empty
            icon="mdi-alert-circle"
            description={loadError}
            actionText="重新加载"
            onAction={() => void reload()}
          />
        </View>
        <CreateClassSheet
          show={showCreateSheet}
          visible={createVisible}
          onClose={closeCreateSheet}
          name={name}
          setName={setName}
          classType={classType}
          setClassType={setClassType}
          teachMode={teachMode}
          setTeachMode={setTeachMode}
          weekdays={weekdays}
          toggleWeekday={toggleWeekday}
          startTime={startTime}
          setStartTime={setStartTime}
          endTime={endTime}
          setEndTime={setEndTime}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          teachers={teachers}
          toggleTeacher={toggleTeacher}
          teacherOptions={teacherOptions}
          selectedStudentIds={selectedStudentIds}
          scheduleText={scheduleText}
          saving={saving}
          canCreate={canCreate}
          submitBlockedReason={submitBlockedReason}
          handleCreate={handleCreate}
          selectedPackageId={selectedPackageId}
          setSelectedPackageId={setSelectedPackageId}
          packageTemplates={packageTemplates}
          showPackagePicker={showPackagePicker}
          setShowPackagePicker={setShowPackagePicker}
          packagePickerVisible={packagePickerVisible}
          setPackagePickerVisible={setPackagePickerVisible}
          showStudentPicker={showStudentPicker}
          pickerVisible={pickerVisible}
          openStudentPicker={openStudentPicker}
          closeStudentPicker={closeStudentPicker}
          pickerSearch={pickerSearch}
          setPickerSearch={setPickerSearch}
          pickerTempIds={pickerTempIds}
          togglePickerStudent={togglePickerStudent}
          confirmStudentPicker={confirmStudentPicker}
          filteredStudents={filteredStudents}
          color={color}
          setColor={setColor}
          icon={icon}
          setIcon={setIcon}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View className="min-h-screen bg-gradient-subtle pb-20">
        {/* 导航栏 */}
        <View className="bg-gradient-primary px-5 pt-10 pb-5">
          <View className="flex items-center justify-between">
            <Text className="text-2xl font-bold text-white">班级管理</Text>
          </View>
          <View className="mt-3 rounded-xl px-4 py-3 flex bg-white/20">
            <View className="flex-1 center-col">
              <Text className="text-white text-xl font-bold">{stats.totalClasses}</Text>
              <Text className="text-white/90 text-xs mt-[2rpx]">班级总数</Text>
            </View>
            <View className="w-px h-10 bg-white/25" />
            <View className="flex-1 center-col">
              <Text className="text-white text-xl font-bold">{stats.totalStudents}</Text>
              <Text className="text-white/90 text-xs mt-[2rpx]">学生总数</Text>
            </View>
            <View className="w-px h-10 bg-white/25" />
            <View className="flex-1 center-col">
              <Text className="text-white text-xl font-bold">{stats.totalUsedLessons}</Text>
              <Text className="text-white/90 text-xs mt-[2rpx]">已消课时</Text>
            </View>
          </View>
          <View className="flex items-center gap-2 mt-3">
            <View className="flex-1 rounded-xl px-4 py-2_d5 flex items-center gap-2 bg-glass-25">
              <Text className="text-white/60 text-sm">🔍</Text>
              <Input
                className="flex-1 text-sm text-white"
                placeholder="搜索班级..."
                placeholderClass="text-white/60"
                value={searchQuery}
                onInput={(e) => setSearchQuery(e.detail.value)}
              />
              {searchQuery && (
                <Text className="text-white/60 text-xs" onClick={() => setSearchQuery('')}>
                  ✕
                </Text>
              )}
            </View>
            <View
              className="w-10 h-10 rounded-xl bg-white/25 center press-scale"
              onClick={openCreateSheet}
            >
              <Text className="text-white text-lg font-bold">+</Text>
            </View>
          </View>
        </View>

        {/* Tab筛选栏 */}
        <View className="bg-white shadow-sm">
          <View className="flex">
            {TABS.map((tab) => (
              <View
                key={tab.key}
                className="flex-1 flex items-center justify-center py-3_d5 relative"
                onClick={() => setActiveTab(tab.key)}
              >
                <Text
                  className={`text-base font-medium ${activeTab === tab.key ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {tab.label}
                </Text>
                {activeTab === tab.key && (
                  <View className="absolute bottom-0 left-0 right-0 h-0_d5 bg-primary" />
                )}
              </View>
            ))}
          </View>
          {!USE_MOCK && (
            <View className="px-5 py-3 bg-warning/10 border-t border-warning/20">
              <Text className="text-[22rpx] text-warning">
                当前联调阶段快速创建班级仅提交班级名称与排课描述，授课老师与课包配置先保留为前端展示项
              </Text>
            </View>
          )}
        </View>

        {/* 班级列表 */}
        {groupedClasses.length === 0 ? (
          <View className="px-8 pt-40">
            <Empty
              icon="mdi-account-group-outline"
              description={
                searchQuery
                  ? '没有找到匹配的班级，请试试其他关键词'
                  : activeTab === 'active'
                    ? '暂无进行中班级'
                    : activeTab === 'ended'
                      ? '暂无已结课班级'
                      : '暂无班级，点击创建第一个班级'
              }
              actionText={searchQuery ? '清空搜索' : '创建班级'}
              onAction={searchQuery ? () => setSearchQuery('') : openCreateSheet}
            />
          </View>
        ) : (
          <View className="px-5 pt-4 flex flex-col gap-4">
            {deletingClassId ? (
              <View className="rounded-[16rpx] bg-white/95 px-4 py-3 shadow-soft">
                <Text className="text-sm text-muted-foreground">正在删除班级，请稍候...</Text>
              </View>
            ) : null}
            {groupedClasses.map((group) => (
              <View key={group.title}>
                <View className="flex items-baseline gap-1 mb-2">
                  <Text className="text-sm font-medium text-muted-foreground">{group.title}</Text>
                  {group.subtitle && (
                    <Text className="text-xs text-muted-foreground/60">（{group.subtitle}）</Text>
                  )}
                </View>
                <View className="flex flex-col gap-2_d5">
                  {group.classes.map((cls) => (
                    <View
                      key={cls.id}
                      className={`bg-white rounded-[28rpx] px-[28rpx] py-[24rpx] shadow-soft ${deletingClassId === cls.id ? 'opacity-60' : 'press-bg'}`}
                      onClick={deletingClassId ? undefined : () => goDetail(cls.id)}
                      onLongPress={
                        deletingClassId ? undefined : () => handleDelete(cls.id, cls.name)
                      }
                    >
                      <View className="flex items-center gap-[20rpx]">
                        {/* 左侧班级头像 */}
                        <ClassAvatar />
                        {/* 中间信息区 */}
                        <View className="flex-1 min-w-0">
                          {/* 名称行 */}
                          <View className="flex items-center gap-[12rpx]">
                            <Text className="text-[28rpx] font-semibold text-foreground truncate">
                              {cls.name}
                            </Text>
                            {renderStatusTag(cls)}
                            {renderTypeTag(cls)}
                          </View>
                          {/* 详情行：人数 + 时间/日期 */}
                          <View className="flex items-center gap-[20rpx] mt-[8rpx]">
                            <View className="flex items-center gap-[6rpx]">
                              <Icon name="mdi-account-group" size={22} color="mutedForeground" />
                              <Text className="text-[20rpx] text-muted-foreground">
                                {cls.student_count}人
                              </Text>
                            </View>
                            {/* 课时制显示日期范围，无限课时显示排课时间 */}
                            {cls.type !== 'unlimited' && cls.start_date && cls.end_date ? (
                              <View className="flex items-center gap-[6rpx]">
                                <Icon name="mdi-clock-outline" size={22} color="mutedForeground" />
                                <Text className="text-[20rpx] text-muted-foreground truncate">
                                  {formatShortDate(cls.start_date)}-{formatShortDate(cls.end_date)}
                                </Text>
                              </View>
                            ) : cls.schedule ? (
                              <View className="flex items-center gap-[6rpx]">
                                <Icon name="mdi-clock-outline" size={22} color="mutedForeground" />
                                <Text className="text-[20rpx] text-muted-foreground truncate">
                                  {cls.schedule}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        {/* 右侧统计+箭头 */}
                        {renderStat(cls)}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <CreateClassSheet
        show={showCreateSheet}
        visible={createVisible}
        onClose={closeCreateSheet}
        name={name}
        setName={setName}
        classType={classType}
        setClassType={setClassType}
        teachMode={teachMode}
        setTeachMode={setTeachMode}
        weekdays={weekdays}
        toggleWeekday={toggleWeekday}
        startTime={startTime}
        setStartTime={setStartTime}
        endTime={endTime}
        setEndTime={setEndTime}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        teachers={teachers}
        toggleTeacher={toggleTeacher}
        teacherOptions={teacherOptions}
        selectedStudentIds={selectedStudentIds}
        scheduleText={scheduleText}
        saving={saving}
        canCreate={canCreate}
        submitBlockedReason={submitBlockedReason}
        handleCreate={handleCreate}
        selectedPackageId={selectedPackageId}
        setSelectedPackageId={setSelectedPackageId}
        packageTemplates={packageTemplates}
        showPackagePicker={showPackagePicker}
        setShowPackagePicker={setShowPackagePicker}
        packagePickerVisible={packagePickerVisible}
        setPackagePickerVisible={setPackagePickerVisible}
        showStudentPicker={showStudentPicker}
        pickerVisible={pickerVisible}
        openStudentPicker={openStudentPicker}
        closeStudentPicker={closeStudentPicker}
        pickerSearch={pickerSearch}
        setPickerSearch={setPickerSearch}
        pickerTempIds={pickerTempIds}
        togglePickerStudent={togglePickerStudent}
        confirmStudentPicker={confirmStudentPicker}
        filteredStudents={filteredStudents}
        color={color}
        setColor={setColor}
        icon={icon}
        setIcon={setIcon}
      />
    </PageContainer>
  );
};

export default withRouteGuard(ClassesPage);
