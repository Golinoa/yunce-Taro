/**
 * useTeacherNames - 按员工 id 批量解析姓名
 *
 * 使用场景：待办卡片展示协作人 @提及；模块级缓存避免列表重复请求。
 */
import { useEffect, useMemo, useState } from 'react';
import { teacherService } from '@/services';
import { logError } from '@/utils/logger';

let cachedNameMap: Record<string, string> | null = null;
let loadingPromise: Promise<Record<string, string>> | null = null;

async function loadTeacherNameMap(): Promise<Record<string, string>> {
  if (cachedNameMap) return cachedNameMap;
  if (!loadingPromise) {
    loadingPromise = teacherService
      .getActiveList()
      .then((list) => {
        cachedNameMap = Object.fromEntries(list.map((teacher) => [teacher.id, teacher.name]));
        return cachedNameMap;
      })
      .catch((err) => {
        logError('useTeacherNames loadTeacherNameMap', err);
        loadingPromise = null;
        return {};
      });
  }
  return loadingPromise;
}

/**
 * 根据教师 id 列表返回对应姓名（顺序与 ids 一致，未命中则跳过）
 */
export function useTeacherNames(ids?: string[]): string[] {
  const [nameMap, setNameMap] = useState<Record<string, string>>(cachedNameMap || {});

  useEffect(() => {
    if (!ids?.length) return;
    let cancelled = false;
    void loadTeacherNameMap().then((map) => {
      if (!cancelled) setNameMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return useMemo(() => {
    if (!ids?.length) return [];
    return ids.map((id) => nameMap[id]).filter((name): name is string => Boolean(name));
  }, [ids, nameMap]);
}
