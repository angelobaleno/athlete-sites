import { useState } from 'preact/hooks';
import './LoginForm.css';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: Event) {
    e.preventDefault();
    setBusy(true);
    await fetch('/api/auth/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return <p role="status">If an account exists for that email, a reset link is on its way.</p>;
  }
  return (
    <form onSubmit={onSubmit} class="login-form">
      <label>Email
        <input type="email" value={email} required autocomplete="email"
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
      </label>
      <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
    </form>
  );
}
