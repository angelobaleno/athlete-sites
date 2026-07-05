import { useState } from 'preact/hooks';
import { moveOffer } from '../../lib/offers-admin';
import type { Offer, School } from '../../lib/types';
import './OffersEditor.css';

type Status = { kind: 'idle' | 'saved' } | { kind: 'error'; msg: string };

// Display label helpers — offers arrive resolved (schoolId offers carry school/level/etc).
const label = (o: Offer) => o.school ?? '(unnamed school)';
const sub = (o: Offer) => [o.level, o.location].filter(Boolean).join(' · ');

export default function OffersEditor({ offers: initial }: { offers: Offer[] }) {
  const [offers, setOffers] = useState<Offer[]>(initial);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<School[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ school: '', short: '', level: '', location: '' });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  function dirty() { setStatus({ kind: 'idle' }); }

  async function onSearch(q: string) {
    setQuery(q); dirty();
    if (q.trim() === '') { setResults([]); return; }
    const res = await fetch(`/api/schools?q=${encodeURIComponent(q)}`).catch(() => null);
    if (res && res.ok) { const d = await res.json(); setResults(d.schools ?? []); }
  }

  function addSchool(s: School) {
    setOffers((prev) => [...prev, {
      schoolId: s.id, school: s.name, short: s.short,
      level: s.level, location: s.location ?? '', logoUrl: s.logoUrl ?? undefined,
    }]);
    setQuery(''); setResults([]); dirty();
  }

  function addManual() {
    if (manual.school.trim() === '') return;
    setOffers((prev) => [...prev, { ...manual }]);
    setManual({ school: '', short: '', level: '', location: '' });
    setShowManual(false); dirty();
  }

  function remove(i: number) { setOffers((prev) => prev.filter((_, idx) => idx !== i)); dirty(); }
  function move(i: number, dir: 'up' | 'down') { setOffers((prev) => moveOffer(prev, i, dir)); dirty(); }

  async function save(e: Event) {
    e.preventDefault();
    setBusy(true); setStatus({ kind: 'idle' });
    const res = await fetch('/api/profile/offers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offers }),
    }).catch(() => null);
    setBusy(false);
    if (res && res.ok) { setStatus({ kind: 'saved' }); return; }
    const d = res ? await res.json().catch(() => ({})) : {};
    setStatus({ kind: 'error', msg: (d as any).error ?? 'Save failed' });
  }

  return (
    <form class="offers-editor" onSubmit={save}>
      <div class="oe__head">
        <h2 class="oe__title">Offers</h2>
        <button class="oe__save" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>

      <ul class="oe__list">
        {offers.map((o, i) => (
          <li class="oe__row" key={`${o.schoolId ?? o.school}-${i}`}>
            <div class="oe__info">
              <span class="oe__school">{label(o)}</span>
              <span class="oe__sub">{sub(o)}</span>
            </div>
            <div class="oe__ctrls">
              <button type="button" class="oe__btn" title="Move up" disabled={i === 0}
                onClick={() => move(i, 'up')}>↑</button>
              <button type="button" class="oe__btn" title="Move down" disabled={i === offers.length - 1}
                onClick={() => move(i, 'down')}>↓</button>
              <button type="button" class="oe__btn oe__btn--rm" title="Remove"
                onClick={() => remove(i)}>✕</button>
            </div>
          </li>
        ))}
        {offers.length === 0 && <li class="oe__empty">No offers yet.</li>}
      </ul>

      <div class="oe__add">
        <label class="oe__label">Add a school
          <input class="oe__input" type="text" value={query} placeholder="Search schools…"
            onInput={(e) => onSearch((e.target as HTMLInputElement).value)} />
        </label>
        {results.length > 0 && (
          <ul class="oe__results">
            {results.map((s) => (
              <li key={s.id}>
                <button type="button" class="oe__result" onClick={() => addSchool(s)}>
                  <span>{s.name}</span><span class="oe__result-sub">{s.level}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" class="oe__manual-toggle" onClick={() => setShowManual((v) => !v)}>
          {showManual ? 'Cancel manual entry' : 'School not listed?'}
        </button>
        {showManual && (
          <div class="oe__manual">
            <input class="oe__input" placeholder="School name" value={manual.school}
              onInput={(e) => setManual({ ...manual, school: (e.target as HTMLInputElement).value })} />
            <input class="oe__input" placeholder="Monogram (e.g. SP)" value={manual.short}
              onInput={(e) => setManual({ ...manual, short: (e.target as HTMLInputElement).value })} />
            <input class="oe__input" placeholder="Level (e.g. D2)" value={manual.level}
              onInput={(e) => setManual({ ...manual, level: (e.target as HTMLInputElement).value })} />
            <input class="oe__input" placeholder="Location" value={manual.location}
              onInput={(e) => setManual({ ...manual, location: (e.target as HTMLInputElement).value })} />
            <button type="button" class="oe__add-manual" onClick={addManual}>Add</button>
          </div>
        )}
      </div>

      <p class={`oe__status oe__status--${status.kind}`} role="status">
        {status.kind === 'saved' ? 'Saved.' : status.kind === 'error' ? status.msg : ' '}
      </p>
    </form>
  );
}
