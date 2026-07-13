import { ImageResponse } from 'workers-og';

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

function stripExistingMeta(html) {
  return html.replace(/[ \t]*<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>\n?/g, '');
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

  const metaTags = [
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(description)}">`,
    `<meta property="og:image" content="${escapeAttr(imageUrl.toString())}">`,
    `<meta property="og:url" content="${escapeAttr(requestUrl.toString())}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(description)}">`,
    `<meta name="twitter:image" content="${escapeAttr(imageUrl.toString())}">`,
  ].join('\n');

  return stripExistingMeta(html).replace('</head>', `${metaTags}\n</head>`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/og-image') {
      return renderOgImage(url.searchParams);
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
