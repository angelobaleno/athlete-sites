import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

// Load .env.local into process.env before tests run so the Supabase client
// factory can resolve keys under Node.
config({ path: '.env.local' });

export default defineConfig({
  test: { environment: 'node' },
});
