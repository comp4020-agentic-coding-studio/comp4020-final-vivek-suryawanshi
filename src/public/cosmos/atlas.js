// Discovery Atlas: short user observations attached to an object, live via
// SSE, persisted server-side. Every piece of observation text is rendered
// with textContent only — never innerHTML/insertAdjacentHTML — so a string
// like "<script>...</script>" always displays as literal characters and
// never executes, no matter who wrote it or how it arrived (initial fetch or
// a pushed SSE event).
const MAX_LENGTH = 280;

export function createAtlas({ listEl, formEl, textareaEl, charCountEl }) {
  let currentObjectId = null;
  let observations = [];

  function render() {
    listEl.replaceChildren(
      ...observations.map((obs) => {
        const li = document.createElement("li");
        li.className = "observation";
        li.dataset.id = String(obs.id);

        const byline = document.createElement("p");
        byline.className = "observation-byline";
        byline.textContent = obs.mine ? "you" : "an explorer";
        li.append(byline);

        const text = document.createElement("p");
        text.className = "observation-text";
        text.textContent = obs.text;
        li.append(text);

        if (obs.mine) {
          const actions = document.createElement("div");
          actions.className = "observation-actions";

          const editBtn = document.createElement("button");
          editBtn.type = "button";
          editBtn.textContent = "Edit";
          editBtn.addEventListener("click", () => beginEdit(obs, li));

          const deleteBtn = document.createElement("button");
          deleteBtn.type = "button";
          deleteBtn.textContent = "Delete";
          deleteBtn.addEventListener("click", () => remove(obs.id));

          actions.append(editBtn, deleteBtn);
          li.append(actions);
        }

        return li;
      }),
    );
  }

  function beginEdit(obs, li) {
    const textEl = li.querySelector(".observation-text");
    const form = document.createElement("form");
    form.className = "observation-edit-form";

    const input = document.createElement("textarea");
    input.value = obs.text;
    input.maxLength = MAX_LENGTH;

    const save = document.createElement("button");
    save.type = "submit";
    save.textContent = "Save";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => render());

    form.append(input, save, cancel);
    textEl.replaceWith(form);
    input.focus();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      await fetch(`/api/objects/${encodeURIComponent(currentObjectId)}/observations/${obs.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    });
  }

  async function remove(id) {
    await fetch(`/api/objects/${encodeURIComponent(currentObjectId)}/observations/${id}`, {
      method: "DELETE",
    });
  }

  async function open(objectId) {
    currentObjectId = objectId;
    textareaEl.value = "";
    updateCharCount();
    const res = await fetch(`/api/objects/${encodeURIComponent(objectId)}/observations`);
    const body = await res.json();
    observations = body.observations ?? [];
    render();
  }

  function updateCharCount() {
    if (charCountEl) charCountEl.textContent = `${textareaEl.value.length}/${MAX_LENGTH}`;
  }

  textareaEl.addEventListener("input", updateCharCount);

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = textareaEl.value.trim();
    if (!text || !currentObjectId) return;
    const res = await fetch(`/api/objects/${encodeURIComponent(currentObjectId)}/observations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      textareaEl.value = "";
      updateCharCount();
    }
  });

  // Every connected browser receives every observation event regardless of
  // which panel (if any) it has open. Added/edited events carry objectId on
  // the nested observation; deleted events carry it at the top level — this
  // reads it from wherever the event actually puts it, and ignores events
  // for objects other than the one currently showing.
  function handleStreamEvent(type, data) {
    const eventObjectId = data.observation?.objectId ?? data.objectId;
    if (!currentObjectId || eventObjectId !== currentObjectId) return;
    if (type === "observation-added") {
      observations.push(data.observation);
      render();
    } else if (type === "observation-edited") {
      const index = observations.findIndex((o) => o.id === data.observation.id);
      if (index !== -1) observations[index] = data.observation;
      render();
    } else if (type === "observation-deleted") {
      observations = observations.filter((o) => o.id !== data.id);
      render();
    }
  }

  return { open, handleStreamEvent };
}
