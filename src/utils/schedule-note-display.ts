/**
 * 排课备注（`note`）在展示层的净化与卡片标题解析
 *
 * 背景（2026-09-28 定位）：排课表单的 `buildScheduleRuleNote()` 会把**排课规则元信息**
 * （`类型:` / `规则:` / `开始:` / `结束:` / `节假日排课:` / `消耗课时:` / `自动开班:` /
 * `每时段可约:` / `最少开班:` / `满人开课:` …）写进 `Schedule.note`；编辑页读回时会再剥掉
 * （见 `package-course/pages/schedule-form/use-schedule-form-loaders.ts`）。
 *
 * 但**后端首页聚合把 `note` 当作「卡片标题」**返回
 * （`yunce-backend/src/home/home-today-schedule.service.ts`：`note: s.note || s.class?.name || '未命名课程'`）
 * ⇒ 元信息被原样当成标题显示成「类型:班课 | 规则:weekly | 开始:2026-09-21 | …」。
 *
 * 本模块负责两件事：
 * 1. `stripScheduleNoteMeta()`：剥掉系统元信息段，**用户原文原样保留**（含其中的 `|`）；
 * 2. `resolveScheduleDisplayTitle()`：给出卡片标题 —— 正式排课以**班级名称**为准，
 *    私教试听（"学员 · 课程"）与场地预约（"用途 · 教室"）保持 `note` 优先，因为它们的
 *    `note` 本身就是拼好的标题、班级名反而会丢信息。
 */

/** 系统元信息「段」的起始键（`|` 分隔后的每一段） */
const META_SEGMENT_RE =
  /^(类型|规则|开始|结束|结束日期|次数|节假日排课|消耗课时|自动开班|每时段可约|最少开班|满人开课|满人开课人数|日期):/;

/**
 * 剥掉 note 中的系统元信息。
 * 逐行处理：**不以元信息键开头的行视为用户原文、整行保留**；元信息行再按 `|` 逐段过滤后去掉。
 */
export function stripScheduleNoteMeta(note?: string | null): string {
  if (!note) return '';
  return note
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!META_SEGMENT_RE.test(trimmed)) return trimmed;
      return trimmed
        .split('|')
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0 && !META_SEGMENT_RE.test(segment))
        .join(' | ');
    })
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

/** `Subject` 表主键（UUID）形态的取值 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 课程分类标签的展示净化。
 *
 * 背景（2026-09-29）：`Class.subject` 存在两代数据——早期直接存科目**名称**（"钢琴"），
 * 现代表单改存 `Subject` 表**主键**（UUID）。后端已统一解析为名称，但对尚未部署该修复的
 * 环境（含历史包），回传值仍可能是一串 UUID，直接渲染就是「看不懂的元信息」。
 * 这类值一律判空不展示：**宁可不显示标签，也不显示一串 ID**。
 */
export function sanitizeScheduleTagLabel(label?: string | null): string | undefined {
  const value = (label || '').trim();
  if (!value) return undefined;
  return UUID_RE.test(value) ? undefined : value;
}

export interface ScheduleDisplayTitleInput {
  /** 排课的原始备注（可能含系统元信息） */
  note?: string | null;
  /** 班级名称（首页聚合的 `class_info.name`） */
  classInfoName?: string | null;
  /** 场次类型：`schedule` 正式排课 / `booking` 试听预约 / `venue` 场地预约 */
  scheduleKind?: string | null;
  /** 试听模式：`private` 私教 / `group` 团课 */
  trialMode?: string | null;
}

/**
 * 卡片标题：
 * - 私教试听、场地预约 → `note` 优先（note 已是"学员 · 课程" / "用途 · 教室"）
 * - 其它（正式排课、团课试听）→ **班级名称优先**，无班级名时用净化后的备注
 */
export function resolveScheduleDisplayTitle(input: ScheduleDisplayTitleInput): string {
  const noteWithoutMeta = stripScheduleNoteMeta(input.note);
  const className = (input.classInfoName || '').trim();
  const noteFirst = input.trialMode === 'private' || input.scheduleKind === 'venue';
  if (noteFirst) {
    return noteWithoutMeta || className || '未命名课程';
  }
  return className || noteWithoutMeta || '未命名课程';
}
