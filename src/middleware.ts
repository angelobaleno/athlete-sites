import { defineMiddleware } from 'astro:middleware';
import { createServerSupabase } from './lib/supabase-server';
import { redirectTarget, needsAuth } from './lib/auth-guard';

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createServerSupabase(context);

  // getUser() validates the token with Supabase (safe for auth decisions) but
  // costs a network round trip — only pay it where a session matters. Public
  // pages stay anonymous and CDN-cacheable.
  let user = null;
  if (needsAuth(context.url.pathname)) {
    try {
      ({ data: { user } } = await supabase.auth.getUser());
    } catch {
      user = null;
    }
  }

  context.locals.supabase = supabase;
  context.locals.user = user;

  const target = redirectTarget(context.url.pathname, user !== null);
  if (target) return context.redirect(target);

  return next();
});
