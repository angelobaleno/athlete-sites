import { defineConfig } from 'astro/config';

// Deployed to GitHub Pages as a project site (served under /tyler-baleno-site/),
// same setup as Brian's and Webb's sites. If Tyler ever gets his own domain,
// set `site` to that domain and drop `base`.
export default defineConfig({
  site: 'https://angelobaleno.github.io',
  base: '/tyler-baleno-site',
});
