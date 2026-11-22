// Shareable state in the URL hash, e.g. #view=map&layer=NDV_MD3&time=2020&z=8&ll=52.1,5.1

export function readHash() {
  return Object.fromEntries(new URLSearchParams(window.location.hash.replace(/^#/, "")));
}

/** Replace the hash without adding history entries or firing hashchange. */
export function writeHash(state) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value != null && value !== "") params.set(key, value);
  }
  const hash = params.toString() ? `#${params}` : "";
  if (hash !== window.location.hash) {
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    window.history.replaceState(null, "", url);
  }
}
