import type { APIRoute } from 'astro';
import { searchSchools } from '../../lib/schools';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response(JSON.stringify({ error: 'Not signed in' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }
  const q = context.url.searchParams.get('q') ?? '';
  const schools = await searchSchools(q);
  return new Response(JSON.stringify({ schools }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
