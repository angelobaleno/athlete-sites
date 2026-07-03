import { defineMiddleware } from 'astro:middleware';
import { createServerSupabase } from './lib/supabase-server';
import { redirectTarget } from './lib/auth-guard';

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createServerSupabase(context);
  // getUser() validates the token with Supabase (safe for auth decisions).
  let user = null;
  try {
    ({ data: { user } } = await supabase.auth.getUser());
  } catch {
    user = null;
  }

  context.locals.supabase = supabase;
  context.locals.user = user;

  const target = redirectTarget(context.url.pathname, user !== null);
  if (target) return context.redirect(target);

  return next();
});
