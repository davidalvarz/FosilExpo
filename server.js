const express = require('express');
const multer  = require('multer');
const session = require('express-session');
const fs      = require('fs');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Directorios ─────────────────────────────────────── */
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_DIR    = path.join(__dirname, 'data');
[UPLOADS_DIR, DATA_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const DATA_FILE = path.join(DATA_DIR, 'content.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

const DEFAULT_DATA = {
  settings: {
    siteTitle:   'Exposición de Fósiles',
    subtitle:    'Una ventana al pasado de la vida en la Tierra',
    description: 'Explora nuestra colección de maquetas y fósiles que narran millones de años de historia biológica.',
    globalFont:  'ibm-plex-serif',
    accentColor: '#7C5C28',
    heroImage:   null,
    footerText:  '© 2025 Exposición de Fósiles · Biología Educativa'
  },
  sections: []
};

/* ══════════════════════════════════════════════════════
   SISTEMA DE LOGS
══════════════════════════════════════════════════════ */
const sseClients = new Set();

const LOG_ACTIONS = {
  LOGIN:           { label: 'Inicio de sesión',          icon: 'login',   level: 'info'   },
  LOGOUT:          { label: 'Cierre de sesión',          icon: 'logout',  level: 'info'   },
  SETTINGS_UPDATE: { label: 'Configuración actualizada', icon: 'settings',level: 'update' },
  SECTION_CREATE:  { label: 'Sección creada',            icon: 'create',  level: 'create' },
  SECTION_UPDATE:  { label: 'Sección actualizada',       icon: 'update',  level: 'update' },
  SECTION_DELETE:  { label: 'Sección eliminada',         icon: 'delete',  level: 'delete' },
  SECTION_REORDER: { label: 'Secciones reordenadas',     icon: 'reorder', level: 'update' },
  FILE_UPLOAD:     { label: 'Archivo(s) subido(s)',       icon: 'upload',  level: 'create' },
  FILE_DELETE:     { label: 'Archivo eliminado',         icon: 'delete',  level: 'delete' },
};

function readLogs() {
  if (!fs.existsSync(LOGS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8')); }
  catch { return []; }
}

function addLog(action, detail, req) {
  const meta  = LOG_ACTIONS[action] || { label: action, icon: 'info', level: 'info' };
  const entry = {
    id:        uuidv4(),
    action,
    label:     meta.label,
    icon:      meta.icon,
    level:     meta.level,
    detail:    detail || '',
    ip:        req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local') : 'sistema',
    timestamp: new Date().toISOString(),
  };

  const logs = readLogs();
  logs.unshift(entry);
  if (logs.length > 500) logs.length = 500;
  fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));

  const payload = `data: ${JSON.stringify(entry)}\n\n`;
  sseClients.forEach(client => {
    try { client.write(payload); } catch { sseClients.delete(client); }
  });

  return entry;
}

/* ── Data helpers ────────────────────────────────────── */
function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
  catch { return JSON.parse(JSON.stringify(DEFAULT_DATA)); }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* ── Multer ──────────────────────────────────────────── */
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /\.(jpg|jpeg|png|gif|webp|svg|mp4|mov|avi|webm|mkv)$/i;
  allowed.test(path.extname(file.originalname))
    ? cb(null, true)
    : cb(new Error('Tipo de archivo no permitido'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 500 * 1024 * 1024 } });

/* ── Middleware ──────────────────────────────────────── */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fossil-expo-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  res.status(401).json({ error: 'No autorizado' });
}

/* ══════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════ */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const U = process.env.ADMIN_USER || '5csh4';
  const P = process.env.ADMIN_PASS || '5csh4';
  if (username === U && password === P) {
    req.session.authenticated = true;
    addLog('LOGIN', `Usuario: ${username}`, req);
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  addLog('LOGOUT', '', req);
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth/check', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

/* ══════════════════════════════════════════════════════
   LOGS
══════════════════════════════════════════════════════ */
app.get('/api/logs/stream', requireAuth, (req, res) => {
  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { /**/ } }, 25000);
  sseClients.add(res);
  req.on('close', () => { clearInterval(ping); sseClients.delete(res); });
});

app.get('/api/logs', requireAuth, (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit = Math.min(200, parseInt(req.query.limit || '100', 10));
  const level = req.query.level || 'all';

  let logs = readLogs();
  if (level !== 'all') logs = logs.filter(l => l.level === level);

  const total = logs.length;
  const items = logs.slice((page - 1) * limit, page * limit);
  res.json({ items, total, page, limit });
});

app.delete('/api/logs', requireAuth, (req, res) => {
  fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2));
  addLog('SETTINGS_UPDATE', 'Historial de logs limpiado', req);
  res.json({ success: true });
});

/* ══════════════════════════════════════════════════════
   CONTENIDO PÚBLICO
══════════════════════════════════════════════════════ */
app.get('/api/content', (req, res) => res.json(readData()));

/* ══════════════════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════════════════ */
app.get('/api/settings', (req, res) => res.json(readData().settings));

app.put('/api/settings', requireAuth, (req, res) => {
  const data = readData();
  const prev = { ...data.settings };
  data.settings = { ...data.settings, ...req.body };
  writeData(data);
  const changed = Object.keys(req.body).filter(k => String(req.body[k]) !== String(prev[k])).join(', ');
  addLog('SETTINGS_UPDATE', changed ? `Campos modificados: ${changed}` : 'Sin cambios detectados', req);
  res.json({ success: true, settings: data.settings });
});

/* ══════════════════════════════════════════════════════
   SECCIONES
══════════════════════════════════════════════════════ */
app.get('/api/sections', (req, res) => {
  const data = readData();
  res.json([...data.sections].sort((a, b) => a.order - b.order));
});

app.post('/api/sections', requireAuth, (req, res) => {
  const data    = readData();
  const section = {
    id: uuidv4(), type: 'text', title: '', content: '', font: '',
    textAlign: 'left', media: [], displayStyle: 'single',
    videoUrl: '', videoFile: '', dividerStyle: 'line',
    order: data.sections.length, ...req.body,
    createdAt: new Date().toISOString()
  };
  data.sections.push(section);
  writeData(data);
  addLog('SECTION_CREATE', `Tipo: ${section.type} · "${section.title || 'sin título'}"`, req);
  res.json({ success: true, section });
});

app.post('/api/sections/reorder', requireAuth, (req, res) => {
  const data    = readData();
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'IDs requeridos' });
  const map = Object.fromEntries(data.sections.map(s => [s.id, s]));
  const ordered = ids.filter(id => map[id]).map((id, idx) => ({ ...map[id], order: idx }));
  const missing = data.sections.filter(s => !ids.includes(s.id)).map((s, i) => ({ ...s, order: ids.length + i }));
  data.sections = [...ordered, ...missing];
  writeData(data);
  addLog('SECTION_REORDER', `Nuevo orden de ${ids.length} secciones`, req);
  res.json({ success: true });
});

app.put('/api/sections/:id', requireAuth, (req, res) => {
  const data = readData();
  const idx  = data.sections.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Sección no encontrada' });
  data.sections[idx] = { ...data.sections[idx], ...req.body, id: req.params.id };
  writeData(data);
  addLog('SECTION_UPDATE', `Tipo: ${data.sections[idx].type} · "${data.sections[idx].title || 'sin título'}"`, req);
  res.json({ success: true, section: data.sections[idx] });
});

app.delete('/api/sections/:id', requireAuth, (req, res) => {
  const data = readData();
  const sec  = data.sections.find(s => s.id === req.params.id);
  data.sections = data.sections.filter(s => s.id !== req.params.id);
  writeData(data);
  addLog('SECTION_DELETE', sec ? `"${sec.title || 'sin título'}" (tipo: ${sec.type})` : '', req);
  res.json({ success: true });
});

/* ══════════════════════════════════════════════════════
   UPLOADS
══════════════════════════════════════════════════════ */
app.post('/api/upload', requireAuth, upload.array('files', 30), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No se recibieron archivos' });
  const files = req.files.map(f => ({
    filename: f.filename, originalname: f.originalname,
    mimetype: f.mimetype, size: f.size,
    url: `/uploads/${f.filename}`, isVideo: f.mimetype.startsWith('video/')
  }));
  addLog('FILE_UPLOAD', `${files.length} archivo(s): ${files.map(f => f.originalname).join(', ')}`, req);
  res.json({ success: true, files });
});

app.get('/api/uploads', requireAuth, (req, res) => {
  const videoExts = new Set(['.mp4', '.mov', '.avi', '.webm', '.mkv']);
  const files = fs.readdirSync(UPLOADS_DIR)
    .filter(f => !f.startsWith('.'))
    .map(filename => {
      const stats = fs.statSync(path.join(UPLOADS_DIR, filename));
      return { filename, url: `/uploads/${filename}`, size: stats.size,
               isVideo: videoExts.has(path.extname(filename).toLowerCase()), createdAt: stats.birthtime };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(files);
});

app.delete('/api/uploads/:filename', requireAuth, (req, res) => {
  const fp = path.join(UPLOADS_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Archivo no encontrado' });
  addLog('FILE_DELETE', `Archivo: ${req.params.filename}`, req);
  fs.unlinkSync(fp);
  res.json({ success: true });
});

/* ── Páginas ─────────────────────────────────────────── */
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n🦕  Fossil Expo → http://localhost:${PORT}`);
  console.log(`📊  Admin panel → http://localhost:${PORT}/admin\n`);
});
