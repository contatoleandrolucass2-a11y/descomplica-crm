export function workspaceDocument(): Document | ShadowRoot {
  return document.querySelector("[data-lead-plus-host]")?.shadowRoot ?? document;
}
