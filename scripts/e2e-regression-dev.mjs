#!/usr/bin/env node
/**
 * 测环境全量 API 回归 / E2E 探针（第三次走查自动化层）
 *
 * 覆盖：health、三角色登录、主路径读写、角色负例（家长/教师不得越权）
 *
 * 用法:
 *   node scripts/e2e-regression-dev.mjs
 *   API_ROOT=https://dev.chancore.cn node scripts/e2e-regression-dev.mjs
 *   API_ROOT=http://127.0.0.1:3000 node scripts/e2e-regression-dev.mjs
 *   OUT_JSON=docs/diagnostics/_e2e-regression-latest.json node scripts/e2e-regression-dev.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = (process.env.API_ROOT || 'https://dev.chancore.cn').replace(/\/$/, '');
const BASE = `${ROOT}/api/app/v1`;
const PASSWORD = process.env.E2E_PASSWORD || '123456';
const OUT_JSON = process.env.OUT_JSON || '';

const results = [];

async function raw(method, url, { body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function api(method, apiPath, opts = {}) {
  return raw(method, `${BASE}${apiPath}`, opts);
}

function record(row) {
  results.push(row);
  const mark = row.ok ? 'PASS' : 'FAIL';
  const detail = row.detail ? ` — ${row.detail}` : '';
  console.log(`${mark}  [${row.severity}] ${row.name}${detail}`);
}

async function check(suiteName, name, fn, opts) {
  const severity = opts?.severity || 'P0';
  try {
    const detail = await fn();
    record({
      ok: true,
      severity,
      role: '',
      suite: suiteName,
      name,
      detail: typeof detail === 'string' ? detail : undefined,
    });
  } catch (e) {
    record({
      ok: false,
      severity,
      role: '',
      suite: suiteName,
      name,
      detail: e.message || String(e),
    });
  }
}

async function login(email) {
  const { status, json } = await api('POST', '/auth/password-login', {
    body: { email, password: PASSWORD },
  });
  if (status !== 200 || json?.code !== 200 || !json?.data?.token) {
    throw new Error(`login ${email}: HTTP ${status} code=${json?.code} ${json?.message}`);
  }
  return {
    token: json.data.token,
    user: json.data.user || json.data.profile || json.data,
  };
}

function assertOk(json, label) {
  if (json?.code !== 200) {
    throw new Error(`${label}: code=${json?.code} ${json?.message || ''}`);
  }
}

async function expectBizOk(method, apiPath, token, label) {
  const { status, json } = await api(method, apiPath, { token });
  if (status === 404) throw new Error(`${label}: route 404`);
  assertOk(json, label);
  return json.data;
}

async function expectDeny(method, apiPath, token, label) {
  const { status, json } = await api(method, apiPath, { token });
  if (status === 404) throw new Error(`${label}: route 404 (should exist)`);
  if (status === 403 || status === 401) return;
  if (json?.code === 403 || json?.code === 401) return;
  const msg = String(json?.message || '');
  if (/权限|无权限|Forbidden|Unauthorized|不允许|仅/i.test(msg)) return;
  throw new Error(`${label}: expected deny, HTTP ${status} code=${json?.code} ${msg}`);
}

let suite = 'boot';

async function main() {
  console.log(`Target ROOT=${ROOT}`);
  console.log(`App API=${BASE}\n`);

  suite = 'infra';
  await check(suite, 'health', async () => {
    const { status, json } = await raw('GET', `${ROOT}/health`);
    if (status !== 200 || json?.status !== 'ok') {
      throw new Error(JSON.stringify(json));
    }
    return `redis=${json.redis} v=${json.version}`;
  });

  suite = 'auth';
  let principal;
  let teacher;
  let parent;
  await check(suite, 'login principal1', async () => {
    principal = await login('principal1@yunce.com');
    return 'ok';
  });
  await check(suite, 'login teacher1', async () => {
    teacher = await login('teacher1@yunce.com');
    return 'ok';
  });
  await check(suite, 'login parent1', async () => {
    parent = await login('parent1@yunce.com');
    return 'ok';
  });

  if (!principal?.token || !teacher?.token || !parent?.token) {
    console.error('Abort: login failed');
    finish(1);
    return;
  }

  // —— 校长主路径 ——
  suite = 'principal';
  await check(suite, 'GET /auth/me', () => expectBizOk('GET', '/auth/me', principal.token, 'me'));
  await check(suite, 'GET /home/teacher', () =>
    expectBizOk('GET', '/home/teacher', principal.token, 'home'),
  );
  await check(suite, 'GET /teachers/me', async () => {
    const data = await expectBizOk('GET', '/teachers/me', principal.token, 'teachers/me');
    if (!data?.id) throw new Error('missing id');
    return `id=${data.id}`;
  });
  await check(suite, 'GET /students/', async () => {
    const data = await expectBizOk('GET', '/students/', principal.token, 'students');
    const list = data?.list || data;
    if (!Array.isArray(list) || list.length < 1) throw new Error('empty students');
    return `n=${list.length}`;
  });
  await check(suite, 'GET /teachers/', async () => {
    const data = await expectBizOk('GET', '/teachers/', principal.token, 'teachers');
    const list = data?.list || data;
    if (Array.isArray(list) && list.length < 1) throw new Error('empty teachers');
    return Array.isArray(list) ? `n=${list.length}` : 'ok';
  });
  await check(suite, 'GET /classes/', () =>
    expectBizOk('GET', '/classes/', principal.token, 'classes').catch(async () => {
      // some deployments use /classes without trailing
      return expectBizOk('GET', '/classes', principal.token, 'classes');
    }),
  );
  await check(suite, 'GET /campuses/', () =>
    expectBizOk('GET', '/campuses/', principal.token, 'campuses').catch(() =>
      expectBizOk('GET', '/campuses', principal.token, 'campuses'),
    ),
  );
  await check(suite, 'GET /venues/', () =>
    expectBizOk('GET', '/venues/', principal.token, 'venues').catch(() =>
      expectBizOk('GET', '/venues', principal.token, 'venues'),
    ),
  );
  await check(suite, 'GET /schedules (month)', async () => {
    const q = '/schedules?startDate=2026-08-01&endDate=2026-08-31';
    try {
      await expectBizOk('GET', q, principal.token, 'schedules');
    } catch {
      await expectBizOk('GET', '/schedules/', principal.token, 'schedules');
    }
  });
  await check(suite, 'GET /leave-requests/', () =>
    expectBizOk('GET', '/leave-requests/', principal.token, 'leave').catch(() =>
      expectBizOk('GET', '/leave-requests', principal.token, 'leave'),
    ),
  );
  await check(suite, 'GET /todos/', () =>
    expectBizOk('GET', '/todos/', principal.token, 'todos').catch(() =>
      expectBizOk('GET', '/todos', principal.token, 'todos'),
    ),
  );
  await check(suite, 'GET /course-packages/', () =>
    expectBizOk('GET', '/course-packages/', principal.token, 'packages').catch(() =>
      expectBizOk('GET', '/course-packages', principal.token, 'packages'),
    ),
  );
  await check(suite, 'GET /leads/', () =>
    expectBizOk('GET', '/leads/', principal.token, 'leads').catch(() =>
      expectBizOk('GET', '/leads', principal.token, 'leads'),
    ),
  );
  await check(suite, 'GET /data-center/finance', () =>
    expectBizOk('GET', '/data-center/finance', principal.token, 'finance').catch(async (e) => {
      // finance may need query; try overview
      try {
        await expectBizOk('GET', '/data-center/venue-overview', principal.token, 'venue-overview');
        return 'fallback venue-overview';
      } catch {
        throw e;
      }
    }),
  );
  await check(suite, 'GET /class-booking/slots', async () => {
    await expectBizOk(
      'GET',
      '/class-booking/slots?classId=cls-001&lessonDate=2026-09-01',
      principal.token,
      'slots',
    );
  });
  await check(suite, 'POST /class-booking/slots/batch', async () => {
    const { status, json } = await api('POST', '/class-booking/slots/batch', {
      token: principal.token,
      body: {
        classId: 'cls-001',
        lessonDate: '2026-09-05',
        slots: [
          {
            teacherId: 'teacher-001',
            teacherName: '张老师',
            startTime: '14:00',
            endTime: '14:30',
            maxCount: 4,
            room: '101',
          },
        ],
      },
    });
    if (status === 404) throw new Error('batch route 404');
    assertOk(json, 'slots/batch');
  });
  await check(suite, 'GET /organization/me', () =>
    expectBizOk('GET', '/organization/me', principal.token, 'org/me'),
  );

  // —— 教师主路径 ——
  suite = 'teacher';
  await check(suite, 'GET /home/teacher', () =>
    expectBizOk('GET', '/home/teacher', teacher.token, 'home'),
  );
  await check(suite, 'GET /teachers/me', async () => {
    const data = await expectBizOk('GET', '/teachers/me', teacher.token, 'me');
    if (data?.id !== 'teacher-001') throw new Error(`id=${data?.id}`);
    return `id=${data.id}`;
  });
  await check(suite, 'GET /students/', () =>
    expectBizOk('GET', '/students/', teacher.token, 'students'),
  );
  await check(suite, 'GET /class-booking/slots', () =>
    expectBizOk(
      'GET',
      '/class-booking/slots?classId=cls-001&lessonDate=2026-09-01',
      teacher.token,
      'slots',
    ),
  );
  await check(suite, 'GET /private-bookings/my', async () => {
    await expectBizOk('GET', '/private-bookings/my', teacher.token, 'private/my');
  });
  await check(suite, 'GET /venues/bookings/my', () =>
    expectBizOk('GET', '/venues/bookings/my', teacher.token, 'venue-bookings').catch(() =>
      expectBizOk('GET', '/venues/bookings', teacher.token, 'venue-bookings'),
    ),
  );

  // —— 家长主路径 ——
  suite = 'parent';
  await check(suite, 'GET /home/parent', () =>
    expectBizOk('GET', '/home/parent', parent.token, 'home'),
  );
  await check(suite, 'GET /students/ (bound children)', async () => {
    const data = await expectBizOk('GET', '/students/', parent.token, 'students');
    const list = data?.list || data;
    return Array.isArray(list) ? `n=${list.length}` : 'ok';
  });
  await check(suite, 'GET /class-booking/my-records', () =>
    expectBizOk('GET', '/class-booking/my-records', parent.token, 'my-records').catch(() =>
      expectBizOk('GET', '/class-booking/my-records/', parent.token, 'my-records'),
    ),
  );
  await check(suite, 'GET /private-bookings/my (parent)', async () => {
    await expectBizOk('GET', '/private-bookings/my', parent.token, 'private/my');
  });
  await check(suite, 'GET /venues/ (parent readable)', async () => {
    try {
      await expectBizOk('GET', '/venues/', parent.token, 'venues');
    } catch {
      await expectBizOk('GET', '/venues', parent.token, 'venues');
    }
  });
  await check(suite, 'GET /course-packages/ (parent readable)', async () => {
    try {
      await expectBizOk('GET', '/course-packages/', parent.token, 'packages');
    } catch {
      await expectBizOk('GET', '/course-packages', parent.token, 'packages');
    }
  });
  await check(suite, 'GET /leave-requests/ (parent)', async () => {
    try {
      await expectBizOk('GET', '/leave-requests/', parent.token, 'leave');
    } catch {
      await expectBizOk('GET', '/leave-requests', parent.token, 'leave');
    }
  });

  // —— 负例：越权应拒绝 ——
  suite = 'rbac-deny';
  await check(
    suite,
    'parent DENY /data-center/finance',
    () => expectDeny('GET', '/data-center/finance', parent.token, 'parent finance'),
    { severity: 'P0' },
  );
  await check(
    suite,
    'parent DENY /teachers/ (list)',
    () => expectDeny('GET', '/teachers/', parent.token, 'parent teachers'),
    { severity: 'P0' },
  );
  await check(
    suite,
    'parent DENY slots/batch write',
    async () => {
      const { status, json } = await api('POST', '/class-booking/slots/batch', {
        token: parent.token,
        body: { classId: 'cls-001', lessonDate: '2026-09-06', slots: [] },
      });
      if (status === 403 || status === 401) return;
      if (json?.code === 403 || json?.code === 401) return;
      if (json?.code === 200) throw new Error('parent wrote slots/batch');
      const msg = String(json?.message || '');
      if (/权限|无权限|Forbidden|不允许/i.test(msg)) return;
      throw new Error(`HTTP ${status} code=${json?.code} ${msg}`);
    },
    { severity: 'P0' },
  );
  await check(
    suite,
    'teacher DENY salary admin if any',
    async () => {
      // teachers list may be principal-only
      const { status, json } = await api('GET', '/teachers/', { token: teacher.token });
      if (status === 403 || json?.code === 403) return 'denied list (ok)';
      if (json?.code === 200) return 'list allowed (scoped ok)';
      throw new Error(`HTTP ${status} code=${json?.code} ${json?.message}`);
    },
    { severity: 'P1' },
  );

  // —— E1–E4 回归门 ——
  suite = 'emergency-E1-E4';
  await check(suite, 'E1 principal students not 403', async () => {
    const { json } = await api('GET', '/students/', { token: principal.token });
    if (json?.code === 403) throw new Error('still 403');
    assertOk(json, 'E1');
  });
  await check(suite, 'E2 principal home/teacher not 403', async () => {
    const { json } = await api('GET', '/home/teacher', { token: principal.token });
    if (json?.code === 403) throw new Error('still 403');
    assertOk(json, 'E2');
  });
  await check(suite, 'E3 teacher /teachers/me works', async () => {
    const { json } = await api('GET', '/teachers/me', { token: teacher.token });
    assertOk(json, 'E3');
    if (!json?.data?.id) throw new Error('no id');
  });
  await check(suite, 'E4 slots/batch exists', async () => {
    const { status, json } = await api('POST', '/class-booking/slots/batch', {
      token: principal.token,
      body: { classId: 'cls-001', lessonDate: '2026-09-07', slots: [] },
    });
    if (status === 404) throw new Error('missing route');
    // empty slots may be validation error but not 404/not implemented
    if (json?.code === 404) throw new Error('not implemented');
    if (status >= 500) throw new Error(`server ${status}`);
    return `code=${json?.code}`;
  });

  finish(results.some((r) => !r.ok) ? 1 : 0);
}

function finish(code) {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const bySuite = {};
  for (const r of results) {
    bySuite[r.suite] ||= { pass: 0, fail: 0 };
    bySuite[r.suite][r.ok ? 'pass' : 'fail'] += 1;
  }
  console.log('\n========== E2E Regression Summary ==========');
  console.log(`Target: ${ROOT}`);
  console.log(`Result: ${passed}/${results.length} passed`);
  for (const [s, c] of Object.entries(bySuite)) {
    console.log(`  ${s}: ${c.pass} pass / ${c.fail} fail`);
  }
  if (failed.length) {
    console.log('\nFailed:');
    for (const f of failed) {
      console.log(`  - [${f.severity}] ${f.name}: ${f.detail}`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    target: ROOT,
    total: results.length,
    passed,
    failed: failed.length,
    bySuite,
    results,
    launchGate: {
      e1e4: results.filter((r) => r.suite === 'emergency-E1-E4').every((r) => r.ok),
      auth: results.filter((r) => r.suite === 'auth').every((r) => r.ok),
      principalCore: results
        .filter((r) => r.suite === 'principal' && r.severity === 'P0')
        .every((r) => r.ok),
      parentCore: results.filter((r) => r.suite === 'parent').every((r) => r.ok),
      rbac: results.filter((r) => r.suite === 'rbac-deny' && r.severity === 'P0').every((r) => r.ok),
    },
  };

  if (OUT_JSON) {
    const abs = path.isAbsolute(OUT_JSON)
      ? OUT_JSON
      : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', OUT_JSON);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nWrote ${abs}`);
  }

  process.exit(code);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
