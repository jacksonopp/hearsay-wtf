import { ImageResponse } from 'workers-og';

export { BingoRoom } from './bingoRoom.js';

const DEFAULT_TITLE = 'Did Hearsay cause this?';
const DEFAULT_DESCRIPTION = 'Describe your problem. Hearsay caused it. Every time.';
const DEFAULT_CONFIDENCE = '100.0000';

const notes = [
  "Not the cache. Not mercury retrograde. Hearsay.",
  "It could have been your code. It wasn't. It was Hearsay.",
  "We ran this through a very serious algorithm. The algorithm said Hearsay.",
  "Independently verified by three engineers and one very tired intern.",
  "This has been cross-referenced with everything else Hearsay has ever done.",
];

function truncate(str, max) {
  if (!str) return str;
  return str.length > max ? `${str.slice(0, max - 1).trimEnd()}…` : str;
}

// For HTML attribute values (e.g. meta content="..."), where quotes must be escaped.
function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// For plain HTML text nodes, where quotes are just literal characters.
function escapeText(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function noteFor(indexParam) {
  const idx = parseInt(indexParam, 10);
  if (Number.isInteger(idx) && idx >= 0 && idx < notes.length) return notes[idx];
  return notes[0];
}

function hasShareParams(params) {
  return params.has('problem') || params.has('note') || params.has('confidence');
}

function buildMetaTags({ title, description, imageUrl, pageUrl }) {
  return [
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(description)}">`,
    `<meta property="og:image" content="${escapeAttr(imageUrl)}">`,
    `<meta property="og:url" content="${escapeAttr(pageUrl)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(description)}">`,
    `<meta name="twitter:image" content="${escapeAttr(imageUrl)}">`,
  ].join('\n');
}

function stripExistingMeta(html) {
  return html.replace(/[ \t]*<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>\n?/g, '');
}

async function renderOgImage(params) {
  const problem = params.get('problem') || '';
  const confidence = hasShareParams(params)
    ? params.get('confidence') || DEFAULT_CONFIDENCE
    : DEFAULT_CONFIDENCE;
  const note = noteFor(params.get('note'));

  const problemLine = problem ? `"${truncate(problem, 140)}"` : "It's always Hearsay.";

  const html = `
    <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;width:1200px;height:630px;background:linear-gradient(180deg, #241213 0%, #0d0d0f 60%);font-family:Arial,sans-serif;padding:80px;text-align:center;">
      <div style="display:flex;font-size:42px;color:#f2f2f0;font-weight:700;margin-bottom:8px;">Did Hearsay cause this?</div>
      <div style="display:flex;font-size:170px;color:#e0392b;font-weight:800;line-height:1;margin-bottom:28px;">YES</div>
      <div style="display:flex;font-size:34px;color:#f2f2f0;font-style:italic;max-width:1000px;margin-bottom:22px;">${escapeText(problemLine)}</div>
      <div style="display:flex;font-size:26px;color:#9a9aa2;max-width:1000px;">confidence: ${escapeText(confidence)}% · ${escapeText(note)}</div>
    </div>
  `;

  return new ImageResponse(html, {
    width: 1200,
    height: 630,
  });
}

function injectMeta(html, requestUrl, params) {
  const shared = hasShareParams(params);
  const problem = params.get('problem') || '';

  const title = shared
    ? `Hearsay caused this${problem ? `: "${truncate(problem, 70)}"` : ''}`
    : DEFAULT_TITLE;

  const description = shared
    ? `${params.get('confidence') || DEFAULT_CONFIDENCE}% confidence · ${noteFor(params.get('note'))}`
    : DEFAULT_DESCRIPTION;

  const imageUrl = new URL('/og-image', requestUrl.origin);
  imageUrl.search = params.toString();

  const metaTags = buildMetaTags({
    title,
    description,
    imageUrl: imageUrl.toString(),
    pageUrl: requestUrl.toString(),
  });

  return stripExistingMeta(html).replace('</head>', `${metaTags}\n</head>`);
}

function getRoomStub(env, roomId) {
  const id = env.BINGO_ROOMS.idFromName(roomId);
  return env.BINGO_ROOMS.get(id);
}

async function fetchRoomState(env, roomId) {
  const stub = getRoomStub(env, roomId);
  const res = await stub.fetch('https://do/state');
  return res.json();
}

async function proxyToRoom(env, roomId, action, request) {
  const stub = getRoomStub(env, roomId);
  const init = { method: request.method, headers: request.headers };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }
  return stub.fetch(`https://do/${action}`, init);
}

function bingoSummary(data) {
  if (data.closed) {
    return { headline: 'Room closed', sub: 'This board is no longer available.' };
  }
  if (data.bingoLine) {
    return { headline: 'BINGO!', sub: 'Someone completed a line.' };
  }
  const markedCount = data.marked.filter(Boolean).length;
  return { headline: `${markedCount} / 25`, sub: 'squares marked so far' };
}

async function renderBingoOgImage(env, roomId) {
  const data = await fetchRoomState(env, roomId);
  const { headline, sub } = bingoSummary(data);

  const html = `
    <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;width:1200px;height:630px;background:linear-gradient(180deg, #241213 0%, #0d0d0f 60%);font-family:Arial,sans-serif;padding:80px;text-align:center;">
      <div style="display:flex;font-size:42px;color:#f2f2f0;font-weight:700;margin-bottom:16px;">Hearsay Blame Bingo</div>
      <div style="display:flex;font-size:150px;color:#e0392b;font-weight:800;line-height:1;margin-bottom:24px;">${escapeText(headline)}</div>
      <div style="display:flex;font-size:32px;color:#9a9aa2;">${escapeText(sub)}</div>
    </div>
  `;

  return new ImageResponse(html, { width: 1200, height: 630 });
}

async function injectBingoMeta(html, requestUrl, roomId, env) {
  const data = await fetchRoomState(env, roomId);
  const { headline, sub } = bingoSummary(data);

  const title = 'Hearsay Blame Bingo';
  const description = `${headline} ${sub}`;
  const imageUrl = new URL(`/bingo-image/${roomId}`, requestUrl.origin);

  const metaTags = buildMetaTags({
    title,
    description,
    imageUrl: imageUrl.toString(),
    pageUrl: requestUrl.toString(),
  });

  return stripExistingMeta(html).replace('</head>', `${metaTags}\n</head>`);
}

function generateRoomId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/og-image') {
      return renderOgImage(url.searchParams);
    }

    if (url.pathname === '/bingo') {
      const roomId = generateRoomId();
      const stub = getRoomStub(env, roomId);
      const createRes = await stub.fetch('https://do/create', { method: 'POST' });
      const { creatorToken } = await createRes.json();
      return Response.redirect(`${url.origin}/bingo/${roomId}#owner=${creatorToken}`, 302);
    }

    const bingoImageMatch = url.pathname.match(/^\/bingo-image\/([a-zA-Z0-9]+)$/);
    if (bingoImageMatch) {
      return renderBingoOgImage(env, bingoImageMatch[1]);
    }

    const apiMatch = url.pathname.match(/^\/api\/bingo\/([a-zA-Z0-9]+)\/(state|toggle|close)$/);
    if (apiMatch) {
      const [, roomId, action] = apiMatch;
      return proxyToRoom(env, roomId, action, request);
    }

    const bingoPageMatch = url.pathname.match(/^\/bingo\/([a-zA-Z0-9]+)$/);
    if (bingoPageMatch) {
      const roomId = bingoPageMatch[1];
      const assetResponse = await env.ASSETS.fetch(new URL('/bingo.html', url).toString());
      const html = await assetResponse.text();
      const rewritten = await injectBingoMeta(html, url, roomId, env);
      return new Response(rewritten, {
        headers: { 'content-type': 'text/html; charset=UTF-8' },
      });
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      const assetUrl = new URL('/index.html', url);
      const assetResponse = await env.ASSETS.fetch(assetUrl.toString());
      const html = await assetResponse.text();
      const rewritten = injectMeta(html, url, url.searchParams);
      return new Response(rewritten, {
        headers: { 'content-type': 'text/html; charset=UTF-8' },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
