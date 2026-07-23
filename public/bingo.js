const board = document.getElementById('board');
const bingoBanner = document.getElementById('bingoBanner');
const copyRoomLinkBtn = document.getElementById('copyRoomLink');
const closeRoomBtn = document.getElementById('closeRoom');
const roomStatus = document.getElementById('roomStatus');
const toast = document.getElementById('toast');

const POLL_INTERVAL_MS = 3000;

const roomId = window.location.pathname.split('/').pop();
const tokenKey = `bingo:${roomId}:creatorToken`;

let pollTimer = null;
let closed = false;

function claimOwnerTokenFromHash() {
  const hash = window.location.hash;
  const match = hash.match(/[#&]owner=([^&]+)/);
  if (match) {
    localStorage.setItem(tokenKey, decodeURIComponent(match[1]));
    history.replaceState(null, '', window.location.pathname);
  }
}

let toastTimeout;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 2500);
}

function render(data) {
  board.innerHTML = '';

  const winning = new Set(data.bingoLine ?? []);

  data.phrases.forEach((phrase, index) => {
    const cell = document.createElement('div');
    cell.className = 'square';
    cell.textContent = phrase;

    const isFree = index === 12;
    if (isFree) cell.classList.add('free');
    if (data.marked[index]) cell.classList.add('marked');
    if (winning.has(index)) cell.classList.add('winning');

    if (!isFree) {
      cell.addEventListener('click', () => toggleSquare(index));
    }

    board.appendChild(cell);
  });

  bingoBanner.hidden = !data.bingoLine;
  closeRoomBtn.hidden = !localStorage.getItem(tokenKey);
}

async function fetchState() {
  const res = await fetch(`/api/bingo/${roomId}/state`);
  const data = await res.json();

  if (data.closed) {
    closed = true;
    stopPolling();
    board.innerHTML = '';
    bingoBanner.hidden = true;
    closeRoomBtn.hidden = true;
    roomStatus.textContent = 'This room has been closed by its creator.';
    return;
  }

  render(data);
}

async function toggleSquare(index) {
  if (closed) return;
  const res = await fetch(`/api/bingo/${roomId}/toggle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ index }),
  });
  const data = await res.json();
  render(data);
}

function startPolling() {
  if (pollTimer || closed) return;
  pollTimer = setInterval(fetchState, POLL_INTERVAL_MS);
}

function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    fetchState();
    startPolling();
  } else {
    stopPolling();
  }
});

copyRoomLinkBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast('Copied to clipboard!');
  } catch {
    showToast('Copy failed — copy from address bar');
  }
});

closeRoomBtn.addEventListener('click', async () => {
  const token = localStorage.getItem(tokenKey);
  if (!token) return;
  if (!window.confirm('Close this room? This deletes the board for everyone.')) return;

  const res = await fetch(`/api/bingo/${roomId}/close`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ creatorToken: token }),
  });

  if (res.ok) {
    closed = true;
    stopPolling();
    localStorage.removeItem(tokenKey);
    board.innerHTML = '';
    bingoBanner.hidden = true;
    closeRoomBtn.hidden = true;
    roomStatus.textContent = 'Room closed.';
  } else {
    showToast("Couldn't close room — wrong device?");
  }
});

claimOwnerTokenFromHash();
fetchState();
if (document.visibilityState === 'visible') {
  startPolling();
}
