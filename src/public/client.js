const statusEl = document.getElementById("status");
const deliverButtons = document.querySelectorAll('[data-role="deliver"] button');
const predictButtons = document.querySelectorAll('[data-role="predict"] button');

function render(round) {
  for (const btn of deliverButtons) btn.classList.remove("selected");
  for (const btn of predictButtons) btn.classList.remove("selected");
  statusEl.classList.remove("hit", "miss");

  if (!round) {
    statusEl.textContent = "Waiting for a delivery…";
    return;
  }

  if (round.prediction) {
    for (const btn of predictButtons) {
      if (btn.dataset.call === round.prediction) btn.classList.add("selected");
    }
  }

  if (round.result) {
    for (const btn of deliverButtons) {
      if (btn.dataset.call === round.delivery) btn.classList.add("selected");
    }
    statusEl.textContent =
      round.result === "hit"
        ? `Predicted right! It was ${round.delivery}.`
        : `Missed — it was ${round.delivery}, not ${round.prediction}.`;
    statusEl.classList.add(round.result);
    return;
  }

  if (round.awaitingPrediction) {
    statusEl.textContent = "Delivery locked in — waiting for a prediction…";
    return;
  }

  statusEl.textContent = "Waiting for a delivery…";
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

const stream = new EventSource("/api/stream");
stream.addEventListener("state", (event) => {
  const { round } = JSON.parse(event.data);
  render(round);
});
