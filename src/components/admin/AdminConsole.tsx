import { useState } from 'preact/hooks';
import type { AthleteAdminRow } from '../../lib/admin-actions';
import './AdminConsole.css';

type ActionResult = { ok?: boolean; error?: string; created?: boolean };

async function post(path: string, body: unknown): Promise<ActionResult> {
  const res = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return res.json().catch(() => ({ error: 'Request failed' }));
}

function Row({ a }: { a: AthleteAdminRow }) {
  const [email, setEmail] = useState(a.ownerEmail ?? '');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(label: string, fn: () => Promise<ActionResult>) {
    setBusy(true); setStatus('');
    const r = await fn();
    setStatus(r.error ? `⚠ ${r.error}` : label);
    setBusy(false);
  }

  return (
    <tr>
      <td><strong>{a.name}</strong><span class="slug">/{a.slug}</span></td>
      <td>
        <input type="email" value={email} placeholder="athlete@email.com" disabled={busy}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
      </td>
      <td class="actions">
        <button type="button" disabled={busy || !email}
          onClick={() => run(a.ownerLinked ? 'Re-invite sent' : 'Invite sent',
            () => post('/api/admin/invite', { slug: a.slug, email }))}>
          {a.ownerLinked ? 'Re-invite' : 'Invite'}
        </button>
        <button type="button" disabled={busy || !a.ownerLinked}
          onClick={() => run('Reset email sent', () => post('/api/admin/reset', { email: a.ownerEmail }))}>
          Send reset
        </button>
        <button type="button" disabled={busy || !a.ownerLinked}
          onClick={() => {
            const pw = `tmp-${Math.random().toString(36).slice(2, 10)}A1`;
            return run(`Temp password: ${pw}`, () => post('/api/admin/set-password', { email: a.ownerEmail, password: pw }));
          }}>
          Set temp password
        </button>
      </td>
      <td><span class="status" role="status">{status}</span></td>
    </tr>
  );
}

export default function AdminConsole({ athletes }: { athletes: AthleteAdminRow[] }) {
  return (
    <table class="admin-console">
      <thead><tr><th>Athlete</th><th>Login email</th><th>Actions</th><th>Status</th></tr></thead>
      <tbody>{athletes.map((a) => <Row key={a.slug} a={a} />)}</tbody>
    </table>
  );
}
