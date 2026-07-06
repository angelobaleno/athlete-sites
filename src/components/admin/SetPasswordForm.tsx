import { useState } from 'preact/hooks';
import './LoginForm.css';

export default function SetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, confirm }),
    });
    if (res.ok) {
      window.location.href = '/admin';
      return;
    }
    const data = await res.json().catch(() => ({ error: 'Could not set password' }));
    setError(data.error ?? 'Could not set password');
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} class="login-form">
      <label>New password
        <input type="password" value={password} required minLength={8} autocomplete="new-password"
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)} />
      </label>
      <label>Confirm password
        <input type="password" value={confirm} required minLength={8} autocomplete="new-password"
          onInput={(e) => setConfirm((e.target as HTMLInputElement).value)} />
      </label>
      {error && <p class="login-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Set password'}</button>
    </form>
  );
}
