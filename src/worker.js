import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import landingPage from '../public/index.html';
import faviconSvg from '../public/favicon.svg';
import statusPage from '../public/status.html';
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
const THUMB_PROXY = 'https://gd-level-api.liamt.xyz/thumbnail/';       // tu dominio, devuelto en JSON
const DIFF_API    = 'https://autonick.github.io/diff-faces/levels/';
const NO_THUMB  = 'https://raw.githubusercontent.com/cdc-sys/level-thumbs-mod/main/resources/noThumb.png';
const FONT_400  = 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf';
const FONT_700  = 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf';
const WATERMARK = 'gd-level-api.liamt.xyz';

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

async function rateLimit(env, ip, bucket, limit) {
  if (!env?.CARD_CACHE) return false;
  const key = `rl:${bucket}:${ip}`;
  const cur = await env.CARD_CACHE.get(key);
  const n   = cur ? parseInt(cur) + 1 : 1;
  await env.CARD_CACHE.put(key, String(n), { expirationTtl: 120 });
  return n > limit;
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
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const mime = res.headers.get('content-type') || '';

    if (mime.includes('webp')) {
      const ctrl2 = new AbortController();
      const timer2 = setTimeout(() => ctrl2.abort(), 6000);
      const pngRes = await fetch(`https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=png`, { signal: ctrl2.signal });
      clearTimeout(timer2);
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


// ── Handler: /api/level ───────────────────────────────────────────────────────
async function handleLevel(url, env) {
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

  // track views async
  if (env?.CARD_CACHE) {
    env.CARD_CACHE.get('leaderboard:views','json').then(v => {
      const views = v || {}; views[id] = (views[id]||0)+1;
      env.CARD_CACHE.put('leaderboard:views', JSON.stringify(views));
    }).catch(()=>{});
  }

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

  const [icoDl, icoLike, , icoStar, icoCoin] = icons || [];

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

// ── Handler: /api/levels (batch) ─────────────────────────────────────────────
async function handleLevelsBatch(url, env) {
  const raw = url.searchParams.get('ids') || '';
  const ids = [...new Set(raw.split(',').map(Number).filter(n => n > 0))].slice(0, 10);
  if (!ids.length) return json({ error: 'Parameter "ids" required. e.g. /api/levels?ids=128,1,2' }, 400);
  const results = await Promise.all(ids.map(id => {
    const u = new URL(url.href); u.searchParams.set('id', id);
    return handleLevel(u, env).then(r => r.json()).catch(() => null);
  }));
  return json(results.filter(Boolean));
}

// ── Handler: /api/leaderboard ─────────────────────────────────────────────────
const POPULAR_FALLBACK = [
  { id: 128,      name: '1st level',      views: 0 },
  { id: 10565740, name: 'Clubstep',       views: 0 },
  { id: 44543505, name: 'Finger Dash',    views: 0 },
  { id: 27318416, name: 'Deadlocked',     views: 0 },
  { id: 39017968, name: 'The Lightning Road', views: 0 },
];
async function handleLeaderboard(env) {
  const raw = await env?.CARD_CACHE?.get('leaderboard:views', 'json').catch(() => null);
  const views = raw || {};
  const sorted = Object.entries(views).sort((a,b) => b[1]-a[1]).slice(0,10)
    .map(([id, v]) => ({ id: Number(id), views: v }));
  return json(sorted.length ? sorted : POPULAR_FALLBACK);
}

// ── Handler: /kofi-webhook ────────────────────────────────────────────────────
async function handleKofiWebhook(request, env) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const data = JSON.parse(params.get('data') || '{}');
    if (!data.amount || !data.currency) return new Response('ok');
    const usd = data.currency === 'USD' ? parseFloat(data.amount) : parseFloat(data.amount) * 0.001;
    if (env?.CARD_CACHE) {
      const current = await env.CARD_CACHE.get('kofi:total', 'json').catch(() => 0) || 0;
      await env.CARD_CACHE.put('kofi:total', JSON.stringify(current + usd));
      await env.CARD_CACHE.put('kofi:last', JSON.stringify({ name: data.from_name, amount: usd, message: data.message, ts: Date.now() }));
    }
    return new Response('ok');
  } catch { return new Response('ok'); }
}

// ── Handler: /api/kofi-goal ───────────────────────────────────────────────────
async function handleKofiGoal(env) {
  const total = await env?.CARD_CACHE?.get('kofi:total', 'json').catch(() => 0) || 0;
  const last  = await env?.CARD_CACHE?.get('kofi:last',  'json').catch(() => null);
  return json({ total: Math.round(total * 100) / 100, goal: 100, pct: Math.min(100, Math.round(total)), last }, { headers: CORS });
}

// ── Handler: /api/status ──────────────────────────────────────────────────────
async function handleStatus() {
  return json({
    status: 'operational',
    latency_ms: 0,
    upstream: { gdbrowser: 'up' },
    timestamp: new Date().toISOString(),
  });
}

// ── Cron: runs every hour, saves uptime to KV ─────────────────────────────────
async function runUptimeCron(env) {
  const today = new Date().toISOString().slice(0, 10);
  const checks = { api: false, gdb: false, thumb: false };

  await Promise.all([
    fetch('https://gd-level-api.liamt.xyz/api/level?id=128').then(r => { checks.api = r.ok; }).catch(() => {}),
    fetch('https://gdbrowser.com/api/level/128').then(r => { checks.gdb = r.ok; }).catch(() => {}),
    fetch('https://levelthumbs.prevter.me/thumbnail/1').then(r => { checks.thumb = r.ok; }).catch(() => {}),
  ]);

  if (!env?.CARD_CACHE) return;

  const raw = await env.CARD_CACHE.get('status:history', 'json').catch(() => ({})) || {};
  for (const svc of ['api','gdb','thumb']) {
    if (!raw[svc]) raw[svc] = {};
    const prev = raw[svc][today] ?? 1;
    raw[svc][today] = checks[svc] ? Math.min(1, prev) : 0;
  }
  raw.current = checks;
  raw.lastCheck = new Date().toISOString();
  await env.CARD_CACHE.put('status:history', JSON.stringify(raw));

  // notify subscribers if any service went down
  const anyDown = !checks.api || !checks.gdb || !checks.thumb;
  if (anyDown && env.RESEND_KEY) {
    const subs = await env.CARD_CACHE.get('status:subscribers', 'json').catch(() => []) || [];
    const downList = ['api','gdb','thumb'].filter(s => !checks[s])
      .map(s => ({ api:'GD Level API', gdb:'GDBrowser', thumb:'Thumbnail Service' })[s]);
    for (const email of subs) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'status@gd-level-api.liamt.xyz',
          to: email,
          subject: '🔴 GD Level API — Service disruption detected',
          html: `<p>Hi,</p><p>We detected an issue with: <strong>${downList.join(', ')}</strong>.</p><p>Check <a href="https://gd-level-api.liamt.xyz/status">gd-level-api.liamt.xyz/status</a> for updates.</p><p style="font-size:12px;color:#666">Unsubscribe: reply with "unsubscribe"</p>`,
        }),
      }).catch(() => {});
    }
  }
}

// ── Handler: /api/status-history ─────────────────────────────────────────────
async function handleStatusHistory(env) {
  const raw = await env?.CARD_CACHE?.get('status:history', 'json').catch(() => null) || {};
  // default current to all up if no data yet
  if (!raw.current) raw.current = { api: true, gdb: true, thumb: true };
  if (!raw.lastCheck) raw.lastCheck = new Date().toISOString();
  return json(raw);
}

// ── Handler: /api/subscribe ───────────────────────────────────────────────────
async function handleSubscribe(request, env) {
  const { email } = await request.json().catch(() => ({}));
  if (!email || !email.includes('@')) return json({ error: 'Invalid email' }, 400);
  const subs = await env?.CARD_CACHE?.get('status:subscribers', 'json').catch(() => []) || [];
  if (subs.includes(email)) return json({ ok: true, message: 'Already subscribed' });
  subs.push(email);
  await env?.CARD_CACHE?.put('status:subscribers', JSON.stringify(subs));

  // welcome email
  if (env?.RESEND_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'status@gd-level-api.liamt.xyz',
        to: email,
        subject: '✅ Subscribed to GD Level API status updates',
        html: `<p>Hi!</p><p>You're now subscribed to <strong>GD Level API</strong> status updates.</p><p>You'll receive an email if any service goes down.</p><p>Check status anytime: <a href="https://gd-level-api.liamt.xyz/status">gd-level-api.liamt.xyz/status</a></p>`,
      }),
    }).catch(() => {});
  }

  return json({ ok: true });
}

// ── Handler: /api/card ────────────────────────────────────────────────────────
async function handleCard(url, env, request) {
  const id   = Number(url.searchParams.get('id'));
  const size = url.searchParams.get('size') === 'small' ? 'small' : 'normal';
  if (!id || id < 1) return new Response('ID inválido', { status: 400, headers: CORS });

  const ip  = request.headers.get('CF-Connecting-IP') || 'unknown';
  const min = Math.floor(Date.now() / 60000);
  if (await rateLimit(env, ip, `card:${min}`, 15))
    return json({ error: 'Too many requests. Try again in a minute.' }, 429);

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

// ── Handler: /og ─────────────────────────────────────────────────────────────
async function handleOgImage(env) {
  const cacheKey = 'og:banner:v4';
  if (env?.CARD_CACHE) {
    const cached = await env.CARD_CACHE.get(cacheKey, 'arrayBuffer');
    if (cached) return new Response(cached, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } });
  }

  const [[fontRegular, fontBold], faviconData] = await Promise.all([
    ensureFonts().then(f => (ensureWasm(), f)),
    toDataUrl('https://raw.githubusercontent.com/GD-Level-API/GD-Level-API/master/public/assets/favicon.png').catch(() => null),
  ]);
  await ensureWasm();

  const svg = await satori(
    h('div', {
      style: {
        width: '1200px', height: '630px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #07070b 0%, #0d0d14 50%, #1a1a2e 100%)',
        fontFamily: 'Inter', position: 'relative',
      },
    },
      h('div', { style: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 30%, rgba(99,102,241,0.12), transparent 60%)', borderRadius: '0' } }),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px' } },
        h('div', { style: { width: '72px', height: '72px', background: 'linear-gradient(135deg,#f59e0b,#f97316)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } },
          faviconData
            ? h('img', { src: faviconData, style: { width: '56px', height: '56px', objectFit: 'contain' } })
            : h('div', { style: { color: '#000', fontSize: '42px', fontWeight: 900, lineHeight: 1 } }, 'GD'),
        ),
        h('div', { style: { fontSize: '52px', fontWeight: 900, color: '#eeeeff', letterSpacing: '-2px' } }, 'GD Level API'),
      ),
      h('div', { style: { fontSize: '24px', color: '#6060a0', textAlign: 'center', maxWidth: '780px', lineHeight: 1.5 } },
        'Free public REST API for Geometry Dash',
      ),
      h('div', { style: { display: 'flex', gap: '16px', marginTop: '40px' } },
        ...['Level data', 'PNG Cards', 'Search', 'User Profiles', 'Player Icons'].map(label =>
          h('div', { style: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 20px', fontSize: '17px', color: '#9090c0' } }, label)
        ),
      ),
      h('div', { style: { position: 'absolute', bottom: '32px', fontSize: '16px', color: '#3d3d5c' } }, 'gd-level-api.liamt.xyz'),
    ),
    {
      width: 1200, height: 630,
      fonts: [
        { name: 'Inter', data: fontRegular, weight: 400, style: 'normal' },
        { name: 'Inter', data: fontBold,    weight: 700, style: 'normal' },
      ],
    }
  );

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  const png   = resvg.render().asPng();

  if (env?.CARD_CACHE) await env.CARD_CACHE.put(cacheKey, png, { expirationTtl: 86400 });

  return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } });
}

// ── Handler: /api/random ─────────────────────────────────────────────────────
async function handleRandom(url) {
  const page = Math.floor(Math.random() * 8);
  const res  = await fetch(`https://gdbrowser.com/api/search/*?diff=-&featured=1&page=${page}&count=20`);
  if (!res.ok) return json({ error: 'Could not fetch a random level' }, 502);
  const levels = await res.json();
  if (!Array.isArray(levels) || !levels.length) return json({ error: 'No levels found' }, 502);
  const picked  = levels[Math.floor(Math.random() * levels.length)];
  const fakeUrl = new URL(`${url.origin}/api/level?id=${Number(picked.id)}`);
  return handleLevel(fakeUrl);
}

// ── Handler: /api/user ────────────────────────────────────────────────────────
async function handleUser(url) {
  const name = url.searchParams.get('name')?.trim();
  if (!name) return json({ error: 'Parameter "name" required. e.g. /api/user?name=RobTop' }, 400);

  const res = await fetch(`https://gdbrowser.com/api/profile/${encodeURIComponent(name)}`);
  if (!res.ok) return json({ error: 'User not found' }, 404);
  const u = await res.json();
  if (!u?.username) return json({ error: 'User not found' }, 404);

  return json({
    username:      u.username,
    playerID:      u.playerID      || null,
    accountID:     u.accountID     || null,
    rank:          u.globalRank    || null,
    stars:         u.stars         || 0,
    diamonds:      u.diamonds      || 0,
    coins:         u.coins         || 0,
    userCoins:     u.userCoins     || 0,
    demons:        u.demons        || 0,
    creatorPoints: u.cp            || 0,
    socials: {
      youtube: u.youtube || null,
      twitter: u.twitter || null,
      twitch:  u.twitch  || null,
    },
    urls: {
      avatar: `https://gdbrowser.com/icon/${encodeURIComponent(u.username)}?form=${u.iconType || 'cube'}&col1=${u.col1 ?? 0}&col2=${u.col2 ?? 3}&glow=${u.glow ? 1 : 0}`,
    },
  });
}

// ── Handler: /api/icon ───────────────────────────────────────────────────────
const ICON_FORMS = ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider', 'swing', 'jetpack'];
const ICON_FIELD = { cube: 'icon', ship: 'ship', ball: 'ball', ufo: 'ufo', wave: 'wave', robot: 'robot', spider: 'spider', swing: 'swing', jetpack: 'jetpack' };

async function handleIcon(url, env) {
  const name = url.searchParams.get('name')?.trim();
  if (!name) return json({ error: 'Parameter "name" required. e.g. /api/icon?name=RobTop' }, 400);

  const all  = url.searchParams.get('all') === '1';
  const form = url.searchParams.get('form')?.toLowerCase();

  const res = await fetch(`https://gdbrowser.com/api/profile/${encodeURIComponent(name)}`, {
    headers: { 'User-Agent': 'GD-Level-API/1.0' },
  });
  if (!res.ok) return json({ error: 'User not found' }, 404);
  const u = await res.json();
  if (!u?.username) return json({ error: 'User not found' }, 404);

  const col1 = u.col1 ?? 0;
  const col2 = u.col2 ?? 3;
  const glow = u.glow ? 1 : 0;
  const activeForm = ICON_FORMS[u.iconType] || 'cube';

  const iconUrl = (f) =>
    `https://icon.liamt.xyz/icon?name=${encodeURIComponent(u.username)}&form=${f}`;

  const apiUrl = (f) =>
    `${url.origin}/api/icon?name=${encodeURIComponent(u.username)}&form=${f}`;

  if (all) {
    const icons = {};
    for (const f of ICON_FORMS) {
      const num = u[ICON_FIELD[f]] ?? 1;
      icons[f] = {
        form:   f,
        num,
        url:    apiUrl(f),
        active: f === activeForm,
      };
    }
    return json({
      username:   u.username,
      activeForm,
      col1, col2, glow: !!u.glow,
      icons,
    });
  }

  const target = (form && ICON_FORMS.includes(form)) ? form : activeForm;
  const imgRes = await fetch(iconUrl(target));
  if (!imgRes.ok) return json({ error: 'Could not fetch icon' }, 502);

  const buf = await imgRes.arrayBuffer();
  return new Response(buf, {
    headers: {
      'Content-Type':  'image/png',
      'Cache-Control': 'public, max-age=300',
      ...CORS,
    },
  });
}

async function handleIconComposite(url) {
  const name = url.searchParams.get('name')?.trim();
  if (!name) return json({ error: 'Parameter "name" required' }, 400);
  const res = await fetch(`https://icon.liamt.xyz/composite?name=${encodeURIComponent(name)}`);
  if (!res.ok) return json({ error: 'Render failed' }, 502);
  const buf = await res.arrayBuffer();
  return new Response(buf, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300', ...CORS } });
}

// ── Handler: /api/search ─────────────────────────────────────────────────────
async function handleSearch(url, env, request) {
  const q     = url.searchParams.get('q')?.trim();
  const count = Math.min(Number(url.searchParams.get('count') || 10), 20);
  if (!q) return json({ error: 'Parámetro q requerido. Ej: /api/search?q=Bloodbath' }, 400);

  const ip  = request.headers.get('CF-Connecting-IP') || 'unknown';
  const min = Math.floor(Date.now() / 60000);
  if (await rateLimit(env, ip, `search:${min}`, 30))
    return json({ error: 'Too many requests. Try again in a minute.' }, 429);

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
  if (!id || !/^\d+$/.test(id)) return new Response('ID inválido', { status: 400, headers: CORS });

  const res = await fetch(`${THUMB_SRC}${id}`);
  if (!res.ok) {
    const fallback = await fetch(NO_THUMB);
    if (!fallback.ok) return new Response('Thumbnail no encontrado', { status: 404, headers: CORS });
    return new Response(await fallback.arrayBuffer(), {
      headers: { ...CORS, 'Content-Type': fallback.headers.get('content-type') || 'image/png', 'Cache-Control': 'public, max-age=86400' },
    });
  }

  return new Response(await res.arrayBuffer(), {
    headers: {
      ...CORS,
      'Content-Type':  res.headers.get('content-type') || 'image/webp',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

// ── Router principal ──────────────────────────────────────────────────────────
// ── Discord OAuth2 + Comments ─────────────────────────────────────────────────
const DISCORD_CLIENT_ID  = '1509380071545110538';
const DISCORD_REDIRECT   = 'https://gd-level-api.liamt.xyz/auth/callback';
const SESS_TTL           = 60 * 60 * 24 * 7; // 7 days in seconds

function getSession(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match  = cookie.match(/gd_session=([^;]+)/);
  return match ? match[1] : null;
}

function sessionCookie(id, clear = false) {
  if (clear) return `gd_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
  return `gd_session=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESS_TTL}`;
}

function jsonResp(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  });
}

async function handleAuthDiscord() {
  const params = new URLSearchParams({
    client_id:     DISCORD_CLIENT_ID,
    redirect_uri:  DISCORD_REDIRECT,
    response_type: 'code',
    scope:         'identify',
  });
  return Response.redirect(`https://discord.com/oauth2/authorize?${params}`, 302);
}

async function handleAuthCallback(url, env) {
  const code = url.searchParams.get('code');
  if (!code) return Response.redirect('/?auth=error', 302);

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_SECRET,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  DISCORD_REDIRECT,
    }),
  });

  if (!tokenRes.ok) return Response.redirect('/?auth=error', 302);
  const { access_token } = await tokenRes.json();

  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!userRes.ok) return Response.redirect('/?auth=error', 302);
  const user = await userRes.json();

  const sessId = crypto.randomUUID();
  const sessData = JSON.stringify({
    discord_id: user.id,
    username:   user.username,
    avatar:     user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 6}.png`,
  });

  await env.CARD_CACHE.put(`sess:${sessId}`, sessData, { expirationTtl: SESS_TTL });

  return new Response(null, {
    status: 302,
    headers: { Location: '/?auth=ok', 'Set-Cookie': sessionCookie(sessId) },
  });
}

async function handleAuthLogout(request, env) {
  const sessId = getSession(request);
  if (sessId && env.CARD_CACHE) await env.CARD_CACHE.delete(`sess:${sessId}`);
  return new Response(null, {
    status: 302,
    headers: { Location: '/', 'Set-Cookie': sessionCookie('', true) },
  });
}

async function handleAuthMe(request, env) {
  const sessId = getSession(request);
  if (!sessId) return jsonResp({ user: null });
  const raw = await env.CARD_CACHE.get(`sess:${sessId}`);
  if (!raw) return jsonResp({ user: null });
  return jsonResp({ user: JSON.parse(raw) });
}

async function handleGetComments(url, env) {
  const page  = url.searchParams.get('page') || 'general';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const { results } = await env.DB.prepare(
    `SELECT id, discord_id, username, avatar, content, is_bug, created_at
     FROM comments WHERE page = ? ORDER BY created_at DESC LIMIT ?`
  ).bind(page, limit).all();
  return jsonResp(results);
}

async function handlePostComment(request, url, env) {
  const sessId = getSession(request);
  if (!sessId) return jsonResp({ error: 'Not authenticated' }, 401);
  const raw = await env.CARD_CACHE.get(`sess:${sessId}`);
  if (!raw) return jsonResp({ error: 'Session expired' }, 401);
  const user = JSON.parse(raw);

  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const content = (body.content || '').trim().slice(0, 500);
  if (!content) return jsonResp({ error: 'Content required' }, 400);
  const page   = (body.page || 'general').slice(0, 64);
  const is_bug = body.is_bug ? 1 : 0;

  const { meta } = await env.DB.prepare(
    `INSERT INTO comments (page, discord_id, username, avatar, content, is_bug) VALUES (?,?,?,?,?,?)`
  ).bind(page, user.discord_id, user.username, user.avatar, content, is_bug).run();

  return jsonResp({ id: meta.last_row_id, username: user.username, content, is_bug, page }, 201);
}

async function handleDeleteComment(request, url, env) {
  const sessId = getSession(request);
  if (!sessId) return jsonResp({ error: 'Not authenticated' }, 401);
  const raw = await env.CARD_CACHE.get(`sess:${sessId}`);
  if (!raw) return jsonResp({ error: 'Session expired' }, 401);
  const user = JSON.parse(raw);

  const id = parseInt(url.searchParams.get('id'));
  if (!id) return jsonResp({ error: 'Missing id' }, 400);

  await env.DB.prepare(
    `DELETE FROM comments WHERE id = ? AND discord_id = ?`
  ).bind(id, user.discord_id).run();

  return jsonResp({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    try {
      if (url.pathname === '/api/level')               return await handleLevel(url, env);
      if (url.pathname === '/api/levels')              return await handleLevelsBatch(url, env);
      if (url.pathname === '/api/leaderboard')         return await handleLeaderboard(env);
      if (url.pathname === '/api/status')              return await handleStatus();
      if (url.pathname === '/api/status-history')      return await handleStatusHistory(env);
      if (url.pathname === '/api/run-cron')            { await runUptimeCron(env); return json({ ok: true }); }
      if (url.pathname === '/api/subscribe' && request.method === 'POST') return await handleSubscribe(request, env);
      if (url.pathname === '/api/kofi-goal')           return await handleKofiGoal(env);
      if (url.pathname === '/kofi-webhook' && request.method === 'POST') return await handleKofiWebhook(request, env);
      if (url.pathname === '/api/random')              return await handleRandom(url);
      if (url.pathname === '/api/user')                return await handleUser(url);
      if (url.pathname === '/api/icon')                return await handleIcon(url, env);
      if (url.pathname === '/api/icon/composite')      return await handleIconComposite(url);
      if (url.pathname === '/api/search')              return await handleSearch(url, env, request);
      if (url.pathname === '/api/card')                return await handleCard(url, env, request);
      if (url.pathname.startsWith('/thumbnail/'))      return await handleThumbnail(url.pathname);

      if (url.pathname === '/auth/discord')            return await handleAuthDiscord();
      if (url.pathname === '/auth/callback')           return await handleAuthCallback(url, env);
      if (url.pathname === '/auth/logout')             return await handleAuthLogout(request, env);
      if (url.pathname === '/auth/me')                 return await handleAuthMe(request, env);

      if (url.pathname === '/api/comments') {
        if (request.method === 'GET')    return await handleGetComments(url, env);
        if (request.method === 'POST')   return await handlePostComment(request, url, env);
        if (request.method === 'DELETE') return await handleDeleteComment(request, url, env);
      }

      if (url.pathname === '/' || url.pathname === '/index.html') {
        return new Response(landingPage, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      if (url.pathname === '/status') {
        return new Response(statusPage, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      if (url.pathname === '/favicon.svg') {
        return new Response(faviconSvg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } });
      }
      if (url.pathname === '/og') return await handleOgImage(env);
      return new Response('Not Found', { status: 404 });
    } catch (err) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runUptimeCron(env));
  },
};
