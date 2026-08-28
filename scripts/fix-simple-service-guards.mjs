/**
 * 修正简单 service 的 mock 守卫（非 mock 模式早返回，不加载 mock 模块）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const GUARDS = {
  'src/services/card-type.ts': {
    getList: 'return []',
    getById: 'return null',
    create: "throw new Error('卡种 API 暂未接通')",
    update: "throw new Error('卡种 API 暂未接通')",
    toggleStatus: "throw new Error('卡种 API 暂未接通')",
    remove: "throw new Error('卡种 API 暂未接通')",
  },
  'src/services/course-category.ts': {
    getList: 'return []',
    getById: 'return null',
    create: "throw new Error('课程分类 API 暂未接通')",
    update: "throw new Error('课程分类 API 暂未接通')",
    remove: "throw new Error('课程分类 API 暂未接通')",
  },
  'src/services/course-template.ts': {
    getList: 'return []',
    getById: 'return null',
    create: "throw new Error('课程模板 API 暂未接通')",
    update: "throw new Error('课程模板 API 暂未接通')",
    remove: "throw new Error('课程模板 API 暂未接通')",
    duplicate: "throw new Error('课程模板 API 暂未接通')",
  },
  'src/services/member-card.ts': {
    getList: 'return []',
    getByStudent: 'return []',
    getById: 'return null',
    getActiveByStudent: 'return null',
    issue: "throw new Error('会员卡 API 暂未接通')",
    settleDebtOnIssue: "throw new Error('会员卡欠课抵扣 API 暂未接通')",
  },
  'src/services/lesson-debt.ts': {
    getPendingByStudent: 'return []',
    getPendingHoursByStudent: 'return 0',
    settle: "throw new Error('欠课 API 暂未接通')",
    waive: "throw new Error('欠课 API 暂未接通')",
  },
};

for (const [rel, methods] of Object.entries(GUARDS)) {
  const file = path.join(root, rel);
  let c = fs.readFileSync(file, 'utf8');
  for (const [method, guard] of Object.entries(methods)) {
    const re = new RegExp(
      `(${method}:\\s*async[\\s\\S]*?if \\(!isUseMock\\(\\)\\) \\{)[\\s\\S]*?(\\}\\s*const \\{)`,
    );
    c = c.replace(re, `$1\n      ${guard};\n    $2`);
  }
  fs.writeFileSync(file, c, 'utf8');
  console.log('[guards]', rel);
}
