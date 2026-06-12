// Theme bootstrap — applied before first paint to avoid a flash of the wrong
// theme. Kept as a separate same-origin file (instead of an inline script) so
// the Content-Security-Policy can use a strict `script-src 'self'` without
// needing an inline-script hash that would break on every minify/version change.
(function () {
  // Frame-buster: GitHub Pages can't send a `frame-ancestors` CSP header (and
  // the meta-tag CSP can't carry it), so break out of any embedding frame here
  // as a best-effort clickjacking defence. A cross-origin parent that blocks
  // top access just leaves us framed — the same as without this code.
  try {
    if (window.top !== window.self) window.top.location = window.self.location;
  } catch (e) { /* cross-origin parent — cannot navigate it */ }
  try {
    var stored = localStorage.getItem('n8n_gen_theme');
    var theme = (stored === 'light' || stored === 'dark')
      ? stored
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
