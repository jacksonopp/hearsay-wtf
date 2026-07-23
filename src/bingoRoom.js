const FREE_SPACE_INDEX = 12;
const FREE_SPACE_TEXT = 'FREE — Hearsay caused this too';

const PHRASE_POOL = [
  "It's a caching issue",
  "Ticket's been open for 6 months",
  "Works fine in staging",
  "Support says it's expected behavior",
  "The CMS ate my changes",
  "Rolled back and it's still broken",
  "It's a browser issue (it wasn't)",
  "Someone published over my draft",
  "Preview doesn't match production",
  "The ticket auto-closed itself",
  "It worked five minutes ago",
  "Field mapping silently changed",
  "The API returned undefined for everything",
  "Permissions reset overnight",
  "A plugin update broke three others",
  "The editor crashed mid-save",
  "Status page says all systems operational",
  "Nobody on the call knows why",
  "It's a known issue with no ETA",
  "The fix is scheduled for 'next release'",
  "Cache invalidation invalidated nothing",
  "The webhook fired twice",
  "The webhook never fired",
  "The A/B test broke the control group too",
  "Content synced to the wrong environment",
  "The export button exports nothing",
  "Search index is a day behind",
  "An edit vanished with no history",
  "The staging password expired again",
  "'That's actually intended behavior'",
];

function buildBoard() {
  const pool = [...PHRASE_POOL];
  const phrases = new Array(25);
  phrases[FREE_SPACE_INDEX] = FREE_SPACE_TEXT;

  for (let i = 0; i < 25; i++) {
    if (i === FREE_SPACE_INDEX) continue;
    const pick = Math.floor(Math.random() * pool.length);
    phrases[i] = pool.splice(pick, 1)[0];
  }

  const marked = new Array(25).fill(false);
  marked[FREE_SPACE_INDEX] = true;

  return { phrases, marked };
}

function winningLine(marked) {
  const lines = [];
  for (let r = 0; r < 5; r++) lines.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
  for (let c = 0; c < 5; c++) lines.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
  lines.push([0, 6, 12, 18, 24]);
  lines.push([4, 8, 12, 16, 20]);

  for (const line of lines) {
    if (line.every((i) => marked[i])) return line;
  }
  return null;
}

export class BingoRoom {
  constructor(state) {
    this.state = state;
  }

  publicView(data) {
    return {
      phrases: data.phrases,
      marked: data.marked,
      closed: false,
      bingoLine: winningLine(data.marked),
    };
  }

  async ensureData() {
    let data = await this.state.storage.get('data');
    if (!data) {
      const { phrases, marked } = buildBoard();
      const creatorToken = crypto.randomUUID();
      data = { phrases, marked, creatorToken };
      await this.state.storage.put('data', data);
    }
    return data;
  }

  async fetch(request) {
    const url = new URL(request.url);

    const closed = await this.state.storage.get('closed');
    if (closed) {
      return Response.json({ closed: true });
    }

    // Only called once, right when a room is minted (see the Worker's /bingo
    // handler) - the one and only response that ever exposes creatorToken.
    if (request.method === 'POST' && url.pathname.endsWith('/create')) {
      const data = await this.ensureData();
      return Response.json({ ...this.publicView(data), creatorToken: data.creatorToken });
    }

    // Safe to call any number of times, from anywhere (client polling, the
    // server's own OG-preview rendering) - never creates a token race and
    // never leaks the creatorToken.
    if (request.method === 'GET' && url.pathname.endsWith('/state')) {
      const data = await this.ensureData();
      return Response.json(this.publicView(data));
    }

    const data = await this.state.storage.get('data');
    if (!data) {
      return Response.json({ closed: true });
    }

    if (request.method === 'POST' && url.pathname.endsWith('/toggle')) {
      const { index } = await request.json();
      if (Number.isInteger(index) && index >= 0 && index < 25 && index !== FREE_SPACE_INDEX) {
        data.marked[index] = !data.marked[index];
        await this.state.storage.put('data', data);
      }
      return Response.json(this.publicView(data));
    }

    if (request.method === 'POST' && url.pathname.endsWith('/close')) {
      const { creatorToken } = await request.json();
      if (creatorToken !== data.creatorToken) {
        return Response.json({ error: 'forbidden' }, { status: 403 });
      }
      await this.state.storage.deleteAll();
      await this.state.storage.put('closed', true);
      return Response.json({ closed: true });
    }

    return new Response('Not found', { status: 404 });
  }
}
