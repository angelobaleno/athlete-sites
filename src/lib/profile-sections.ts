export type SectionKey =
  | 'identity' | 'headline' | 'measurables' | 'academics' | 'film' | 'contact';

export interface FieldDef {
  name: string;              // unique within section; also the form key
  path: string;              // dot/index path to the string value within the section object
  label: string;
  kind: 'text' | 'url';
  required?: boolean;
  placeholderPath?: string;  // path to a boolean derived from value emptiness
}

export interface SectionDef {
  key: SectionKey;
  title: string;
  kind: 'object' | 'stats';  // 'object' = static fields below; 'stats' = Stat[] (fields per row)
  fields?: FieldDef[];
}

export const SECTIONS: SectionDef[] = [
  {
    key: 'identity', title: 'Identity', kind: 'object',
    fields: [
      { name: 'first', path: 'first', label: 'First name', kind: 'text', required: true },
      { name: 'last', path: 'last', label: 'Last name', kind: 'text', required: true },
      { name: 'position', path: 'position', label: 'Position', kind: 'text', required: true },
      { name: 'positionShort', path: 'positionShort', label: 'Position (short)', kind: 'text' },
      { name: 'jersey', path: 'jersey', label: 'Jersey #', kind: 'text' },
      { name: 'gradYear', path: 'gradYear', label: 'Grad year', kind: 'text' },
      { name: 'school', path: 'school', label: 'School', kind: 'text' },
      { name: 'team', path: 'team', label: 'Team', kind: 'text' },
      { name: 'location', path: 'location', label: 'Location', kind: 'text' },
    ],
  },
  { key: 'headline', title: 'Stat Rail', kind: 'stats' },
  { key: 'measurables', title: 'Measurables', kind: 'stats' },
  {
    key: 'academics', title: 'Academics', kind: 'object',
    fields: [
      { name: 'gpa', path: 'gpa', label: 'GPA', kind: 'text' },
      { name: 'scale', path: 'scale', label: 'GPA scale', kind: 'text' },
      { name: 'testScore', path: 'testScore.value', label: 'Test score', kind: 'text', placeholderPath: 'testScore.placeholder' },
      { name: 'major', path: 'major.value', label: 'Intended major', kind: 'text', placeholderPath: 'major.placeholder' },
    ],
  },
  {
    key: 'film', title: 'Film', kind: 'object',
    fields: [
      { name: 'title', path: 'title', label: 'Film title', kind: 'text' },
      { name: 'hudlEmbed', path: 'hudlEmbed', label: 'Hudl embed URL', kind: 'url' },
      { name: 'hudlWatch', path: 'hudlWatch', label: 'Hudl watch URL', kind: 'url' },
      { name: 'hudlProfile', path: 'hudlProfile', label: 'Hudl profile URL', kind: 'url' },
    ],
  },
  {
    key: 'contact', title: 'Contact', kind: 'object',
    fields: [
      { name: 'athlete.name', path: 'athlete.name', label: 'Your name', kind: 'text' },
      { name: 'athlete.phone', path: 'athlete.phone', label: 'Phone', kind: 'text' },
      { name: 'athlete.twitter', path: 'athlete.twitter', label: 'X/Twitter handle', kind: 'text' },
      { name: 'athlete.twitterUrl', path: 'athlete.twitterUrl', label: 'X/Twitter URL', kind: 'url' },
      { name: 'coach.name', path: 'coach.name', label: 'Coach name', kind: 'text' },
      { name: 'coach.title', path: 'coach.title', label: 'Coach title', kind: 'text' },
      { name: 'coach.contact', path: 'coach.contact', label: 'Coach contact', kind: 'text', placeholderPath: 'coach.placeholder' },
      { name: 'hudl', path: 'hudl', label: 'Hudl profile link', kind: 'url' },
    ],
  },
];

const segs = (path: string): string[] => path.split('.');

export function getPath(obj: unknown, path: string): string {
  let cur: unknown = obj;
  for (const s of segs(path)) {
    if (cur == null || typeof cur !== 'object') return '';
    cur = (cur as Record<string, unknown>)[s];
  }
  return cur == null ? '' : String(cur);
}

export function setPath<T>(obj: T, path: string, value: unknown): T {
  const clone: unknown = Array.isArray(obj) ? [...(obj as unknown[])] : { ...(obj as object) };
  const parts = segs(path);
  let cur = clone as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const child = cur[key];
    cur[key] = Array.isArray(child) ? [...child] : { ...(child as object) };
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
  return clone as T;
}

export function resolveFields(def: SectionDef, sectionData: unknown): FieldDef[] {
  if (def.kind === 'object') return def.fields ?? [];
  // stats: one field per array row, labelled by the row's label
  const rows = Array.isArray(sectionData) ? (sectionData as { label?: string }[]) : [];
  return rows.map((row, i) => ({
    name: String(i),
    path: `${i}.value`,
    label: row.label ?? `Stat ${i + 1}`,
    kind: 'text' as const,
    placeholderPath: `${i}.placeholder`,
  }));
}

export interface FieldView {
  name: string; label: string; kind: 'text' | 'url'; value: string; required: boolean;
}

export function sectionFieldViews(def: SectionDef, sectionData: unknown): FieldView[] {
  return resolveFields(def, sectionData).map((f) => ({
    name: f.name, label: f.label, kind: f.kind,
    value: getPath(sectionData, f.path), required: !!f.required,
  }));
}

function looksLikeUrl(v: string): boolean {
  return /^https?:\/\/\S+$/i.test(v.trim());
}

export function applySectionValues(
  def: SectionDef,
  sectionData: unknown,
  values: Record<string, string>,
): { data: unknown } | { error: string } {
  const fields = resolveFields(def, sectionData);

  // Validate against provided values (fall back to current value when a key is absent).
  for (const f of fields) {
    const provided = Object.prototype.hasOwnProperty.call(values, f.name);
    const value = provided ? values[f.name] : getPath(sectionData, f.path);
    if (f.required && value.trim() === '') {
      return { error: `${f.label} is required` };
    }
    if (f.kind === 'url' && value.trim() !== '' && !looksLikeUrl(value)) {
      return { error: `${f.label} must be a URL (https://…)` };
    }
  }

  // Write provided values, then derive placeholder flags.
  let data: unknown = sectionData;
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(values, f.name)) {
      data = setPath(data, f.path, values[f.name]);
    }
    if (f.placeholderPath) {
      const v = getPath(data, f.path);
      data = setPath(data, f.placeholderPath, v.trim() === '');
    }
  }
  return { data };
}
