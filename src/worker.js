import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import landingPage from '../public/index.html';
import resvgWasm from '../node_modules/@resvg/resvg-wasm/index_bg.wasm';

// Construye React elements sin importar React (evita conflicto de instancias en wrangler)
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
const GD_WORKER = 'https://royal-water-898c.lester-0f9.workers.dev/?id=';
const THUMB_API = 'https://levelthumbs.prevter.me/thumbnail/';
const DIFF_API  = 'https://autonick.github.io/diff-faces/levels/';
const NO_THUMB  = 'https://raw.githubusercontent.com/cdc-sys/level-thumbs-mod/main/resources/noThumb.png';
const FONT_400 = 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf';
const FONT_700 = 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf';

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

// ── Caches (persisten entre requests calientes) ───────────────────────────────
let wasmReady = null;
let fontsReady = null;

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

function resolveLevel(level, id) {
  const coins    = level.coins || 0;
  const typeStr  = level.mythic ? 'mythic' : level.legendary ? 'legendary' : level.epic ? 'epic' : level.featured ? 'feature' : 'none';
  const diffKey  = DIFF_KEY[level.difficulty] || 'na';
  const coinStr  = coins > 0 ? `${coins}${level.verifiedCoins ? 'v' : 'u'}` : 'none';
  const ratingStr = level.stars > 0 ? `${level.stars}s` : 'none';
  const diffUrl  = `${DIFF_API}${typeStr}/${diffKey}/${coinStr}/${ratingStr}.png`;
  const epicLabel = level.mythic ? 'Mythic' : level.legendary ? 'Legendary' : level.epic ? 'Epic' : null;
  const extras = [
    epicLabel,
    (!level.epic && !level.legendary && !level.mythic && level.featured) ? 'Featured' : null,
    coins > 0 ? `${coins} coin${coins > 1 ? 's' : ''}${level.verifiedCoins ? ' ✓' : ''}` : null,
  ].filter(Boolean);

  return { coins, typeStr, diffKey, coinStr, ratingStr, diffUrl, epicLabel, extras };
}

// ── Handler: /api/level ───────────────────────────────────────────────────────
async function handleLevel(url) {
  const id = Number(url.searchParams.get('id'));
  if (!id || id < 1) return json({ error: 'ID inválido. Usá /api/level?id=128' }, 400);

  const [gdRes, thumbRes] = await Promise.all([
    fetch(`${GD_WORKER}${id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
    fetch(`${THUMB_API}${id}/info`),
  ]);

  if (!gdRes.ok) return json({ error: 'Nivel no encontrado' }, 404);
  const level = await gdRes.json();
  if (!level?.name) return json({ error: 'Nivel no encontrado' }, 404);

  const thumbUrl = thumbRes.ok ? `${THUMB_API}${id}` : NO_THUMB;
  const { diffUrl, extras } = resolveLevel(level, id);
  const { coins } = resolveLevel(level, id);

  return json({
    id,
    name:         level.name,
    author:       level.author        || 'Desconocido',
    downloads:    Number(level.downloads || 0),
    likes:        Number(level.likes     || 0),
    length:       level.length           || 'Unknown',
    lengthEs:     LEN_ES[level.length]   || level.length || 'Desconocido',
    difficulty:   level.difficulty       || 'NA',
    stars:        level.stars            || 0,
    coins,
    verifiedCoins: level.verifiedCoins  || false,
    featured:     level.featured         || false,
    epic:         level.epic             || false,
    legendary:    level.legendary        || false,
    mythic:       level.mythic           || false,
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

// Convierte URL de imagen a data URL para que satori la renderice
async function toDataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf   = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const CHUNK = 8192;
    let binary  = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const mime = res.headers.get('content-type') || 'image/png';
    return `data:${mime};base64,${btoa(binary)}`;
  } catch { return null; }
}

// ── Handler: /api/card ────────────────────────────────────────────────────────
async function handleCard(url) {
  const id = Number(url.searchParams.get('id'));
  if (!id || id < 1) return new Response('ID inválido', { status: 400, headers: CORS });

  const [[fontRegular, fontBold], , [gdRes, thumbRes]] = await Promise.all([
    ensureFonts(),
    ensureWasm(),
    Promise.all([
      fetch(`${GD_WORKER}${id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      fetch(`${THUMB_API}${id}/info`),
    ]),
  ]);

  if (!gdRes.ok) return new Response('Nivel no encontrado', { status: 404, headers: CORS });
  const level = await gdRes.json();
  if (!level?.name) return new Response('Nivel no encontrado', { status: 404, headers: CORS });

  const rawThumb  = thumbRes.ok ? `${THUMB_API}${id}` : NO_THUMB;
  const { diffUrl, coins } = resolveLevel(level, id);

  // Fetch imágenes como data URLs para que satori las renderice correctamente
  const [thumbData, diffData] = await Promise.all([
    toDataUrl(rawThumb),
    toDataUrl(diffUrl),
  ]);

  const duracion  = LEN_ES[level.length] || level.length || '?';
  const downloads = Number(level.downloads || 0).toLocaleString('es');
  const likes     = Number(level.likes || 0).toLocaleString('es');

  const epicLabel = level.mythic ? 'Mythic' : level.legendary ? 'Legendary' : level.epic ? 'Epic' : null;
  const cardExtras = [
    epicLabel,
    (!level.epic && !level.legendary && !level.mythic && level.featured) ? 'Featured' : null,
    coins > 0 ? `${coins} coin${coins > 1 ? 's' : ''}${level.verifiedCoins ? ' (v)' : ''}` : null,
  ].filter(Boolean);

  const card = h('div', {
    style: { display: 'flex', width: '800px', height: '260px', background: '#0f0f23', fontFamily: 'Inter', overflow: 'hidden' },
  },
    // Thumbnail
    thumbData
      ? h('img', { src: thumbData, width: 240, height: 260, style: { objectFit: 'cover', flexShrink: 0 } })
      : h('div', { style: { width: '240px', height: '260px', background: '#1a1a35', flexShrink: 0 } }),
    h('div', { style: { width: '1px', background: '#252545', flexShrink: 0 } }),
    h('div', {
      style: { display: 'flex', flexDirection: 'column', flex: 1, padding: '16px 20px', gap: '7px', background: '#161628', overflow: 'hidden' },
    },
      h('div', { style: { display: 'flex', color: '#f0c94e', fontSize: '10px', fontWeight: 700, letterSpacing: '2px' } }, 'NUEVO NIVEL PARA JUGAR'),
      h('div', { style: { height: '1px', background: '#252545' } }),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
        diffData
          ? h('img', { src: diffData, width: 54, height: 54, style: { objectFit: 'contain', flexShrink: 0 } })
          : h('div', { style: { width: '54px', height: '54px', flexShrink: 0 } }),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' } },
          h('span', { style: { color: '#ffffff', fontSize: '21px', fontWeight: 700, display: 'flex', whiteSpace: 'nowrap', overflow: 'hidden' } }, level.name),
          h('span', { style: { color: '#9999bb', fontSize: '13px', display: 'flex' } }, `por ${level.author || 'Desconocido'}`),
        ),
      ),
      h('div', { style: { height: '1px', background: '#252545' } }),
      h('div', { style: { display: 'flex', gap: '20px', color: '#c8c8e0', fontSize: '13px' } },
        h('span', { style: { display: 'flex' } }, `DL  ${downloads}`),
        h('span', { style: { display: 'flex' } }, `+${likes} likes`),
        h('span', { style: { display: 'flex' } }, duracion),
      ),
      h('div', { style: { flex: 1 } }),
      h('div', { style: { color: '#666688', fontSize: '12px', display: 'flex', whiteSpace: 'nowrap', overflow: 'hidden' } },
        `${level.songName || '?'} - ${level.songAuthor || '?'}`
      ),
      cardExtras.length > 0
        ? h('div', { style: { display: 'flex', gap: '5px' } },
            ...cardExtras.map(badge =>
              h('span', {
                style: { display: 'flex', background: '#252545', color: '#c8c8e0', fontSize: '10px', padding: '2px 9px', borderRadius: '20px', whiteSpace: 'nowrap' },
              }, badge),
            ),
          )
        : null,
    ),
  );

  const svg = await satori(card, {
    width: 800,
    height: 260,
    fonts: [
      { name: 'Inter', data: fontRegular, weight: 400, style: 'normal' },
      { name: 'Inter', data: fontBold,    weight: 700, style: 'normal' },
    ],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 800 } });
  const png   = resvg.render().asPng();

  return new Response(png, {
    headers: {
      ...CORS,
      'Content-Type':  'image/png',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

// ── Router principal ──────────────────────────────────────────────────────────
export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    try {
      if (url.pathname === '/api/level') return await handleLevel(url);
      if (url.pathname === '/api/card')  return await handleCard(url);
      if (url.pathname === '/' || url.pathname === '/index.html') {
        return new Response(landingPage, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      return new Response('Not Found', { status: 404 });
    } catch (err) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  },
};
