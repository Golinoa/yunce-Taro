/**
 * NoteDetail - 笔记预览 / 编辑页
 *
 * 从「我的笔记」点击卡片进入预览态；点右上角编辑进入编辑态（退出 / 保存）。
 */
import { View, Text, Textarea } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { useAuth } from '@/utils/auth';
import {
  countNoteChars,
  getUserNoteById,
  removeUserNote,
  updateUserNote,
  type UserNoteRecord,
} from '@/utils/user-notes';
import { withRouteGuard } from '@/utils/route-guard';

type NoteDetailMode = 'preview' | 'edit';

const NoteDetail: React.FC = () => {
  const router = useRouter();
  const noteId = router.params.id || '';
  const { profile } = useAuth();
  const [note, setNote] = useState<UserNoteRecord | null>(null);
  const [mode, setMode] = useState<NoteDetailMode>('preview');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(0);

  const loadNote = useCallback(() => {
    if (!profile?.id || !noteId) {
      setNote(null);
      return;
    }
    const record = getUserNoteById(profile.id, noteId);
    setNote(record);
    if (record) {
      setDraft(record.content);
      historyRef.current = [record.content];
      historyIndexRef.current = 0;
    }
  }, [noteId, profile?.id]);

  useDidShow(() => {
    loadNote();
  });

  const metaText = useMemo(() => {
    if (!note) return '';
    return `${dayjs(note.updatedAt).format('YYYY-MM-DD HH:mm:ss')} · ${countNoteChars(note.content)}字`;
  }, [note]);

  const pushHistory = useCallback((value: string) => {
    const history = historyRef.current.slice(0, historyIndexRef.current + 1);
    if (history[history.length - 1] === value) return;
    history.push(value);
    historyRef.current = history;
    historyIndexRef.current = history.length - 1;
  }, []);

  const handleEnterEdit = useCallback(() => {
    if (!note) return;
    setDraft(note.content);
    historyRef.current = [note.content];
    historyIndexRef.current = 0;
    setMode('edit');
  }, [note]);

  const handleExitEdit = useCallback(() => {
    if (!note) return;
    if (draft.trim() !== note.content) {
      Taro.showModal({
        title: '放弃编辑',
        content: '当前修改尚未保存，确认退出？',
        success: (result) => {
          if (!result.confirm) return;
          setDraft(note.content);
          setMode('preview');
        },
      });
      return;
    }
    setMode('preview');
  }, [draft, note]);

  const handleSave = useCallback(async () => {
    if (!profile?.id || !note) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      Taro.showToast({ title: '笔记内容不能为空', icon: 'none' });
      return;
    }
    setSaving(true);
    try {
      const updated = updateUserNote(profile.id, note.id, { content: trimmed });
      if (!updated) {
        Taro.showToast({ title: '保存失败', icon: 'none' });
        return;
      }
      setNote(updated);
      setMode('preview');
      Taro.showToast({ title: '已保存', icon: 'success' });
    } finally {
      setSaving(false);
    }
  }, [draft, note, profile?.id]);

  const handleDraftInput = useCallback(
    (value: string) => {
      setDraft(value);
      pushHistory(value);
    },
    [pushHistory],
  );

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    setDraft(historyRef.current[historyIndexRef.current] || '');
  }, []);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    setDraft(historyRef.current[historyIndexRef.current] || '');
  }, []);

  const handleOpenMenu = useCallback(() => {
    if (!profile?.id || !note) return;
    Taro.showActionSheet({
      itemList: ['删除笔记'],
      itemColor: '#ef4444',
      success: (result) => {
        if (result.tapIndex !== 0) return;
        Taro.showModal({
          title: '删除笔记',
          content: '删除后无法恢复，确认删除？',
          success: (modalResult) => {
            if (!modalResult.confirm) return;
            removeUserNote(profile.id, note.id);
            Taro.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => {
              Taro.navigateBack();
            }, 300);
          },
        });
      },
    });
  }, [note, profile?.id]);

  if (!note) {
    return (
      <View className="min-h-screen bg-background px-[32rpx] pt-[120rpx]">
        <Text className="text-[28rpx] text-muted-foreground text-center block">笔记不存在或已删除</Text>
      </View>
    );
  }

  if (mode === 'edit') {
    return (
      <View className="min-h-screen bg-background flex flex-col pb-safe-bottom">
        <View className="flex flex-row items-center justify-between px-[32rpx] py-[20rpx] border-b border-border">
          <View className="rounded-full bg-muted px-[28rpx] py-[12rpx] press-scale" onClick={handleExitEdit}>
            <Text className="text-[28rpx] text-foreground">退出</Text>
          </View>
          <View
            className={cn(
              'rounded-full px-[36rpx] py-[12rpx] press-scale',
              saving ? 'bg-muted' : 'bg-primary',
            )}
            onClick={saving ? undefined : handleSave}
          >
            <Text className="text-[28rpx] font-medium text-white">{saving ? '保存中...' : '保存'}</Text>
          </View>
        </View>

        <View className="flex-1 px-[32rpx] pt-[24rpx] pb-[24rpx]">
          <Textarea
            className="w-full min-h-[70vh] text-[30rpx] text-foreground leading-relaxed"
            value={draft}
            maxlength={5000}
            focus
            onInput={(event) => handleDraftInput(event.detail.value || '')}
          />
        </View>

        <View className="border-t border-border px-[32rpx] py-[20rpx] flex flex-row items-center justify-around">
          <View className="press-scale p-[12rpx]" onClick={handleUndo}>
            <Icon name="mdi-history" size="md" color="muted" />
          </View>
          <View className="press-scale p-[12rpx]" onClick={handleRedo}>
            <Icon name="mdi-chevron-right" size="md" color="muted" />
          </View>
          <View className="press-scale p-[12rpx]">
            <Icon name="mdi-image-plus" size="md" color="muted" />
          </View>
          <View className="press-scale p-[12rpx]">
            <Text className="text-[34rpx] text-muted-foreground font-medium">#</Text>
          </View>
          <View className="press-scale p-[12rpx]">
            <Icon name="mdi-calendar-outline" size="md" color="muted" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="min-h-screen bg-background pb-safe-bottom">
      <View className="flex flex-row items-center justify-end gap-[24rpx] px-[32rpx] pt-[16rpx]">
        <View className="press-scale p-[8rpx]" onClick={handleEnterEdit}>
          <Icon name="mdi-pencil" size="md" color="foreground" />
        </View>
        <View className="press-scale p-[8rpx]" onClick={handleOpenMenu}>
          <Icon name="mdi-dots-vertical" size="md" color="foreground" />
        </View>
      </View>

      <View className="px-[32rpx] pt-[12rpx]">
        <Text className="text-[24rpx] text-muted-foreground block">{metaText}</Text>
        <Text className="mt-[32rpx] text-[34rpx] text-foreground leading-relaxed whitespace-pre-wrap block">
          {note.content}
        </Text>
      </View>
    </View>
  );
};

export default withRouteGuard(NoteDetail);
