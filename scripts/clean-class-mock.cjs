const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/data/mock-database.ts');
let src = fs.readFileSync(file, 'utf8');

const newInterface = `export interface Class {
  id: string;
  name: string;
  teacherId: string;
  teachers?: string[];
  campusId: string;
  subjectId: string;
  type: 'unlimited' | 'limited';
  scheduleMode?: 'fixed' | 'open';
  autoOpenType?: 'manual' | 'full' | 'time' | 'full_or_time';
  minOpenCount?: number;
  /** 排课展示文案：已挪到排课侧，班级表单不再维护 */
  schedule?: string;
  weekdays?: DayOfWeek[];
  startTime?: string;
  endTime?: string;
  /** 课程时长（分钟），对齐新增班级表单 */
  durationMinutes?: number;
  /** 容纳人数；不填表示不限制 */
  capacity?: number;
  totalLessons?: number;
  usedLessons: number;
  status: 'active' | 'paused' | 'ended';
  startDate?: string;
  endDate?: string;
  color: ClassColor;
  icon: ClassIcon;
  level?: ClassLevel;
  studentCount: number;
  hoursPerLesson?: number;
  pricePerLesson?: number;
  note?: string;
  categoryId?: string;
  createdAt: string;
}`;

src = src.replace(/export interface Class \{[\s\S]*?createdAt: string;\n\}/, newInterface);

src = src.replace(
  /startTime: '(\d{2}):(\d{2})',\n(\s*)endTime: '(\d{2}):(\d{2})',/g,
  (match, sh, sm, indent, eh, em) => {
    const mins = Number(eh) * 60 + Number(em) - (Number(sh) * 60 + Number(sm));
    return (
      'durationMinutes: ' +
      (mins > 0 ? mins : 60) +
      ',\n' +
      indent +
      "startTime: '" +
      sh +
      ':' +
      sm +
      "',\n" +
      indent +
      "endTime: '" +
      eh +
      ':' +
      em +
      "',"
    );
  },
);

if (!src.includes("name: '美术素描班'")) {
  const extras =
    "export const CLASSES: Class[] = [\n" +
    "  {\n" +
    "    id: 'cls-art-sketch',\n" +
    "    name: '美术素描班',\n" +
    "    teacherId: 'teacher-001',\n" +
    "    teachers: ['teacher-001'],\n" +
    "    campusId: 'campus-center',\n" +
    "    subjectId: 'sub-art',\n" +
    "    categoryId: 'cat-class',\n" +
    "    type: 'limited',\n" +
    "    durationMinutes: 90,\n" +
    "    capacity: 12,\n" +
    "    totalLessons: 24,\n" +
    "    usedLessons: 0,\n" +
    "    status: 'active',\n" +
    "    color: 'primary',\n" +
    "    icon: 'art',\n" +
    "    level: 'basic',\n" +
    "    studentCount: 0,\n" +
    "    hoursPerLesson: 1,\n" +
    "    pricePerLesson: 0,\n" +
    "    note: '零基础素描入门，培养观察力与造型能力。',\n" +
    "    createdAt: '2026-07-01T10:00:00Z',\n" +
    "  },\n" +
    "  {\n" +
    "    id: 'cls-calligraphy-basic',\n" +
    "    name: '书法基础班',\n" +
    "    teacherId: 'teacher-001',\n" +
    "    teachers: ['teacher-001'],\n" +
    "    campusId: 'campus-center',\n" +
    "    subjectId: 'sub-calligraphy',\n" +
    "    categoryId: 'cat-class',\n" +
    "    type: 'limited',\n" +
    "    durationMinutes: 60,\n" +
    "    capacity: 10,\n" +
    "    totalLessons: 24,\n" +
    "    usedLessons: 0,\n" +
    "    status: 'active',\n" +
    "    color: 'purple',\n" +
    "    icon: 'calligraphy',\n" +
    "    level: 'all',\n" +
    "    studentCount: 0,\n" +
    "    hoursPerLesson: 1,\n" +
    "    pricePerLesson: 0,\n" +
    "    note: '硬笔书法基础训练，规范书写姿势与笔画。',\n" +
    "    createdAt: '2026-07-02T10:00:00Z',\n" +
    "  },";
  src = src.replace('export const CLASSES: Class[] = [', extras);
}

fs.writeFileSync(file, src);
console.log('mock-database CLASSES cleaned');
