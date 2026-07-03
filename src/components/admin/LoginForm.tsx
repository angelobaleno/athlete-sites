import { useState } from 'preact/hooks';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      window.location.href = '/admin';
      return;
    }
    const data = await res.json().catch(() => ({ error: 'Login failed' }));
    setError(data.error ?? 'Login failed');
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} class="login-form">
      <label>Email
        <input type="email" value={email} required
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
      </label>
      <label>Password
        <input type="password" value={password} required
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)} />
      </label>
      {error && <p class="login-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
