const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const tokens = new Map(); // token => { login, expiresAt }

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, stored) {
  if (!stored || !stored.salt || !stored.hash) return false;
  const attempt = crypto.pbkdf2Sync(password, stored.salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(attempt, 'hex'), Buffer.from(stored.hash, 'hex'));
}

function defaultData() {
  const password = hashPassword('admin123');
  return {
    users: {
      admin: password
    },
    state: {
      students: [],
      groups: [],
      attendances: {},
      updatedAt: Date.now()
    }
  };
}

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.users || !parsed.users.admin) {
      parsed.users = parsed.users || {};
      parsed.users.admin = hashPassword('admin123');
    }
    if (!parsed.state) parsed.state = defaultData().state;
    parsed.state.students = parsed.state.students || [];
    parsed.state.groups = parsed.state.groups || [];
    parsed.state.attendances = parsed.state.attendances || {};
    if (!parsed.state.updatedAt) parsed.state.updatedAt = Date.now();
    return parsed;
  } catch (err) {
    const fallback = defaultData();
    saveData(fallback);
    return fallback;
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let data = loadData();

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.connection.destroy();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        const json = JSON.parse(body);
        resolve(json);
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

function unauthorized(res) {
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
}

function cleanTokens() {
  const now = Date.now();
  for (const [token, meta] of tokens.entries()) {
    if (meta.expiresAt <= now) tokens.delete(token);
  }
}

function authUser(req) {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  cleanTokens();
  const meta = tokens.get(token);
  if (!meta || meta.expiresAt <= Date.now()) return null;
  return meta.login;
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function serveStatic(req, res) {
  let filePath = path.join(__dirname, decodeURIComponent(req.url.split('?')[0]));
  if (req.url === '/' || req.url === '') filePath = path.join(__dirname, 'index.html');

  if (!filePath.startsWith(__dirname)) return notFound(res);
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) return notFound(res);

    const ext = path.extname(filePath).toLowerCase();
    const type = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png'
    }[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(filePath).pipe(res);
  });
}

async function handleApi(req, res) {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (pathname === '/api/login' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { login, password } = body;
      const user = data.users[login];
      if (!user || !verifyPassword(password || '', user)) {
        return sendJson(res, 401, { ok: false, error: 'Неверный логин или пароль' });
      }
      const token = crypto.randomBytes(24).toString('hex');
      tokens.set(token, { login, expiresAt: Date.now() + TOKEN_TTL_MS });
      return sendJson(res, 200, { ok: true, token });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: 'Некорректное тело запроса' });
    }
  }

  const login = authUser(req);
  if (!login) return unauthorized(res);

  if (pathname === '/api/state' && req.method === 'GET') {
    return sendJson(res, 200, data.state);
  }

  if (pathname === '/api/state/merge' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (typeof body !== 'object' || Array.isArray(body)) throw new Error('bad state');
      data.state = {
        students: Array.isArray(body.students) ? body.students : [],
        groups: Array.isArray(body.groups) ? body.groups : [],
        attendances: typeof body.attendances === 'object' && body.attendances ? body.attendances : {},
        updatedAt: Date.now()
      };
      saveData(data);
      return sendJson(res, 200, { ok: true, state: data.state });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: 'Некорректные данные' });
    }
  }

  if (pathname === '/api/student' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { id, name, groupId } = body;
      if (!id || !name || !groupId) return sendJson(res, 400, { ok: false, error: 'id, name и groupId обязательны' });
      const exists = data.state.students.find(s => s.id === id);
      if (exists) return sendJson(res, 409, { ok: false, error: 'Студент уже существует' });
      data.state.students.push({ id, name, groupId });
      if (!data.state.groups.find(g => g.id === groupId)) {
        data.state.groups.push({ id: groupId, name: groupId });
      }
      data.state.updatedAt = Date.now();
      saveData(data);
      return sendJson(res, 201, { ok: true, student: { id, name, groupId } });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: 'Некорректные данные' });
    }
  }

  if (pathname.startsWith('/api/student/') && req.method === 'DELETE') {
    const id = pathname.split('/').pop();
    const before = data.state.students.length;
    data.state.students = data.state.students.filter(s => s.id !== id);
    for (const day of Object.keys(data.state.attendances)) {
      if (data.state.attendances[day]) delete data.state.attendances[day][id];
    }
    if (data.state.students.length !== before) {
      data.state.updatedAt = Date.now();
      saveData(data);
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 404, { ok: false, error: 'Студент не найден' });
  }

  if (pathname === '/api/attendance' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { studentId, date, status, comment = '' } = body;
      if (!studentId || !date || !status) return sendJson(res, 400, { ok: false, error: 'studentId, date и status обязательны' });
      data.state.attendances[date] = data.state.attendances[date] || {};
      data.state.attendances[date][studentId] = { status, comment };
      data.state.updatedAt = Date.now();
      saveData(data);
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: 'Некорректные данные' });
    }
  }

  if (pathname.startsWith('/api/attendance/') && req.method === 'GET') {
    const date = pathname.split('/').pop();
    const day = data.state.attendances[date] || {};
    return sendJson(res, 200, day);
  }

  if (pathname === '/api/changePassword' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { newPassword } = body;
      if (!newPassword || newPassword.length < 6) {
        return sendJson(res, 400, { ok: false, error: 'Пароль слишком короткий' });
      }
      data.users[login] = hashPassword(newPassword);
      saveData(data);
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: 'Некорректные данные' });
    }
  }

  notFound(res);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return handleApi(req, res);
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  ensureDir(DATA_FILE);
  console.log(`Attendance app running at http://localhost:${PORT}`);
});
