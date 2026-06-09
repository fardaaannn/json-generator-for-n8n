// Theme bootstrap — applied before first paint to avoid a flash of the wrong
// theme. Kept as a separate same-origin file (instead of an inline script) so
// the Content-Security-Policy can use a strict `script-src 'self'` without
// needing an inline-script hash that would break on every minify/version change.
(function () {
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
