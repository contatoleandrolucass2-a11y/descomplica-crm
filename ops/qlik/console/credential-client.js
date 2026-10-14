const form = document.querySelector("#credential-form");
const status = document.querySelector("#credential-status");
const button = document.querySelector("#save-credential");

async function refresh() {
  try {
    const response = await fetch("/credentials/status", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const { saved } = await response.json();
    status.textContent = saved ? "Credencial guardada" : "N\u00e3o cadastrada";
    button.disabled = saved;
    for (const input of form.querySelectorAll("input")) input.disabled = saved;
  } catch {
    status.textContent = "Cofre indispon\u00edvel";
    button.disabled = true;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  status.textContent = "Guardando";
  try {
    const response = await fetch("/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Qlik-Console": "1" },
      body: JSON.stringify({
        username: form.elements.username.value,
        password: form.elements.password.value,
      }),
      cache: "no-store",
    });
    if (!response.ok && response.status !== 409) throw new Error();
    form.reset();
    await refresh();
  } catch {
    form.reset();
    status.textContent = "N\u00e3o foi poss\u00edvel guardar";
    button.disabled = false;
  }
});

window.addEventListener("pagehide", () => form.reset());
void refresh();
