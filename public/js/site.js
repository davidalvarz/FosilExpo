/* ═══════════════════════════════════════════════════════
   FOSSIL EXPO — SITIO PÚBLICO
═══════════════════════════════════════════════════════ */

const FONT_MAP = {
  'ibm-plex-serif': "'IBM Plex Serif', Georgia, serif",
  'ibm-plex-sans':  "'IBM Plex Sans', system-ui, sans-serif",
  'ibm-plex-mono':  "'IBM Plex Mono', 'Courier New', monospace",
  'source-serif':   "'Source Serif 4', Georgia, serif",
  'source-sans':    "'Source Sans 3', system-ui, sans-serif",
  'crimson':        "'Crimson Pro', Georgia, serif",
  'nunito-sans':    "'Nunito Sans', system-ui, sans-serif",
  'spectral':       "'Spectral', Georgia, serif",
};

function getFontFamily(key) {
  return FONT_MAP[key] || FONT_MAP['ibm-plex-serif'];
}

/* ── Renderizado del Hero ──────────────────────────────── */
function renderHero(settings) {
  const { siteTitle, subtitle, description, heroImage, accentColor, globalFont } = settings;

  document.getElementById('page-title').textContent = siteTitle || 'Exposición de Fósiles';
  document.getElementById('nav-brand').textContent   = siteTitle || 'Exposición de Fósiles';
  document.getElementById('hero-title').textContent  = siteTitle || 'Exposición de Fósiles';
  document.getElementById('hero-subtitle').textContent = subtitle || '';
  document.getElementById('hero-desc').textContent   = description || '';
  document.getElementById('footer-text').textContent  = settings.footerText || '';

  if (accentColor) {
    document.documentElement.style.setProperty('--accent', accentColor);
    // Derive a light accent (just lighten it slightly)
    document.documentElement.style.setProperty('--accent-light', accentColor + '99');
  }

  if (globalFont) {
    document.body.style.fontFamily = getFontFamily(globalFont);
  }

  const heroBg = document.getElementById('hero-bg');
  if (heroImage) {
    heroBg.style.backgroundImage = `url(${heroImage})`;
    const img = new Image();
    img.onload = () => heroBg.classList.add('loaded');
    img.src = heroImage;
  }
}

/* ── Sección de Texto ─────────────────────────────────── */
function renderTextSection(section) {
  const fontFamily = getFontFamily(section.font);
  const align      = section.textAlign || 'left';

  const el = document.createElement('section');
  el.className = `site-section sec-text align-${align}`;
  el.dataset.id = section.id;

  const authorsHtml = section.authors
    ? `<p class="section-authors">${esc(section.authors)}</p>`
    : '';

  el.innerHTML = `
    <div class="section-inner">
      ${section.title ? `<h2 class="section-title" style="font-family:${fontFamily}">${esc(section.title)}</h2>` : ''}
      ${authorsHtml}
      ${section.content ? `<div class="section-content" style="font-family:${fontFamily}">${nl2p(section.content)}</div>` : ''}
    </div>
  `;
  return el;
}

/* ── Sección de Imagen ─────────────────────────────────── */
function renderImageSection(section) {
  const fontFamily = getFontFamily(section.font);
  const item       = section.media && section.media[0];

  const el = document.createElement('section');
  el.className = 'site-section sec-image';
  el.dataset.id = section.id;

  let mediaHtml = '';
  if (item) {
    mediaHtml = `
      <div class="img-wrap">
        <img src="${item.url}" alt="${esc(item.caption || section.title || '')}" loading="lazy">
      </div>
      ${item.caption ? `<p class="img-caption">${esc(item.caption)}</p>` : ''}
    `;
  }

  const authorsHtml = section.authors
    ? `<p class="section-authors">${esc(section.authors)}</p>`
    : '';

  el.innerHTML = `
    <div class="section-inner">
      <div class="media-caption-wrap">
        ${section.title ? `<h2 class="section-title" style="font-family:${fontFamily}">${esc(section.title)}</h2>` : ''}
        ${authorsHtml}
        ${section.content ? `<p class="section-content" style="font-family:${fontFamily}">${esc(section.content)}</p>` : ''}
      </div>
      ${mediaHtml}
    </div>
  `;
  return el;
}

/* ── Sección de Galería ───────────────────────────────── */
function renderGallerySection(section) {
  const fontFamily    = getFontFamily(section.font);
  const displayStyle  = section.displayStyle || 'grid-2';
  const media         = section.media || [];

  const isWide = ['fullwidth', 'grid-3', 'masonry'].includes(displayStyle);

  const el = document.createElement('section');
  el.className = 'site-section sec-gallery';
  el.dataset.id = section.id;

  const itemsHtml = media.map(item => `
    <div class="gallery-item">
      <div class="img-wrap">
        <img src="${item.url}" alt="${esc(item.caption || '')}" loading="lazy">
      </div>
      ${item.caption ? `<p class="img-caption">${esc(item.caption)}</p>` : ''}
    </div>
  `).join('');

  el.innerHTML = `
    <div class="section-inner ${isWide ? 'wide' : ''}">
      ${(section.title || section.content || section.authors) ? `
        <div class="gallery-header">
          ${section.title ? `<h2 class="section-title" style="font-family:${fontFamily}">${esc(section.title)}</h2>` : ''}
          ${section.authors ? `<p class="section-authors">${esc(section.authors)}</p>` : ''}
          ${section.content ? `<p class="section-content" style="font-family:${fontFamily}">${esc(section.content)}</p>` : ''}
        </div>
      ` : ''}
      <div class="gallery-${displayStyle}">${itemsHtml}</div>
    </div>
  `;
  return el;
}

/* ── Sección de Vídeo ─────────────────────────────────── */
function renderVideoSection(section) {
  const fontFamily = getFontFamily(section.font);

  const el = document.createElement('section');
  el.className = 'site-section sec-video';
  el.dataset.id = section.id;

  let videoHtml = '';
  const src = section.videoFile || section.videoUrl || '';

  if (src) {
    const isYoutube = /youtube\.com|youtu\.be/.test(src);
    const isVimeo   = /vimeo\.com/.test(src);

    if (isYoutube) {
      const vid = src.match(/(?:v=|youtu\.be\/|embed\/)([^&?/]+)/)?.[1];
      videoHtml = vid
        ? `<div class="video-container aspect-16-9"><iframe src="https://www.youtube.com/embed/${vid}" frameborder="0" allowfullscreen></iframe></div>`
        : '';
    } else if (isVimeo) {
      const vid = src.match(/vimeo\.com\/(\d+)/)?.[1];
      videoHtml = vid
        ? `<div class="video-container aspect-16-9"><iframe src="https://player.vimeo.com/video/${vid}" frameborder="0" allowfullscreen></iframe></div>`
        : '';
    } else {
      videoHtml = `<div class="video-container"><video src="${src}" controls playsinline></video></div>`;
    }
  }

  el.innerHTML = `
    <div class="section-inner">
      ${section.title ? `<h2 class="section-title" style="font-family:${fontFamily}">${esc(section.title)}</h2>` : ''}
      ${section.authors ? `<p class="section-authors">${esc(section.authors)}</p>` : ''}
      ${section.content ? `<p class="section-content" style="font-family:${fontFamily}">${esc(section.content)}</p>` : ''}
      ${videoHtml}
    </div>
  `;
  return el;
}

/* ── Sección Separador ─────────────────────────────────── */
function renderDividerSection(section) {
  const style = section.dividerStyle || 'line';

  const el = document.createElement('section');
  el.className = 'site-section sec-divider';
  el.dataset.id = section.id;

  let inner = '';
  if (style === 'line') {
    inner = '<div class="divider-line"></div>';
  } else if (style === 'dots') {
    inner = '<div class="divider-dots"><span></span><span></span><span></span></div>';
  } else if (style === 'ornament') {
    inner = '<div class="divider-ornament">✦</div>';
  }

  el.innerHTML = inner;
  return el;
}

/* ── Dispatch principal ────────────────────────────────── */
function renderSection(section) {
  switch (section.type) {
    case 'text':    return renderTextSection(section);
    case 'image':   return renderImageSection(section);
    case 'gallery': return renderGallerySection(section);
    case 'video':   return renderVideoSection(section);
    case 'divider': return renderDividerSection(section);
    default:        return null;
  }
}

/* ── IntersectionObserver para reveal ─────────────────── */
function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.site-section').forEach(el => io.observe(el));
}

/* ── Nav scrolled ──────────────────────────────────────── */
function initNav() {
  const header = document.getElementById('site-header');
  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 80);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ── Helpers ───────────────────────────────────────────── */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2p(text) {
  if (!text) return '';
  return text.split(/\n\n+/).map(p => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
}

/* ── Init ──────────────────────────────────────────────── */
async function init() {
  try {
    const res  = await fetch('/api/content');
    const data = await res.json();

    renderHero(data.settings || {});
    initNav();

    const root     = document.getElementById('sections-root');
    const sections = (data.sections || []).sort((a, b) => a.order - b.order);

    sections.forEach(section => {
      const el = renderSection(section);
      if (el) root.appendChild(el);
    });

    // Pequena espera para que el DOM esté listo antes de iniciar el observer
    requestAnimationFrame(() => {
      setTimeout(initReveal, 50);
    });

  } catch (err) {
    console.error('Error cargando contenido:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);
