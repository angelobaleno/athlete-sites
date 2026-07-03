import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';

import preact from '@astrojs/preact';

// Server-rendered on Vercel: pages fetch the athlete's data from Supabase at
// request time, so admin edits show up live. (Was static on GitHub Pages.)
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [preact()],
});