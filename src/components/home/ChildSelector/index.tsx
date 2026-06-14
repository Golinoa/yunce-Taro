import { View, Text } from '@tarojs/components';
import React from 'react';
import Avatar from '@/components/Avatar';
import type { Student } from '@/types/student';

interface ChildSelectorProps {
  children: Student[];
  activeId: string;
  onChange: (studentId: string) => void;
}

const ChildSelector: React.FC<ChildSelectorProps> = ({ children, activeId, onChange }) => {
  return (
    <View className="flex gap-4 py-3 overflow-x-auto whitespace-nowrap scrollbar-hide">
      {children.map((child) => {
        const isActive = child.id === activeId;
        return (
          <View
            key={child.id}
            className="flex flex-col items-center gap-1 relative flex-shrink-0 px-2 py-1 press-scale"
            onClick={() => onChange(child.id)}
          >
            <View
              className={`rounded-full border-2 transition ${isActive ? 'border-primary shadow-elegant' : 'border-transparent'}`}
            >
              <Avatar
                name={child.name}
                avatarUrl={child.avatar_url}
                size="md"
                className={isActive ? '' : 'opacity-60'}
              />
            </View>
            <Text
              className={`text-sm transition ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}
            >
              {child.name}
            </Text>
            {isActive && (
              <View className="absolute bottom-0 w-5 h-1_d5 rounded-sm bg-gradient-primary" />
            )}
          </View>
        );
      })}
    </View>
  );
};

export default ChildSelector;
