import http from 'node:http';

const BASE = 'http://127.0.0.1:3000/api/app/v1';
const out = [];

function req(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + urlPath);
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(buf);
          } catch {
            json = { raw: buf.slice(0, 200) };
          }
          resolve({
            status: res.statusCode,
            code: json?.code,
            message: json?.message,
            data: json?.data,
          });
        });
      },
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function login(email) {
  const res = await req('POST', '/auth/password-login', { email, password: '123456' });
  if (res.code !== 200 || !res.data?.token) {
    throw new Error(`login ${email} failed: ${res.code} ${res.message}`);
  }
  return res.data.token;
}

async function check(name, fn) {
  try {
    await fn();
    out.push(`PASS  ${name}`);
  } catch (e) {
    out.push(`FAIL  ${name}: ${e.message}`);
  }
}

(async () => {
  await check('health', async () => {
    const r = await new Promise((resolve, reject) => {
      http
        .get('http://127.0.0.1:3000/health', (res) => {
          let b = '';
          res.on('data', (c) => (b += c));
          res.on('end', () => resolve(JSON.parse(b)));
        })
        .on('error', reject);
    });
    if (r.status !== 'ok') throw new Error(JSON.stringify(r));
  });

  const principalTok = await login('principal1@yunce.com');
  const teacherTok = await login('teacher1@yunce.com');
  const parentTok = await login('parent1@yunce.com');

  await check('principal students list', async () => {
    const r = await req('GET', '/students/', null, principalTok);
    if (r.code !== 200) throw new Error(`${r.code} ${r.message}`);
    if (!Array.isArray(r.data?.list) || r.data.list.length < 1) throw new Error('empty list');
  });

  await check('principal home/teacher', async () => {
    const r = await req('GET', '/home/teacher', null, principalTok);
    if (r.code !== 200) throw new Error(`${r.code} ${r.message}`);
  });

  await check('principal teachers/me', async () => {
    const r = await req('GET', '/teachers/me', null, principalTok);
    if (r.code !== 200) throw new Error(`${r.code} ${r.message}`);
    if (r.data?.id !== 'teacher-principal-001') throw new Error(`id=${r.data?.id}`);
  });

  await check('teacher teachers/me', async () => {
    const r = await req('GET', '/teachers/me', null, teacherTok);
    if (r.code !== 200) throw new Error(`${r.code} ${r.message}`);
    if (r.data?.id !== 'teacher-001') throw new Error(`id=${r.data?.id}`);
  });

  await check('teacher students list', async () => {
    const r = await req('GET', '/students/', null, teacherTok);
    if (r.code !== 200) throw new Error(`${r.code} ${r.message}`);
  });

  await check('parent home/parent', async () => {
    const r = await req('GET', '/home/parent', null, parentTok);
    if (r.code !== 200) throw new Error(`${r.code} ${r.message}`);
  });

  await check('parent students list', async () => {
    const r = await req('GET', '/students/', null, parentTok);
    if (r.code !== 200) throw new Error(`${r.code} ${r.message}`);
  });

  await check('class-booking slots list', async () => {
    const r = await req(
      'GET',
      '/class-booking/slots?classId=cls-001&lessonDate=2026-09-01',
      null,
      teacherTok,
    );
    if (r.code !== 200) throw new Error(`${r.code} ${r.message}`);
  });

  await check('class-booking slots/batch', async () => {
    const r = await req(
      'POST',
      '/class-booking/slots/batch',
      {
        classId: 'cls-001',
        lessonDate: '2026-09-04',
        slots: [
          {
            teacherId: 'teacher-001',
            teacherName: '张老师',
            startTime: '10:00',
            endTime: '10:30',
            maxCount: 4,
            room: '101',
          },
        ],
      },
      principalTok,
    );
    if (r.code !== 200) throw new Error(`${r.code} ${r.message}`);
  });

  console.log(out.join('\n'));
  process.exit(out.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
