import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import landingPage from '../public/index.html';
import faviconSvg from '../public/favicon.svg';
import resvgWasm from '../node_modules/@resvg/resvg-wasm/index_bg.wasm';

const REACT_ELEMENT = Symbol.for('react.element');
function h(type, props, ...children) {
  const flat = children.flat(Infinity).filter(c => c !== null && c !== undefined && c !== false);
  return {
    $$typeof: REACT_ELEMENT,
    type,
    key: props?.key ?? null,
    ref: null,
    props: { ...props, children: flat.length === 0 ? undefined : flat.length === 1 ? flat[0] : flat },
    _owner: null,
    _store: {},
  };
}

// ── Constantes ────────────────────────────────────────────────────────────────
const GD_WORKER   = 'https://royal-water-898c.lester-0f9.workers.dev/?id=';
const THUMB_SRC   = 'https://levelthumbs.prevter.me/thumbnail/';  // fuente real, uso interno
const THUMB_PROXY = 'https://thumball.liamt.xyz/thumbnail/';       // tu dominio, devuelto en JSON
const DIFF_API    = 'https://autonick.github.io/diff-faces/levels/';
const NO_THUMB  = 'https://raw.githubusercontent.com/cdc-sys/level-thumbs-mod/main/resources/noThumb.png';
const FONT_400  = 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf';
const FONT_700  = 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf';
const WATERMARK = 'thumball.liamt.xyz';

const DIFF_KEY = {
  'Auto': 'auto', 'Easy': 'easy', 'Normal': 'normal', 'Hard': 'hard',
  'Harder': 'harder', 'Insane': 'insane', 'Easy Demon': 'easyDemon',
  'Medium Demon': 'mediumDemon', 'Hard Demon': 'hardDemon',
  'Insane Demon': 'insaneDemon', 'Extreme Demon': 'extremeDemon', 'NA': 'na',
};

const LEN_ES = {
  Tiny: 'Muy corto', Short: 'Corto', Medium: 'Medio',
  Long: 'Largo', XL: 'XL', Platformer: 'Platformer',
};

// ── Caches en memoria (persisten entre requests calientes) ────────────────────
let wasmReady  = null;
let fontsReady = null;
let iconsReady = null;

const GDB = 'https://gdbrowser.com/assets/';

function ensureWasm() {
  if (!wasmReady) wasmReady = initWasm(resvgWasm);
  return wasmReady;
}

function ensureFonts() {
  if (!fontsReady) {
    fontsReady = Promise.all([
      fetch(FONT_400).then(r => r.arrayBuffer()),
      fetch(FONT_700).then(r => r.arrayBuffer()),
    ]);
  }
  return fontsReady;
}

function ensureIcons() {
  if (!iconsReady) {
    iconsReady = Promise.all([
      toDataUrl(`${GDB}download.png`),
      toDataUrl(`${GDB}like.png`),
      toDataUrl(`${GDB}dislike.png`),
      toDataUrl(`${GDB}star.png`),
      toDataUrl(`${GDB}coin.png`),
    ]);
  }
  return iconsReady;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function resolveLevel(level) {
  const coins     = level.coins || 0;
  const typeStr   = level.mythic ? 'mythic' : level.legendary ? 'legendary' : level.epic ? 'epic' : level.featured ? 'feature' : 'none';
  const diffKey   = DIFF_KEY[level.difficulty] || 'na';
  const coinStr   = coins > 0 ? `${coins}${level.verifiedCoins ? 'v' : 'u'}` : 'none';
  const ratingStr = level.stars > 0 ? `${level.stars}s` : 'none';
  const diffUrl   = `${DIFF_API}${typeStr}/${diffKey}/${coinStr}/${ratingStr}.png`;
  const epicLabel = level.mythic ? 'Mythic' : level.legendary ? 'Legendary' : level.epic ? 'Epic' : null;
  const extras    = [
    epicLabel,
    (!level.epic && !level.legendary && !level.mythic && level.featured) ? 'Featured' : null,
    coins > 0 ? `${coins} coin${coins > 1 ? 's' : ''}${level.verifiedCoins ? ' ✓' : ''}` : null,
  ].filter(Boolean);

  return { coins, typeStr, diffKey, coinStr, ratingStr, diffUrl, epicLabel, extras };
}

// Convierte URL a base64 data URL. Si es WebP usa weserv para convertir a PNG
// (satori no soporta WebP).
async function toDataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mime = res.headers.get('content-type') || '';

    if (mime.includes('webp')) {
      const pngRes = await fetch(`https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=png`);
      if (!pngRes.ok) return null;
      return bufToDataUrl(await pngRes.arrayBuffer(), 'image/png');
    }

    return bufToDataUrl(await res.arrayBuffer(), mime || 'image/png');
  } catch { return null; }
}

function bufToDataUrl(buf, mime) {
  const bytes  = new Uint8Array(buf);
  const CHUNK  = 8192;
  let binary   = '';
  for (let i = 0; i < bytes.length; i += CHUNK)
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return `data:${mime};base64,${btoa(binary)}`;
}

function starsText(n) {
  if (!n) return '';
  return '★'.repeat(Math.min(n, 10));
}

// ── Handler: /api/level ───────────────────────────────────────────────────────
async function handleLevel(url) {
  const id = Number(url.searchParams.get('id'));
  if (!id || id < 1) return json({ error: 'ID inválido. Usá /api/level?id=128' }, 400);

  const [gdRes, thumbRes] = await Promise.all([
    fetch(`${GD_WORKER}${id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
    fetch(`${THUMB_SRC}${id}/info`),
  ]);

  if (!gdRes.ok) return json({ error: 'Nivel no encontrado' }, 404);
  const level = await gdRes.json();
  if (!level?.name) return json({ error: 'Nivel no encontrado' }, 404);

  const thumbUrl = thumbRes.ok ? `${THUMB_PROXY}${id}` : NO_THUMB;
  const { diffUrl, extras, coins } = resolveLevel(level);

  return json({
    id,
    name:          level.name,
    author:        level.author         || 'Desconocido',
    downloads:     Number(level.downloads || 0),
    likes:         Number(level.likes     || 0),
    length:        level.length           || 'Unknown',
    lengthEs:      LEN_ES[level.length]   || level.length || 'Desconocido',
    difficulty:    level.difficulty       || 'NA',
    stars:         level.stars            || 0,
    coins,
    verifiedCoins: level.verifiedCoins    || false,
    featured:      level.featured         || false,
    epic:          level.epic             || false,
    legendary:     level.legendary        || false,
    mythic:        level.mythic           || false,
    extras,
    song: {
      name:   level.songName   || 'Desconocida',
      author: level.songAuthor || 'Desconocido',
    },
    urls: {
      thumbnail: thumbUrl,
      diffFace:  diffUrl,
      card:      `${url.origin}/api/card?id=${id}`,
    },
  });
}

// ── Handler: /api/levels (múltiples IDs) ─────────────────────────────────────
async function handleLevels(url) {
  const raw = url.searchParams.get('ids') || '';
  const ids = [...new Set(raw.split(',').map(Number).filter(n => n > 0))].slice(0, 10);
  if (!ids.length) return json({ error: 'Usá /api/levels?ids=128,1,2 (máx 10)' }, 400);

  const results = await Promise.all(ids.map(async id => {
    try {
      const [gdRes, thumbRes] = await Promise.all([
        fetch(`${GD_WORKER}${id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
        fetch(`${THUMB_SRC}${id}/info`),
      ]);
      if (!gdRes.ok) return { id, error: 'No encontrado' };
      const level = await gdRes.json();
      if (!level?.name) return { id, error: 'No encontrado' };
      const thumbUrl = thumbRes.ok ? `${THUMB_PROXY}${id}` : NO_THUMB;
      const { diffUrl, extras, coins } = resolveLevel(level);
      return {
        id,
        name:          level.name,
        author:        level.author         || 'Desconocido',
        downloads:     Number(level.downloads || 0),
        likes:         Number(level.likes     || 0),
        length:        level.length           || 'Unknown',
        difficulty:    level.difficulty       || 'NA',
        stars:         level.stars            || 0,
        coins,
        verifiedCoins: level.verifiedCoins    || false,
        featured:      level.featured         || false,
        epic:          level.epic             || false,
        legendary:     level.legendary        || false,
        mythic:        level.mythic           || false,
        extras,
        song: { name: level.songName || 'Desconocida', author: level.songAuthor || 'Desconocido' },
        urls: {
          thumbnail: thumbUrl,
          diffFace:  diffUrl,
          card:      `${url.origin}/api/card?id=${id}`,
        },
      };
    } catch (e) {
      return { id, error: e.message };
    }
  }));

  return json(results);
}

// ── Render card SVG ───────────────────────────────────────────────────────────
function buildCard(level, thumbData, diffData, size, icons) {
  const small = size === 'small';
  const W = small ? 600 : 800;
  const H = small ? 160 : 260;
  const thumbW = small ? 160 : 240;

  const [icoDl, icoLike, icoDis, icoStar, icoCoin] = icons || [];

  const { coins } = resolveLevel(level);
  const duracion  = LEN_ES[level.length] || level.length || '?';
  const downloads = Number(level.downloads || 0).toLocaleString('es');
  const likes     = Number(level.likes || 0).toLocaleString('es');
  const stars     = level.stars || 0;
  const song      = `${level.songName || '?'} - ${level.songAuthor || '?'}`;

  const fs = small
    ? { label: 8, title: 15, sub: 10, stat: 10, badge: 8, song: 9, wm: 8, diff: 38, ico: 11 }
    : { label: 10, title: 21, sub: 13, stat: 13, badge: 10, song: 11, wm: 9, diff: 54, ico: 14 };
  const pad = small ? '10px 14px' : '16px 20px';
  const gap = small ? '4px' : '7px';

  // Label superior según estado del nivel
  const topLabel = level.mythic    ? 'MYTHIC'
    : level.legendary ? 'LEGENDARY'
    : level.epic      ? 'EPIC'
    : level.featured  ? 'FEATURED'
    : stars > 0       ? 'RATED'
    : level.difficulty !== 'NA' ? level.difficulty.toUpperCase()
    : 'UNRATED';

  const topColor = level.mythic    ? '#e040fb'
    : level.legendary ? '#ff9800'
    : level.epic      ? '#ff5722'
    : level.featured  ? '#4fc3f7'
    : stars > 0       ? '#f0c94e'
    : '#6666aa';

  // Stat con icono GD
  const statItem = (ico, value) => h('div', {
    style: { display: 'flex', alignItems: 'center', gap: '4px' },
  },
    ico ? h('img', { src: ico, width: fs.ico, height: fs.ico, style: { objectFit: 'contain' } }) : null,
    h('span', { style: { color: '#c8c8e0', fontSize: `${fs.stat}px`, display: 'flex' } }, value),
  );

  // Badges de estado (featured/epic/coins)
  const badgePill = (text, accent) => h('span', {
    style: {
      display: 'flex', background: `${accent}22`, border: `1px solid ${accent}55`,
      color: accent, fontSize: `${fs.badge}px`, padding: '2px 9px',
      borderRadius: '20px', whiteSpace: 'nowrap',
    },
  }, text);

  const extraBadges = [
    level.mythic    ? badgePill('Mythic',    '#e040fb') : null,
    level.legendary ? badgePill('Legendary', '#ff9800') : null,
    level.epic      ? badgePill('Epic',      '#ff5722') : null,
    (!level.epic && !level.legendary && !level.mythic && level.featured) ? badgePill('Featured', '#4fc3f7') : null,
    coins > 0 ? badgePill(`${coins} coin${coins > 1 ? 's' : ''}${level.verifiedCoins ? ' v' : ''}`, '#81c784') : null,
  ].filter(Boolean);

  return h('div', {
    style: {
      display: 'flex', width: `${W}px`, height: `${H}px`,
      background: 'linear-gradient(135deg, #0d0d20 0%, #12122a 100%)',
      fontFamily: 'Inter', overflow: 'hidden',
    },
  },
    // Thumbnail
    thumbData
      ? h('img', { src: thumbData, width: thumbW, height: H, style: { objectFit: 'cover', flexShrink: 0 } })
      : h('div', { style: { width: `${thumbW}px`, height: `${H}px`, background: '#1a1a35', flexShrink: 0, display: 'flex' } }),

    // Borde lateral
    h('div', { style: { width: '2px', background: `linear-gradient(180deg, ${topColor} 0%, ${topColor}44 100%)`, flexShrink: 0 } }),

    // Contenido
    h('div', {
      style: { display: 'flex', flexDirection: 'column', flex: 1, padding: pad, gap, background: 'transparent', overflow: 'hidden' },
    },

      // Fila superior: estado + ID
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        h('span', { style: { color: topColor, fontSize: `${fs.label}px`, fontWeight: 700, letterSpacing: '2px' } }, topLabel),
        h('span', { style: { color: '#444466', fontSize: `${fs.label - 1}px`, letterSpacing: '1px' } }, `#${level.id || ''}`),
      ),

      h('div', { style: { height: '1px', background: `linear-gradient(90deg, ${topColor}55 0%, transparent 100%)` } }),

      // Diff icon + nombre + autor
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        diffData
          ? h('img', { src: diffData, width: fs.diff, height: fs.diff, style: { objectFit: 'contain', flexShrink: 0 } })
          : h('div', { style: { width: `${fs.diff}px`, height: `${fs.diff}px`, flexShrink: 0, display: 'flex' } }),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' } },
          h('span', { style: { color: '#ffffff', fontSize: `${fs.title}px`, fontWeight: 700, display: 'flex', whiteSpace: 'nowrap', overflow: 'hidden' } }, level.name),
          h('span', { style: { color: '#9999bb', fontSize: `${fs.sub}px`, display: 'flex' } }, `by ${level.author || 'Unknown'}`),
        ),
      ),

      h('div', { style: { height: '1px', background: '#252545' } }),

      // Stats con íconos GD
      h('div', { style: { display: 'flex', gap: '16px', alignItems: 'center' } },
        statItem(icoDl,   downloads),
        statItem(icoLike, likes),
        statItem(null,    duracion),
        stars > 0 ? statItem(icoStar, `${stars}`) : null,
        coins > 0 && icoCoin
          ? statItem(icoCoin, `${coins}`)
          : null,
      ),

      h('div', { style: { flex: 1 } }),

      // Footer: canción + badges + watermark
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' } },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' } },
          h('span', { style: { color: '#555577', fontSize: `${fs.song}px`, display: 'flex', whiteSpace: 'nowrap', overflow: 'hidden' } }, `~ ${song}`),
          extraBadges.length > 0
            ? h('div', { style: { display: 'flex', gap: '4px' } }, ...extraBadges)
            : null,
        ),
        h('span', { style: { color: '#333355', fontSize: `${fs.wm}px`, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '8px' } }, WATERMARK),
      ),
    ),
  );
}

// ── Handler: /api/card ────────────────────────────────────────────────────────
async function handleCard(url, env) {
  const id   = Number(url.searchParams.get('id'));
  const size = url.searchParams.get('size') === 'small' ? 'small' : 'normal';
  if (!id || id < 1) return new Response('ID inválido', { status: 400, headers: CORS });

  // KV cache: clave única por ID + tamaño
  const cacheKey = `card:v2:${id}:${size}`;
  if (env?.CARD_CACHE) {
    const cached = await env.CARD_CACHE.get(cacheKey, 'arrayBuffer');
    if (cached) {
      return new Response(cached, {
        headers: { ...CORS, 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600', 'X-Cache': 'HIT' },
      });
    }
  }

  const [[fontRegular, fontBold], , [gdRes, thumbRes], icons] = await Promise.all([
    ensureFonts(),
    ensureWasm(),
    Promise.all([
      fetch(`${GD_WORKER}${id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      fetch(`${THUMB_SRC}${id}/info`),
    ]),
    ensureIcons(),
  ]);

  if (!gdRes.ok) return new Response('Nivel no encontrado', { status: 404, headers: CORS });
  const level = await gdRes.json();
  if (!level?.name) return new Response('Nivel no encontrado', { status: 404, headers: CORS });
  level.id = id;

  const rawThumb = thumbRes.ok ? `${THUMB_SRC}${id}` : NO_THUMB;
  const { diffUrl } = resolveLevel(level);

  const [thumbData, diffData] = await Promise.all([
    toDataUrl(rawThumb),
    toDataUrl(diffUrl),
  ]);

  const W = size === 'small' ? 600 : 800;
  const H = size === 'small' ? 160 : 260;

  const svg = await satori(buildCard(level, thumbData, diffData, size, icons), {
    width: W,
    height: H,
    fonts: [
      { name: 'Inter', data: fontRegular, weight: 400, style: 'normal' },
      { name: 'Inter', data: fontBold,    weight: 700, style: 'normal' },
    ],
  });

  const outW  = W * 2;
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: outW } });
  const png   = resvg.render().asPng();

  // Guardar en KV con TTL de 1 hora
  if (env?.CARD_CACHE) {
    await env.CARD_CACHE.put(cacheKey, png, { expirationTtl: 3600 });
  }

  return new Response(png, {
    headers: { ...CORS, 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600', 'X-Cache': 'MISS' },
  });
}

// ── Handler: /api/search ─────────────────────────────────────────────────────
async function handleSearch(url) {
  const q     = url.searchParams.get('q')?.trim();
  const count = Math.min(Number(url.searchParams.get('count') || 10), 20);
  if (!q) return json({ error: 'Parámetro q requerido. Ej: /api/search?q=Bloodbath' }, 400);

  const res = await fetch(
    `https://gdbrowser.com/api/search/${encodeURIComponent(q)}?count=${count}`
  );
  if (!res.ok) return json({ error: 'Sin resultados o error al buscar' }, 502);

  const raw = await res.json();
  if (!Array.isArray(raw) || !raw.length) return json([], 200);

  const levels = raw.map(l => {
    const id       = Number(l.id);
    const coins    = l.coins || 0;
    const diffKey  = DIFF_KEY[l.difficulty] || 'na';
    const typeStr  = l.mythic ? 'mythic' : l.legendary ? 'legendary' : l.epic ? 'epic' : l.featured ? 'feature' : 'none';
    const coinStr  = coins > 0 ? `${coins}${l.verifiedCoins ? 'v' : 'u'}` : 'none';
    const ratingStr = l.stars > 0 ? `${l.stars}s` : 'none';
    return {
      id,
      name:          l.name        || 'Desconocido',
      author:        l.author      || 'Desconocido',
      description:   l.description || '',
      downloads:     Number(l.downloads || 0),
      likes:         Number(l.likes     || 0),
      length:        l.length      || 'Unknown',
      lengthEs:      LEN_ES[l.length] || l.length || 'Desconocido',
      difficulty:    l.difficulty  || 'NA',
      stars:         l.stars       || 0,
      coins,
      verifiedCoins: l.verifiedCoins || false,
      featured:      l.featured    || false,
      epic:          l.epic        || false,
      legendary:     l.legendary   || false,
      mythic:        l.mythic      || false,
      urls: {
        thumbnail: `${THUMB_PROXY}${id}`,
        diffFace:  `${DIFF_API}${typeStr}/${diffKey}/${coinStr}/${ratingStr}.png`,
        card:      `${url.origin}/api/card?id=${id}`,
      },
    };
  });

  return json(levels);
}

// ── Handler: /thumbnail/:id ───────────────────────────────────────────────────
async function handleThumbnail(pathname) {
  const id = pathname.split('/')[2];
  if (!id) return new Response('ID requerido', { status: 400, headers: CORS });

  const res = await fetch(`${THUMB_SRC}${id}`);
  if (!res.ok) return new Response('Thumbnail no encontrado', { status: 404, headers: CORS });

  const body = await res.arrayBuffer();
  return new Response(body, {
    headers: {
      ...CORS,
      'Content-Type':  res.headers.get('content-type') || 'image/webp',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

// ── Router principal ──────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    try {
      if (url.pathname === '/api/level')               return await handleLevel(url);
      if (url.pathname === '/api/levels')              return await handleLevels(url);
      if (url.pathname === '/api/search')              return await handleSearch(url);
      if (url.pathname === '/api/card')                return await handleCard(url, env);
      if (url.pathname.startsWith('/thumbnail/'))      return await handleThumbnail(url.pathname);
      if (url.pathname === '/' || url.pathname === '/index.html') {
        return new Response(landingPage, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      if (url.pathname === '/favicon.svg') {
        return new Response(faviconSvg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } });
      }
      return new Response('Not Found', { status: 404 });
    } catch (err) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  },
};
