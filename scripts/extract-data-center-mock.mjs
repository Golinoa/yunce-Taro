import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.join(import.meta.dirname, '..');
const original = execSync('git show HEAD:src/data/data-center.ts', {
  cwd: projectRoot,
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});
const idx = original.indexOf('const VENUE_NAME');
if (idx < 0) {
  throw new Error('VENUE_NAME not found in original data-center.ts');
}

const header = `/**
 * 数据中心 Mock 实现（分包专用，不进入主包 common.js）
 */
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import type {
  VenueOverviewType,
  RevenueTrendType,
  FinanceDataType,
  MemberDataType,
  CardDataType,
  SalaryDataType,
  FinanceDetailType,
  MemberDetailType,
  CardDetailType,
  SalaryDetailType,
  ExpenseCategoryType,
  IncomeCategoryType,
  TransactionRecordType,
  RevenueTrendItem,
  FinanceDetailItem,
  MemberRadarData,
  MemberDetailItem,
  CardSoldItem,
  CardConsumedItem,
  CoachSalaryItem,
} from '@/data/data-center';
import { CAMPUSES } from '@/data/mock-database';

`;

const outPath = path.join(projectRoot, 'src/package-statistics/data/data-center-mock.ts');
fs.writeFileSync(outPath, header + original.slice(idx), 'utf8');
console.log('written', outPath);
