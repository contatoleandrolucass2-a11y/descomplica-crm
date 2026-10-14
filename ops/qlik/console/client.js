import RFB from "/novnc/core/rfb.js";

const screen = document.querySelector("#screen");
const status = document.querySelector("#status");
const connect = document.querySelector("#connect");
const disconnect = document.querySelector("#disconnect");
let client;
connect.addEventListener("click", () => {
  connect.disabled = true;
  status.textContent = "Conectando";
  client = new RFB(screen, `ws://${location.host}/socket`);
  client.scaleViewport = true;
  client.resizeSession = false;
  client.addEventListener("connect", () => {
    status.textContent = "Conectado";
    disconnect.disabled = false;
  });
  client.addEventListener("disconnect", () => {
    status.textContent = "Desconectado";
    connect.disabled = false;
    disconnect.disabled = true;
    client = undefined;
  });
});
disconnect.addEventListener("click", () => client?.disconnect());
window.addEventListener("pagehide", () => client?.disconnect());
