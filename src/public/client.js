const statusEl = document.getElementById("status");
const historyEl = document.getElementById("history");
const deliverButtons = document.querySelectorAll('[data-role="deliver"] button');
const predictButtons = document.querySelectorAll('[data-role="predict"] button');
const nameGateEl = document.getElementById("name-gate");
const gameEl = document.getElementById("game");
const nameFormEl = document.getElementById("name-form");
const nameInputEl = document.getElementById("name-input");

function renderStatus(state) {
  for (const btn of deliverButtons) btn.classList.remove("selected");
  for (const btn of predictButtons) btn.classList.remove("selected");
  statusEl.classList.remove("hit", "miss");

  if (state.pending) {
    statusEl.textContent = "A delivery is in — waiting for a prediction…";
    return;
  }

  const latest = state.history[0];
  if (!latest) {
    statusEl.textContent = "Waiting for a delivery…";
    return;
  }

  for (const btn of deliverButtons) {
    if (btn.dataset.call === latest.delivery) btn.classList.add("selected");
  }
  for (const btn of predictButtons) {
    if (btn.dataset.call === latest.prediction) btn.classList.add("selected");
  }
  statusEl.textContent =
    latest.result === "hit"
      ? `Predicted right! It was ${latest.delivery}.`
      : `Missed — it was ${latest.delivery}, not ${latest.prediction}.`;
  statusEl.classList.add(latest.result);
}

function renderHistory(history) {
  historyEl.replaceChildren(
    ...history.map((round) => {
      const li = document.createElement("li");
      li.className = round.result;
      li.textContent = `${round.bowlerName} delivered ${round.delivery}, ${round.predictorName} predicted ${round.prediction} — ${round.result === "hit" ? "hit" : "miss"}`;
      return li;
    }),
  );
}

function render(state) {
  renderStatus(state);
  renderHistory(state.history);
}

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: res.statusText }));
    statusEl.textContent = `Error: ${error}`;
  }
}

for (const btn of deliverButtons) {
  btn.addEventListener("click", () => post("/api/deliver", { delivery: btn.dataset.call }));
}

for (const btn of predictButtons) {
  btn.addEventListener("click", () => post("/api/predict", { prediction: btn.dataset.call }));
}

function showGame() {
  nameGateEl.hidden = true;
  gameEl.hidden = false;
}

nameFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInputEl.value.trim();
  if (!name) return;
  const res = await fetch("/api/me", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (res.ok) showGame();
});

async function checkName() {
  const res = await fetch("/api/me");
  const { name } = await res.json();
  if (name) {
    nameInputEl.value = name;
    showGame();
  }
}

checkName();

const stream = new EventSource("/api/stream");
stream.addEventListener("state", (event) => {
  render(JSON.parse(event.data));
});
