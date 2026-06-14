import { View, Text } from '@tarojs/components';
import React, { useState, useCallback } from 'react';
import BottomSheet from '@/components/BottomSheet';
import PickerItem from '@/components/PickerItem';
import type { Class } from '@/types/class';

interface ClassSelectorProps {
  classes: Class[];
  selectedClassId: string | null;
  onSelect: (classId: string) => void;
}

const ClassSelector: React.FC<ClassSelectorProps> = ({ classes, selectedClassId, onSelect }) => {
  const [showSwitcher, setShowSwitcher] = useState(false);

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const handleSwitch = useCallback(
    (classId: string) => {
      onSelect(classId);
      setShowSwitcher(false);
    },
    [onSelect],
  );

  // 班级图标颜色映射
  const colorMap: Record<string, string> = {
    primary: '#5EC8A8',
    accent: '#E89BB8',
    amber: '#D4A24E',
    info: '#6BA3D6',
    purple: '#9b7ed8',
  };

  const getColor = (color?: string) => colorMap[color || ''] || '#5EC8A8';

  return (
    <View className="flex flex-col gap-3">
      {selectedClass ? (
        /* 已选班级：只显示选中项 + 更换按钮 */
        <View className="bg-white rounded-2xl shadow-card p-1">
          <PickerItem
            iconType="icon"
            iconBgColor={`${getColor(selectedClass.color)}20`}
            iconColor={getColor(selectedClass.color)}
            title={selectedClass.name}
            subtitle={`${selectedClass.schedule || ''} · ${selectedClass.student_count}人`}
            selected
            right={{ type: 'change-btn', onChangeClick: () => setShowSwitcher(true) }}
          />
        </View>
      ) : (
        /* 未选班级：显示全部 + 勾选框 */
        classes.map((cls) => (
          <View
            key={cls.id}
            className="bg-white rounded-2xl shadow-card p-2 press-bg"
            onClick={() => handleSwitch(cls.id)}
          >
            <PickerItem
              iconType="icon"
              iconBgColor={`${getColor(cls.color)}20`}
              iconColor={getColor(cls.color)}
              title={cls.name}
              subtitle={`${cls.schedule || ''} · ${cls.student_count}人`}
              selected={cls.id === selectedClassId}
              right={{
                type: 'checkbox',
                checked: cls.id === selectedClassId,
                onCheckChange: () => handleSwitch(cls.id),
              }}
            />
          </View>
        ))
      )}

      {classes.length === 0 && (
        <View className="py-10 text-center bg-white rounded-3xl shadow-soft">
          <Text className="text-base text-muted-foreground">暂无班级，请先创建班级</Text>
        </View>
      )}

      {/* 更换班级弹窗 */}
      <BottomSheet
        show={showSwitcher}
        visible={showSwitcher}
        title="更换班级"
        onClose={() => setShowSwitcher(false)}
      >
        <View className="p-5 flex flex-col gap-2">
          {classes.map((cls) => (
            <PickerItem
              key={cls.id}
              iconType="icon"
              iconBgColor={`${getColor(cls.color)}20`}
              iconColor={getColor(cls.color)}
              title={cls.name}
              subtitle={`${cls.schedule || ''} · ${cls.student_count}人`}
              selected={cls.id === selectedClassId}
              disabled={cls.id === selectedClassId}
              right={cls.id === selectedClassId ? { type: 'tag', tagText: '当前' } : undefined}
              onClick={() => {
                if (cls.id !== selectedClassId) handleSwitch(cls.id);
              }}
            />
          ))}
        </View>
      </BottomSheet>
    </View>
  );
};

export default ClassSelector;
