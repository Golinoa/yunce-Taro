/**
 * 「这个班当天有多节课，是哪一节？」
 *
 * 只在**入口没带排课编号**（首页快速消课 / 预约页 / 线索详情）且该班当天确有 ≥2 节时出现。
 * 选中的 `scheduleId` 就是这节课的身份，用于隔离已点名状态、重复点名保护与补课/试听名单。
 *
 * 只有 1 节时本组件不渲染（由 `useClassDayLessons` 自动带上）。
 */
import { View, Text } from '@tarojs/components';
import type { ScheduleDayLesson } from '@/services/schedule';

export interface ClassDayLessonPickerProps {
  lessons: ScheduleDayLesson[];
  pickedScheduleId: string;
  onPick: (scheduleId: string) => void;
}

const ClassDayLessonPicker: React.FC<ClassDayLessonPickerProps> = ({
  lessons,
  pickedScheduleId,
  onPick,
}) => {
  // 只有 ≥2 节才需要老师选：1 节由 useClassDayLessons 自动带上，0 节退回老行为。
  // 加载中不渲染，避免闪一下「当天 0 节」。
  if (lessons.length < 2) {
    return null;
  }

  return (
    <View className="mx-[24rpx] mt-3 rounded-[20rpx] bg-white px-[28rpx] py-[24rpx] shadow-soft">
      <View className="flex items-center justify-between">
        <Text className="text-[30rpx] font-medium text-foreground">请选择是哪一节课</Text>
        <View className="rounded-[8rpx] bg-warning/15 px-[12rpx] py-[2rpx]">
          <Text className="text-[22rpx] text-warning">当天 {lessons.length} 节</Text>
        </View>
      </View>
      <Text className="mt-[8rpx] block text-[24rpx] text-muted-foreground">
        同一班同一天有多节课，点名与补课记录按「哪一节」分开统计
      </Text>

      <View className="mt-[16rpx]">
        {lessons.map((item) => {
          const active = item.scheduleId === pickedScheduleId;
          return (
            <View
              key={item.scheduleId}
              className={`mb-[12rpx] flex items-center justify-between rounded-[16rpx] border px-[20rpx] py-[18rpx] ${
                active ? 'border-primary bg-primary/5' : 'border-black/5 bg-background'
              }`}
              onClick={() => onPick(item.scheduleId)}
            >
              <View className="flex flex-col">
                <Text className="text-[28rpx] text-foreground">
                  {item.startTime}-{item.endTime}
                </Text>
                {item.teacherName ? (
                  <Text className="text-[22rpx] text-muted-foreground">{item.teacherName}</Text>
                ) : null}
              </View>
              <View className="flex items-center">
                {item.totalCount > 0 ? (
                  <Text className="mr-[12rpx] text-[22rpx] text-muted-foreground">
                    已点名 {item.checkedCount}/{item.totalCount}
                  </Text>
                ) : null}
                <Text
                  className={`text-[24rpx] ${active ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {active ? '已选择' : '选择'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default ClassDayLessonPicker;
