const form = document.getElementById('blameForm');
const problemInput = document.getElementById('problem');
const answer = document.getElementById('answer');
const result = document.getElementById('result');
const echo = document.getElementById('echo');
const probability = document.getElementById('probability');
const againBtn = document.getElementById('again');

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

function randomHighConfidence() {
  return (99 + Math.random()).toFixed(4);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const problem = problemInput.value.trim();

  answer.textContent = 'YES';
  answer.classList.remove('slam');
  void answer.offsetWidth;
  answer.classList.add('slam');

  echo.textContent = problem
    ? `"${problem}" — that was Hearsay.`
    : 'Whatever it was, it was Hearsay.';

  probability.textContent = `confidence: ${randomHighConfidence()}% · ${randomOf(notes)}`;

  result.hidden = false;
  result.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

againBtn.addEventListener('click', () => {
  result.hidden = true;
  answer.textContent = '?';
  problemInput.value = '';
  problemInput.focus();
});
