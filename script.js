const form = document.getElementById('blameForm');
const problemInput = document.getElementById('problem');
const answer = document.getElementById('answer');
const result = document.getElementById('result');
const echo = document.getElementById('echo');
const probability = document.getElementById('probability');
const againBtn = document.getElementById('again');
const copyLinkBtn = document.getElementById('copyLink');

const notes = [
  "Not the cache. Not mercury retrograde. Hearsay.",
  "It could have been your code. It wasn't. It was Hearsay.",
  "We ran this through a very serious algorithm. The algorithm said Hearsay.",
  "Independently verified by three engineers and one very tired intern.",
  "This has been cross-referenced with everything else Hearsay has ever done.",
];

function randomOf(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomNoteIndex() {
  return Math.floor(Math.random() * notes.length);
}

function randomHighConfidence() {
  return (99 + Math.random()).toFixed(4);
}

function showResult(problem, noteIndex, confidence) {
  const note = notes[noteIndex] ?? randomOf(notes);

  answer.textContent = 'YES';
  answer.classList.remove('slam');
  void answer.offsetWidth;
  answer.classList.add('slam');

  echo.textContent = problem
    ? `"${problem}" — that was Hearsay.`
    : 'Whatever it was, it was Hearsay.';

  probability.textContent = `confidence: ${confidence}% · ${note}`;

  result.hidden = false;
}

function shareUrl(problem, noteIndex, confidence) {
  const params = new URLSearchParams();
  params.set('problem', problem);
  params.set('note', String(noteIndex));
  params.set('confidence', confidence);

  const url = new URL(window.location.href);
  url.search = params.toString();
  return url;
}

function loadFromQuery() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('note') && !params.has('confidence') && !params.has('problem')) {
    return;
  }

  const problem = params.get('problem') ?? '';
  const parsedIndex = parseInt(params.get('note'), 10);
  const noteIndex = Number.isInteger(parsedIndex)
    ? ((parsedIndex % notes.length) + notes.length) % notes.length
    : randomNoteIndex();
  const confidence = params.get('confidence') || randomHighConfidence();

  problemInput.value = problem;
  showResult(problem, noteIndex, confidence);
  result.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const problem = problemInput.value.trim();
  const noteIndex = randomNoteIndex();
  const confidence = randomHighConfidence();

  showResult(problem, noteIndex, confidence);
  result.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const url = shareUrl(problem, noteIndex, confidence);
  history.replaceState(null, '', url);
});

againBtn.addEventListener('click', () => {
  result.hidden = true;
  answer.textContent = '?';
  problemInput.value = '';
  problemInput.focus();
  history.replaceState(null, '', window.location.pathname);
});

copyLinkBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    copyLinkBtn.textContent = 'Link copied!';
    copyLinkBtn.classList.add('copied');
  } catch {
    copyLinkBtn.textContent = 'Copy failed — copy from address bar';
  }
  setTimeout(() => {
    copyLinkBtn.textContent = 'Copy share link';
    copyLinkBtn.classList.remove('copied');
  }, 2000);
});

loadFromQuery();
