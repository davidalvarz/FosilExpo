/* ═══════════════════════════════════════════════════════
   FOSSIL EXPO — ADMIN DASHBOARD
═══════════════════════════════════════════════════════ */

'use strict';

/* ── Estado global ───────────────────────────────────── */
const State = {
  settings:       {},
  sections:       [],
  allMedia:       [],
  editingSectionId: null,
  currentType:    'text',
  currentAlign:   'left',
  currentDisplayStyle: 'single',
  currentDividerStyle: 'line',
  sectionMedia:   [],   // [{url, caption, isVideo}]
  libraryPickMode: null, // 'section' | 'hero' | 'video'
  libSelected:    [],
};

const FONT_FAMILIES = {
  'ibm-plex-serif': "'IBM Plex Serif', Georgia, serif",
  'ibm-plex-sans':  "'IBM Plex Sans', system-ui, sans-serif",
  'ibm-plex-mono':  "'IBM Plex Mono', 'Courier New', monospace",
  'source-serif':   "'Source Serif 4', Georgia, serif",
  'source-sans':    "'Source Sans 3', system-ui, sans-serif",
  'crimson':        "'Crimson Pro', Georgia, serif",
  'nunito-sans':    "'Nunito Sans', system-ui, sans-serif",
  'spectral':       "'Spectral', Georgia, serif",
};

/* ── Helpers de DOM ──────────────────────────────────── */
const $ = id => document.getElementById(id);
const qs = (sel, ctx = document) => ctx.querySelector(sel);

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/* ── Toast ───────────────────────────────────────────── */
function toast(msg, type = 'success') {
  const container = $('toast');
  const el = document.createElement('div');
  el.className = `toast-msg toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ══════════════════════════════════════════════════════
   AUTENTICACIÓN
══════════════════════════════════════════════════════ */
async function checkAuth() {
  const res  = await fetch('/api/auth/check');
  const data = await res.json();
  if (data.authenticated) showDashboard();
  else showLogin();
}

function showLogin() {
  $('login-screen').style.display = 'flex';
  $('dashboard').classList.add('hidden');
}

function showDashboard() {
  $('login-screen').style.display = 'none';
  $('dashboard').classList.remove('hidden');
  loadAll();
  // Iniciar SSE en background para que el dot del sidebar esté activo
  setTimeout(connectSSE, 800);
}

$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('login-btn');
  btn.disabled = true;
  btn.textContent = 'Verificando...';
  $('login-error').textContent = '';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: $('login-user').value.trim(),
        password: $('login-pass').value,
      })
    });
    if (res.ok) showDashboard();
    else {
      const d = await res.json();
      $('login-error').textContent = d.error || 'Credenciales incorrectas';
    }
  } catch {
    $('login-error').textContent = 'Error de conexión';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ingresar';
  }
});

$('logout-btn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  showLogin();
});

/* ══════════════════════════════════════════════════════
   NAVEGACIÓN SIDEBAR
══════════════════════════════════════════════════════ */
/* ── Contraseña para el panel de logs ────────────── */
const LOGS_PASS       = 'admin2';
let   logsUnlocked    = false;

function openLogsAuthModal() {
  $('logs-auth-input').value = '';
  $('logs-auth-error').textContent = '';
  $('logs-auth-modal').classList.remove('hidden');
  setTimeout(() => $('logs-auth-input').focus(), 50);
}

function closeLogsAuthModal() {
  $('logs-auth-modal').classList.add('hidden');
}

function unlockLogs() {
  logsUnlocked = true;
  closeLogsAuthModal();
  // Activar el panel de logs manualmente
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector('.nav-item[data-panel="logs"]').classList.add('active');
  $('panel-logs').classList.add('active');
  loadLogs(true);
}

$('logs-auth-confirm').addEventListener('click', () => {
  if ($('logs-auth-input').value === LOGS_PASS) {
    unlockLogs();
  } else {
    $('logs-auth-error').textContent = 'Contraseña incorrecta.';
    $('logs-auth-input').value = '';
    $('logs-auth-input').focus();
  }
});

$('logs-auth-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('logs-auth-confirm').click();
});

$('logs-auth-close').addEventListener('click', closeLogsAuthModal);
$('logs-auth-cancel').addEventListener('click', closeLogsAuthModal);
$('logs-auth-modal').addEventListener('click', e => {
  if (e.target === $('logs-auth-modal')) closeLogsAuthModal();
});

/* ── Navegación del sidebar ──────────────────────── */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    // Si es el panel de logs y no está desbloqueado, pedir contraseña
    if (btn.dataset.panel === 'logs' && !logsUnlocked) {
      openLogsAuthModal();
      return;
    }

    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`panel-${btn.dataset.panel}`).classList.add('active');

    // Cargar historial al abrir el panel de logs
    if (btn.dataset.panel === 'logs') {
      loadLogs(true);
    }
  });
});

/* ══════════════════════════════════════════════════════
   CARGA GENERAL
══════════════════════════════════════════════════════ */
async function loadAll() {
  await Promise.all([loadSettings(), loadSections(), loadMedia()]);
}

/* ══════════════════════════════════════════════════════
   CONFIGURACIÓN
══════════════════════════════════════════════════════ */
async function loadSettings() {
  const res = await fetch('/api/settings');
  State.settings = await res.json();
  fillSettingsForm(State.settings);
}

function fillSettingsForm(s) {
  $('s-title').value       = s.siteTitle   || '';
  $('s-subtitle').value    = s.subtitle    || '';
  $('s-description').value = s.description || '';
  $('s-footer').value      = s.footerText  || '';
  $('s-font').value        = s.globalFont  || 'cormorant';
  $('s-color').value       = s.accentColor || '#7C5C28';
  $('s-color-hex').value   = s.accentColor || '#7C5C28';
  updateFontPreview(s.globalFont || 'cormorant');
  updateHeroImgPreview(s.heroImage);
}

/* Fuente */
$('s-font').addEventListener('change', e => updateFontPreview(e.target.value));

function updateFontPreview(key) {
  const el = $('s-font-preview');
  el.style.fontFamily = FONT_FAMILIES[key] || FONT_FAMILIES['cormorant'];
}

/* Color de acento */
$('s-color').addEventListener('input', e => {
  $('s-color-hex').value = e.target.value;
});

$('s-color-hex').addEventListener('input', e => {
  if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
    $('s-color').value = e.target.value;
  }
});

document.querySelectorAll('.color-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    const c = dot.dataset.color;
    $('s-color').value     = c;
    $('s-color-hex').value = c;
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
  });
});

/* Hero image */
$('btn-pick-hero').addEventListener('click', () => openLibraryModal('hero'));
$('btn-clear-hero').addEventListener('click', () => {
  State.settings.heroImage = null;
  updateHeroImgPreview(null);
});

function updateHeroImgPreview(url) {
  const el = $('hero-img-preview');
  if (url) {
    el.innerHTML = `<img src="${url}" alt="Hero">`;
  } else {
    el.innerHTML = '<span>Sin imagen — se usará fondo liso</span>';
  }
}

/* Guardar settings */
$('btn-save-settings').addEventListener('click', async () => {
  const payload = {
    siteTitle:   $('s-title').value.trim(),
    subtitle:    $('s-subtitle').value.trim(),
    description: $('s-description').value.trim(),
    footerText:  $('s-footer').value.trim(),
    globalFont:  $('s-font').value,
    accentColor: $('s-color-hex').value || $('s-color').value,
    heroImage:   State.settings.heroImage || null,
  };

  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    State.settings = (await res.json()).settings;
    toast('✔ Configuración guardada');
  } else {
    toast('Error al guardar', 'error');
  }
});

/* ══════════════════════════════════════════════════════
   SECCIONES — LISTA
══════════════════════════════════════════════════════ */
async function loadSections() {
  const res     = await fetch('/api/sections');
  State.sections = await res.json();
  renderSectionsList();
}

function renderSectionsList() {
  const list  = $('sections-list');
  const empty = $('sections-empty');

  list.querySelectorAll('.section-card').forEach(el => el.remove());

  if (!State.sections.length) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  const sorted = [...State.sections].sort((a, b) => a.order - b.order);

  sorted.forEach(sec => {
    const card = buildSectionCard(sec);
    list.appendChild(card);
  });

  initDragSort();
}

function badgeClass(type) {
  return { text: 'badge-text', image: 'badge-image', gallery: 'badge-gallery', video: 'badge-video', divider: 'badge-divider' }[type] || 'badge-text';
}

function badgeLabel(type) {
  return { text: 'Texto', image: 'Imagen', gallery: 'Galería', video: 'Vídeo', divider: 'Separador' }[type] || type;
}

function buildSectionCard(sec) {
  const card  = document.createElement('div');
  card.className = 'section-card';
  card.dataset.id = sec.id;

  const subInfo = sec.type === 'gallery'
    ? `${(sec.media || []).length} imágenes · estilo: ${sec.displayStyle || 'single'}`
    : sec.type === 'divider'
    ? `Separador · ${sec.dividerStyle || 'line'}`
    : sec.content
    ? sec.content.slice(0, 60) + (sec.content.length > 60 ? '…' : '')
    : 'Sin descripción';

  card.innerHTML = `
    <div class="section-drag-handle" title="Arrastrar para reordenar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    </div>
    <span class="section-badge ${badgeClass(sec.type)}">${badgeLabel(sec.type)}</span>
    <div class="section-info">
      <div class="section-info-title">${esc(sec.title || '(sin título)')}</div>
      <div class="section-info-sub">${esc(subInfo)}</div>
    </div>
    <div class="section-actions">
      <button class="btn-icon btn-edit" title="Editar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn-icon btn-delete btn-danger" title="Eliminar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
  `;

  card.querySelector('.btn-edit').addEventListener('click', () => openSectionModal(sec));
  card.querySelector('.btn-delete').addEventListener('click', () => deleteSection(sec.id));

  return card;
}

/* Nueva sección */
$('btn-add-section').addEventListener('click', () => openSectionModal(null));

/* Eliminar */
async function deleteSection(id) {
  if (!confirm('¿Eliminar esta sección?')) return;
  const res = await fetch(`/api/sections/${id}`, { method: 'DELETE' });
  if (res.ok) {
    State.sections = State.sections.filter(s => s.id !== id);
    renderSectionsList();
    toast('Sección eliminada');
  } else {
    toast('Error al eliminar', 'error');
  }
}

/* ══════════════════════════════════════════════════════
   DRAG & DROP — REORDENAR
══════════════════════════════════════════════════════ */
function initDragSort() {
  const list    = $('sections-list');
  const cards   = list.querySelectorAll('.section-card');
  let dragged   = null;

  cards.forEach(card => {
    const handle = card.querySelector('.section-drag-handle');

    handle.addEventListener('mousedown', () => {
      card.setAttribute('draggable', 'true');
    });

    card.addEventListener('dragstart', e => {
      dragged = card;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', async () => {
      card.classList.remove('dragging');
      card.setAttribute('draggable', 'false');

      const ordered = [...list.querySelectorAll('.section-card')].map(c => c.dataset.id);
      await fetch('/api/sections/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ordered }),
      });

      await loadSections();
    });

    card.addEventListener('dragover', e => {
      e.preventDefault();
      if (dragged && dragged !== card) {
        const rect = card.getBoundingClientRect();
        const mid  = rect.top + rect.height / 2;
        if (e.clientY < mid) list.insertBefore(dragged, card);
        else list.insertBefore(dragged, card.nextSibling);
      }
    });
  });
}

/* ══════════════════════════════════════════════════════
   MODAL — SECCIÓN
══════════════════════════════════════════════════════ */
function openSectionModal(section) {
  State.editingSectionId   = section ? section.id : null;
  State.currentType        = section ? section.type        : 'text';
  State.currentAlign       = section ? (section.textAlign  || 'left') : 'left';
  State.currentDisplayStyle= section ? (section.displayStyle || 'single') : 'single';
  State.currentDividerStyle= section ? (section.dividerStyle || 'line')   : 'line';
  State.sectionMedia       = section ? JSON.parse(JSON.stringify(section.media || [])) : [];

  $('modal-title').textContent = section ? 'Editar sección' : 'Nueva sección';
  $('f-title').value   = section ? (section.title   || '') : '';
  $('f-authors').value = section ? (section.authors || '') : '';
  $('f-content').value = section ? (section.content || '') : '';
  $('f-font').value    = section ? (section.font    || '') : '';
  $('f-video-url').value = section ? (section.videoUrl || '') : '';

  // Limpiar video file preview
  const vfp = $('video-file-preview');
  vfp.classList.add('hidden');
  vfp.textContent = '';
  if (section && section.videoFile) {
    vfp.classList.remove('hidden');
    vfp.textContent = '📹 ' + section.videoFile.split('/').pop();
    State.currentVideoFile = section.videoFile;
  } else {
    State.currentVideoFile = '';
  }

  setType(State.currentType);
  setAlign(State.currentAlign);
  setDisplayStyle(State.currentDisplayStyle);
  setDividerStyle(State.currentDividerStyle);
  renderMediaItemsList();

  $('section-modal').classList.remove('hidden');
  $('f-title').focus();
}

function closeModal() {
  $('section-modal').classList.add('hidden');
}

$('modal-close-btn').addEventListener('click',  closeModal);
$('modal-cancel-btn').addEventListener('click', closeModal);
$('section-modal').addEventListener('click', e => {
  if (e.target === $('section-modal')) closeModal();
});

/* ── Tipo de sección ──────────────────────────────── */
document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => setType(btn.dataset.type));
});

function setType(type) {
  State.currentType = type;

  document.querySelectorAll('.type-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.type === type)
  );

  // Visibilidad de campos
  const showCommon  = type !== 'divider';
  const showStyle   = type !== 'divider';
  const showMedia   = type === 'image' || type === 'gallery';
  const showVideo   = type === 'video';
  const showDivider = type === 'divider';
  const showGalleryStyle = type === 'gallery';
  const showAlignField   = type !== 'divider';

  $('fields-common').style.display  = showCommon  ? ''      : 'none';
  $('fields-style').style.display   = showStyle   ? ''      : 'none';
  $('fields-media').classList.toggle('hidden',   !showMedia);
  $('fields-video').classList.toggle('hidden',   !showVideo);
  $('fields-divider').classList.toggle('hidden', !showDivider);
  $('field-display-style').style.display = showGalleryStyle ? '' : 'none';
  $('field-align').style.display         = showAlignField   ? '' : 'none';

  // Etiqueta de media
  if (type === 'image') $('media-label').textContent = 'Imagen (se usará la primera)';
  if (type === 'gallery') $('media-label').textContent = 'Imágenes de la galería';
}

/* ── Alineación ───────────────────────────────────── */
document.querySelectorAll('.align-btn').forEach(btn => {
  btn.addEventListener('click', () => setAlign(btn.dataset.align));
});

function setAlign(align) {
  State.currentAlign = align;
  document.querySelectorAll('.align-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.align === align)
  );
}

/* ── Display style ────────────────────────────────── */
document.querySelectorAll('.style-btn').forEach(btn => {
  btn.addEventListener('click', () => setDisplayStyle(btn.dataset.style));
});

function setDisplayStyle(style) {
  State.currentDisplayStyle = style;
  document.querySelectorAll('.style-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.style === style)
  );
}

/* ── Divider style ────────────────────────────────── */
document.querySelectorAll('.divider-style-btn').forEach(btn => {
  btn.addEventListener('click', () => setDividerStyle(btn.dataset.ds));
});

function setDividerStyle(style) {
  State.currentDividerStyle = style;
  document.querySelectorAll('.divider-style-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.ds === style)
  );
}

/* ── Upload desde modal ───────────────────────────── */
$('modal-file-input').addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  const uploaded = await uploadFiles(files);
  uploaded.forEach(f => {
    State.sectionMedia.push({ url: f.url, caption: '', isVideo: f.isVideo });
  });
  renderMediaItemsList();
  e.target.value = '';
});

/* ── Upload de vídeo desde modal ──────────────────── */
$('modal-video-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  toast('Subiendo vídeo...', 'info');
  const uploaded = await uploadFiles([file]);
  if (uploaded[0]) {
    State.currentVideoFile = uploaded[0].url;
    const vfp = $('video-file-preview');
    vfp.classList.remove('hidden');
    vfp.textContent = '📹 ' + file.name;
    toast('Vídeo subido');
  }
  e.target.value = '';
});

/* ── Pick de biblioteca (sección) ─────────────────── */
$('btn-pick-library').addEventListener('click', () => openLibraryModal('section'));
$('btn-pick-video-library').addEventListener('click', () => openLibraryModal('video'));

/* ── Render items de media en modal ───────────────── */
function renderMediaItemsList() {
  const list = $('media-items-list');
  list.innerHTML = '';

  if (!State.sectionMedia.length) {
    list.innerHTML = '<div style="padding:0.4rem;font-size:0.78rem;color:var(--text-light)">Sin archivos aún</div>';
    return;
  }

  State.sectionMedia.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'media-item-row';

    const thumbHtml = item.isVideo
      ? `<div class="media-item-thumb-video">▶</div>`
      : `<img class="media-item-thumb" src="${item.url}" alt="">`;

    row.innerHTML = `
      ${thumbHtml}
      <div class="media-item-caption">
        <input type="text" placeholder="Leyenda opcional..." value="${esc(item.caption || '')}">
      </div>
      <button class="media-item-remove" title="Quitar">✕</button>
    `;

    row.querySelector('input').addEventListener('input', e => {
      State.sectionMedia[idx].caption = e.target.value;
    });

    row.querySelector('.media-item-remove').addEventListener('click', () => {
      State.sectionMedia.splice(idx, 1);
      renderMediaItemsList();
    });

    list.appendChild(row);
  });
}

/* ── Guardar sección ──────────────────────────────── */
$('modal-save-btn').addEventListener('click', async () => {
  const payload = {
    type:         State.currentType,
    title:        $('f-title').value.trim(),
    authors:      $('f-authors').value.trim(),
    content:      $('f-content').value.trim(),
    font:         $('f-font').value,
    textAlign:    State.currentAlign,
    displayStyle: State.currentDisplayStyle,
    dividerStyle: State.currentDividerStyle,
    media:        State.sectionMedia,
    videoUrl:     $('f-video-url').value.trim(),
    videoFile:    State.currentVideoFile || '',
  };

  const id  = State.editingSectionId;
  const url = id ? `/api/sections/${id}` : '/api/sections';
  const method = id ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    await loadSections();
    closeModal();
    toast(id ? '✔ Sección actualizada' : '✔ Sección creada');
  } else {
    toast('Error al guardar sección', 'error');
  }
});

/* ══════════════════════════════════════════════════════
   BIBLIOTECA DE MEDIOS
══════════════════════════════════════════════════════ */
async function loadMedia() {
  const res    = await fetch('/api/uploads');
  State.allMedia = await res.json();
  renderMediaGrid();
}

function renderMediaGrid() {
  const grid = $('media-grid');
  grid.innerHTML = '';

  if (!State.allMedia.length) {
    grid.innerHTML = '<p style="color:var(--text-light);font-size:0.85rem;padding:0.5rem">Aún no hay archivos subidos.</p>';
    return;
  }

  State.allMedia.forEach(file => {
    const card = buildMediaCard(file, false);
    grid.appendChild(card);
  });
}

function buildMediaCard(file, selectable) {
  const card = document.createElement('div');
  card.className = selectable ? 'lib-item' : 'media-card';
  card.dataset.url = file.url;

  const thumbHtml = file.isVideo
    ? `<div class="${selectable ? 'lib-item-video-thumb' : 'media-thumb-video'}">▶</div>`
    : `<img class="${selectable ? 'lib-item-thumb' : 'media-thumb'}" src="${file.url}" alt="${esc(file.filename)}" loading="lazy">`;

  if (selectable) {
    card.innerHTML = `
      ${thumbHtml}
      <div class="lib-item-check">✓</div>
      <div class="lib-item-name">${esc(file.filename)}</div>
    `;
  } else {
    card.innerHTML = `
      ${thumbHtml}
      <div class="media-info">
        <div class="media-name">${esc(file.filename)}</div>
        <div class="media-size">${formatSize(file.size)}</div>
      </div>
      <button class="media-delete" title="Eliminar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
      </button>
    `;
    card.querySelector('.media-delete').addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('¿Eliminar este archivo?')) return;
      const res = await fetch(`/api/uploads/${encodeURIComponent(file.filename)}`, { method: 'DELETE' });
      if (res.ok) {
        card.remove();
        State.allMedia = State.allMedia.filter(f => f.filename !== file.filename);
        toast('Archivo eliminado');
      } else {
        toast('Error al eliminar', 'error');
      }
    });
  }

  return card;
}

/* ── Upload desde panel medios ────────────────────── */
$('media-upload-input').addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  await uploadFilesGlobal(files);
  e.target.value = '';
});

/* ── Drop zone ────────────────────────────────────── */
const dropZone = $('media-drop-zone');

dropZone.addEventListener('click', () => $('media-upload-input').click());

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', async e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files);
  if (files.length) await uploadFilesGlobal(files);
});

async function uploadFilesGlobal(files) {
  const prog  = $('upload-progress');
  const fill  = $('progress-fill');
  const label = $('progress-label');

  prog.classList.remove('hidden');
  fill.style.width = '10%';
  label.textContent = 'Subiendo...';

  try {
    const uploaded = await uploadFiles(files, (pct) => {
      fill.style.width = pct + '%';
    });

    fill.style.width = '100%';
    label.textContent = `${uploaded.length} archivo(s) subido(s)`;

    uploaded.forEach(f => State.allMedia.unshift(f));
    renderMediaGrid();
    toast(`✔ ${uploaded.length} archivo(s) subido(s)`);
  } catch (err) {
    toast('Error al subir archivos', 'error');
  } finally {
    setTimeout(() => {
      prog.classList.add('hidden');
      fill.style.width = '0%';
    }, 1800);
  }
}

/* ── Función de upload base ───────────────────────── */
async function uploadFiles(files, onProgress) {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 90));
      }
    });

    xhr.addEventListener('load', () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (data.success) resolve(data.files);
        else reject(new Error(data.error));
      } catch {
        reject(new Error('Error en respuesta'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Error de red')));
    xhr.send(formData);
  });
}

/* ══════════════════════════════════════════════════════
   MODAL BIBLIOTECA — SELECCIÓN
══════════════════════════════════════════════════════ */
function openLibraryModal(mode) {
  State.libraryPickMode = mode;
  State.libSelected     = [];

  const libGrid = $('lib-grid');
  libGrid.innerHTML = '';

  const hint = $('lib-hint');

  if (mode === 'hero') {
    hint.textContent = 'Haz clic en una imagen para seleccionarla como portada.';
  } else if (mode === 'video') {
    hint.textContent = 'Selecciona un archivo de vídeo.';
  } else {
    hint.textContent = 'Haz clic en los archivos para seleccionarlos. Puedes elegir varios.';
  }

  const mediaToShow = State.allMedia.filter(f => {
    if (mode === 'video') return f.isVideo;
    if (mode === 'hero')  return !f.isVideo;
    return true;
  });

  if (!mediaToShow.length) {
    libGrid.innerHTML = '<p style="color:var(--text-light);font-size:0.85rem">No hay archivos disponibles. Sube archivos en la Biblioteca de Medios.</p>';
  }

  mediaToShow.forEach(file => {
    const card = buildMediaCard(file, true);
    card.addEventListener('click', () => toggleLibSelect(card, file, mode));
    libGrid.appendChild(card);
  });

  updateLibCount();
  $('library-modal').classList.remove('hidden');
}

function toggleLibSelect(card, file, mode) {
  if (mode === 'hero' || mode === 'video') {
    // Single select
    document.querySelectorAll('#lib-grid .lib-item').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    State.libSelected = [file];
  } else {
    card.classList.toggle('selected');
    if (card.classList.contains('selected')) {
      State.libSelected.push(file);
    } else {
      State.libSelected = State.libSelected.filter(f => f.url !== file.url);
    }
  }
  updateLibCount();
}

function updateLibCount() {
  $('lib-count').textContent = State.libSelected.length;
}

$('lib-modal-close').addEventListener('click', closeLibraryModal);
$('lib-cancel-btn').addEventListener('click', closeLibraryModal);
$('library-modal').addEventListener('click', e => {
  if (e.target === $('library-modal')) closeLibraryModal();
});

function closeLibraryModal() {
  $('library-modal').classList.add('hidden');
  State.libSelected     = [];
  State.libraryPickMode = null;
}

$('lib-confirm-btn').addEventListener('click', () => {
  const mode = State.libraryPickMode;

  if (mode === 'hero') {
    const file = State.libSelected[0];
    if (file) {
      State.settings.heroImage = file.url;
      updateHeroImgPreview(file.url);
      toast('Imagen de portada seleccionada');
    }

  } else if (mode === 'video') {
    const file = State.libSelected[0];
    if (file) {
      State.currentVideoFile = file.url;
      const vfp = $('video-file-preview');
      vfp.classList.remove('hidden');
      vfp.textContent = '📹 ' + file.filename;
    }

  } else {
    State.libSelected.forEach(f => {
      State.sectionMedia.push({ url: f.url, caption: '', isVideo: f.isVideo });
    });
    renderMediaItemsList();
    toast(`${State.libSelected.length} archivo(s) añadido(s)`);
  }

  closeLibraryModal();
});

/* ══════════════════════════════════════════════════════
   SISTEMA DE LOGS — TIEMPO REAL
══════════════════════════════════════════════════════ */

const LogsState = {
  page:       1,
  limit:      100,
  total:      0,
  level:      'all',
  sseSource:  null,
  stats:      { total: 0, create: 0, update: 0, delete: 0, info: 0 },
};

/* ── Iconos SVG por tipo ──────────────────────────── */
const LOG_ICONS = {
  create:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  update:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>`,
  delete:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>`,
  login:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`,
  logout:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  reorder:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  upload:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  info:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
};

function getIconClass(entry) {
  if (entry.level === 'create') return 'icon-create';
  if (entry.level === 'delete') return 'icon-delete';
  if (entry.level === 'update') {
    if (entry.icon === 'settings') return 'icon-settings';
    if (entry.icon === 'reorder')  return 'icon-reorder';
    return 'icon-update';
  }
  if (entry.icon === 'login')  return 'icon-login';
  if (entry.icon === 'logout') return 'icon-logout';
  if (entry.icon === 'upload') return 'icon-upload';
  return 'icon-info';
}

/* ── Formatear timestamp ──────────────────────────── */
function formatTs(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `<span>${date}</span><br><span style="font-size:0.7rem;opacity:0.8">${time}</span>`;
}

/* ── Construir fila de log ────────────────────────── */
function buildLogRow(entry, isNew = false) {
  const tr = document.createElement('tr');
  if (isNew) tr.classList.add('log-new');

  const iconSvg   = LOG_ICONS[entry.icon] || LOG_ICONS['info'];
  const iconClass = getIconClass(entry);
  const levelCls  = `level-${entry.level}`;
  const levelTxt  = { create: 'Creación', update: 'Cambio', delete: 'Eliminación', info: 'Info' }[entry.level] || entry.level;

  tr.innerHTML = `
    <td class="log-ts">${formatTs(entry.timestamp)}</td>
    <td class="log-icon-cell">
      <span class="log-icon ${iconClass}">${iconSvg}</span>
    </td>
    <td><span class="log-action-label">${esc(entry.label)}</span></td>
    <td><span class="log-detail" title="${esc(entry.detail)}">${esc(entry.detail || '—')}</span></td>
    <td><span class="log-level-badge ${levelCls}">${levelTxt}</span></td>
    <td class="log-ip">${esc(entry.ip || '—')}</td>
  `;
  return tr;
}

/* ── Renderizar tabla ─────────────────────────────── */
function renderLogsTable(items) {
  const tbody = $('logs-tbody');
  tbody.innerHTML = '';

  if (!items.length) {
    const tr = document.createElement('tr');
    tr.className = 'logs-placeholder';
    tr.innerHTML = '<td colspan="6">No hay registros para los filtros seleccionados.</td>';
    tbody.appendChild(tr);
    return;
  }

  items.forEach(entry => tbody.appendChild(buildLogRow(entry, false)));
}

/* ── Actualizar stats ─────────────────────────────── */
function updateStats(items) {
  // Recalcular sobre todos los items cargados (no sólo la página)
  const counts = { create: 0, update: 0, delete: 0, info: 0 };
  items.forEach(e => {
    if (counts[e.level] !== undefined) counts[e.level]++;
    else counts.info++;
  });
  const total = items.length;

  $('stat-total').textContent  = LogsState.total;
  $('stat-create').textContent = counts.create;
  $('stat-update').textContent = counts.update;
  $('stat-delete').textContent = counts.delete;
  $('stat-info').textContent   = counts.info;
}

/* ── Cargar logs desde API ────────────────────────── */
async function loadLogs(resetPage = false) {
  if (resetPage) LogsState.page = 1;

  const url = `/api/logs?page=${LogsState.page}&limit=${LogsState.limit}&level=${LogsState.level}`;
  try {
    const res  = await fetch(url);
    const data = await res.json();

    LogsState.total = data.total;
    renderLogsTable(data.items);
    updateStats(data.items);
    updatePagination(data.total, data.page, data.limit);
  } catch (err) {
    console.error('Error cargando logs:', err);
  }
}

/* ── Paginación ───────────────────────────────────── */
function updatePagination(total, page, limit) {
  const totalPages = Math.ceil(total / limit) || 1;
  $('logs-page-info').textContent = `Página ${page} de ${totalPages} · ${total} registros`;
  $('logs-prev').disabled = page <= 1;
  $('logs-next').disabled = page >= totalPages;
}

$('logs-prev').addEventListener('click', () => {
  if (LogsState.page > 1) { LogsState.page--; loadLogs(); }
});
$('logs-next').addEventListener('click', () => {
  LogsState.page++;
  loadLogs();
});

/* ── Filtro de nivel ──────────────────────────────── */
$('logs-filter-level').addEventListener('change', e => {
  LogsState.level = e.target.value;
  loadLogs(true);
});

/* ── Botón actualizar ─────────────────────────────── */
$('btn-logs-refresh').addEventListener('click', () => loadLogs());

/* ── Limpiar logs ─────────────────────────────────── */
$('btn-logs-clear').addEventListener('click', async () => {
  if (!confirm('¿Limpiar todo el historial de logs? Esta acción no se puede deshacer.')) return;
  const res = await fetch('/api/logs', { method: 'DELETE' });
  if (res.ok) {
    LogsState.page = 1;
    loadLogs();
    toast('Historial limpiado');
  } else {
    toast('Error al limpiar logs', 'error');
  }
});

/* ── SSE — conexión en tiempo real ───────────────── */
function connectSSE() {
  if (LogsState.sseSource) {
    LogsState.sseSource.close();
    LogsState.sseSource = null;
  }

  const es = new EventSource('/api/logs/stream');
  LogsState.sseSource = es;

  es.addEventListener('open', () => {
    setLiveStatus(true);
  });

  es.addEventListener('message', e => {
    try {
      const entry = JSON.parse(e.data);

      // Sólo insertar en tabla si el panel de logs está activo
      // y el filtro de nivel coincide
      const panelActive = document.getElementById('panel-logs').classList.contains('active');
      const levelMatch  = LogsState.level === 'all' || LogsState.level === entry.level;

      if (panelActive && levelMatch && LogsState.page === 1) {
        const tbody = $('logs-tbody');

        // Quitar placeholder si existe
        const placeholder = tbody.querySelector('.logs-placeholder');
        if (placeholder) placeholder.remove();

        // Insertar fila nueva al inicio con animación
        const tr = buildLogRow(entry, true);
        tbody.insertBefore(tr, tbody.firstChild);

        // Limitar filas visibles a 100 para no sobrecargar DOM
        const rows = tbody.querySelectorAll('tr:not(.logs-placeholder)');
        if (rows.length > 100) rows[rows.length - 1].remove();

        // Actualizar total
        LogsState.total++;
        $('stat-total').textContent = LogsState.total;

        // Incrementar counter correcto
        const statEl = $(`stat-${entry.level}`);
        if (statEl) statEl.textContent = parseInt(statEl.textContent || '0') + 1;
      }
    } catch { /* ignore parse errors */ }
  });

  es.addEventListener('error', () => {
    setLiveStatus(false);
    // Reintentar en 5 segundos
    setTimeout(connectSSE, 5000);
  });
}

function setLiveStatus(connected) {
  const indicator = $('logs-live-indicator');
  const label     = $('logs-live-label');
  const dot       = indicator.querySelector('.logs-live-dot');
  const sidebarDot = $('sidebar-live-dot');

  if (connected) {
    dot.classList.add('connected');
    sidebarDot?.classList.add('connected');
    label.textContent = 'En vivo';
    label.style.color = 'var(--success)';
  } else {
    dot.classList.remove('connected');
    sidebarDot?.classList.remove('connected');
    label.textContent = 'Reconectando...';
    label.style.color = 'var(--text-muted)';
  }
}

/* ── Cargar logs al abrir el panel ───────────────── */
// La conexión SSE se inicia en showDashboard(); el panel de logs
// carga su historial al hacer clic, via el listener central de nav-item.

/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */
checkAuth();
