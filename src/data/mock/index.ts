/**
 * Mock 数据统一出口
 *
 * 所有统计模块的 mock 数据从 statistics-base 派生
 * 保证学员消课 = 教师上课 = 校区业绩，三者互相对应
 *
 * 联调时只需替换 compute* 函数为 API 调用即可
 */
export {
  CAMPUSES,
  TEACHERS,
  STUDENTS,
  LESSON_RECORDS,
  computeOperationKpi,
  computeFinanceKpi,
  computeStudentRank,
  computeTeacherRank,
  computeCampusRank,
  computeCompare,
  computeFinanceAnalysis,
  computeTrend,
} from './statistics-base';
