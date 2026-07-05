import { useState } from 'preact/hooks';
import type { FieldView } from '../../lib/profile-sections';
import './SectionEditor.css';

type Status = { kind: 'idle' | 'saved' } | { kind: 'error'; msg: string };

export default function SectionEditor(
  { section, title, fields }: { section: string; title: string; fields: FieldView[] },
) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.name, f.value])),
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  function set(name: string, v: string) {
    setValues((prev) => ({ ...prev, [name]: v }));
    setStatus({ kind: 'idle' });
  }

  async function onSubmit(e: Event) {
    e.preventDefault();
    setBusy(true);
    setStatus({ kind: 'idle' });
    const res = await fetch(`/api/profile/${section}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }).catch(() => null);
    setBusy(false);
    if (res && res.ok) { setStatus({ kind: 'saved' }); return; }
    const data = res ? await res.json().catch(() => ({})) : {};
    setStatus({ kind: 'error', msg: (data as any).error ?? 'Save failed' });
  }

  return (
    <form class="section-editor" onSubmit={onSubmit}>
      <div class="se__head">
        <h2 class="se__title">{title}</h2>
        <button class="se__save" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      <div class="se__grid">
        {fields.map((f) => (
          <label class="se__field" key={f.name}>
            <span class="se__label">{f.label}{f.required && <span class="se__req"> *</span>}</span>
            <input
              class="se__input"
              type={f.kind === 'url' ? 'url' : 'text'}
              value={values[f.name] ?? ''}
              onInput={(e) => set(f.name, (e.target as HTMLInputElement).value)}
            />
          </label>
        ))}
      </div>
      <p class={`se__status se__status--${status.kind}`} role="status">
        {status.kind === 'saved' ? 'Saved.' : status.kind === 'error' ? status.msg : ' '}
      </p>
    </form>
  );
}
