import { useEffect, useRef, useState } from 'preact/hooks';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import './PhotoEditor.css';

type Status = { kind: 'idle' | 'saved' } | { kind: 'error'; msg: string };

const MIN_SHORT_EDGE = 800; // mirror of the server rule, checked before upload
const MAX_EDGE = 2400;      // cap export size; heroes never need more

// The media box is a fixed frame (the theme's hero ratio, height-capped) that
// hosts either the current-photo preview or the cropper — entering crop mode
// never shifts the layout.
export default function PhotoEditor(
  { photoUrl: initial, aspectRatio }: { photoUrl: string | null; aspectRatio: number },
) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial);
  const [pickedUrl, setPickedUrl] = useState<string | null>(null); // object URL being cropped
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const imgRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<Cropper | null>(null);

  useEffect(() => {
    if (!pickedUrl || !imgRef.current) return;
    const cropper = new Cropper(imgRef.current, {
      aspectRatio, viewMode: 1, autoCropArea: 1, background: false,
    });
    cropperRef.current = cropper;
    return () => { cropper.destroy(); cropperRef.current = null; };
  }, [pickedUrl, aspectRatio]);

  function onPick(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = ''; // re-picking the same file re-fires
    if (!file) return;
    setStatus({ kind: 'idle' });
    setPickedUrl(URL.createObjectURL(file));
  }

  function cancel() {
    if (pickedUrl) URL.revokeObjectURL(pickedUrl);
    setPickedUrl(null);
    setStatus({ kind: 'idle' });
  }

  async function save() {
    const cropper = cropperRef.current;
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({ maxWidth: MAX_EDGE, maxHeight: MAX_EDGE });
    if (Math.min(canvas.width, canvas.height) < MIN_SHORT_EDGE) {
      setStatus({ kind: 'error', msg: `Crop is too small — keep at least ${MIN_SHORT_EDGE}px on the short side` });
      return;
    }
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
    if (!blob) { setStatus({ kind: 'error', msg: 'Could not read the cropped image' }); return; }

    setBusy(true); setStatus({ kind: 'idle' });
    const form = new FormData();
    form.set('photo', new File([blob], 'hero.jpg', { type: 'image/jpeg' }));
    const res = await fetch('/api/profile/photo', { method: 'POST', body: form }).catch(() => null);
    setBusy(false);
    if (res && res.ok) {
      const d = await res.json().catch(() => ({}));
      setPhotoUrl((d as any).photoUrl ?? photoUrl);
      cancel();
      setStatus({ kind: 'saved' });
      return;
    }
    const d = res ? await res.json().catch(() => ({})) : {};
    setStatus({ kind: 'error', msg: (d as any).error ?? 'Upload failed' });
  }

  return (
    <section class="photo-editor">
      <div class="pe__head">
        <h2 class="pe__title">Hero Photo</h2>
        {pickedUrl ? (
          <div class="pe__actions">
            <button type="button" class="pe__btn pe__btn--ghost" onClick={cancel} disabled={busy}>Cancel</button>
            <button type="button" class="pe__btn" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save photo'}
            </button>
          </div>
        ) : (
          <label class="pe__btn pe__pick">
            Upload new photo
            <input class="pe__file" type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} />
          </label>
        )}
      </div>

      <div class="pe__media" style={`aspect-ratio: ${aspectRatio};`}>
        {pickedUrl ? (
          <img ref={imgRef} class="pe__crop-src" src={pickedUrl} alt="Choose the crop for your hero photo" />
        ) : photoUrl ? (
          <img class="pe__preview" src={photoUrl} alt="Current hero photo" />
        ) : (
          <p class="pe__empty">No photo yet.</p>
        )}
      </div>

      <p class={`pe__status pe__status--${status.kind}`} role="status">
        {status.kind === 'saved' ? 'Saved. Your site shows the new photo within a minute.'
          : status.kind === 'error' ? status.msg : ' '}
      </p>
    </section>
  );
}
