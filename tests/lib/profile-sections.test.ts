import { describe, it, expect } from 'vitest';
import {
  SECTIONS, getPath, setPath, resolveFields, sectionFieldViews, applySectionValues,
} from '../../src/lib/profile-sections';

describe('getPath / setPath', () => {
  it('reads nested and indexed paths, missing → empty string', () => {
    const o = { coach: { contact: 'on request' }, stats: [{ value: '4.4' }] };
    expect(getPath(o, 'coach.contact')).toBe('on request');
    expect(getPath(o, 'stats.0.value')).toBe('4.4');
    expect(getPath(o, 'coach.missing')).toBe('');
  });
  it('setPath returns a new object with the value set, original untouched', () => {
    const o = { coach: { contact: 'x' } };
    const n = setPath(o, 'coach.contact', 'y');
    expect(n).toEqual({ coach: { contact: 'y' } });
    expect(o.coach.contact).toBe('x'); // original unmutated
  });
});

describe('SECTIONS registry', () => {
  it('covers exactly the six in-scope sections', () => {
    expect(SECTIONS.map((s) => s.key)).toEqual(
      ['identity', 'headline', 'measurables', 'academics', 'film', 'contact'],
    );
  });
  it('identity requires first, last, position', () => {
    const identity = SECTIONS.find((s) => s.key === 'identity')!;
    const req = resolveFields(identity, {}).filter((f) => f.required).map((f) => f.name);
    expect(req).toEqual(['first', 'last', 'position']);
  });
});

describe('resolveFields (stats sections)', () => {
  it('derives one field per stat row, labelled by the row', () => {
    const measurables = SECTIONS.find((s) => s.key === 'measurables')!;
    const data = [{ label: 'Shuttle', value: '' }, { label: 'Vertical', value: '38"' }];
    const fields = resolveFields(measurables, data);
    expect(fields.map((f) => f.label)).toEqual(['Shuttle', 'Vertical']);
    expect(fields[0].path).toBe('0.value');
    expect(fields[0].placeholderPath).toBe('0.placeholder');
  });
});

describe('sectionFieldViews', () => {
  it('flattens current values for rendering (nested + placeholder-capable)', () => {
    const academics = SECTIONS.find((s) => s.key === 'academics')!;
    const data = { gpa: '4.0', scale: '4.0',
      testScore: { value: '', placeholder: true }, major: { value: 'Undecided', placeholder: false } };
    const views = sectionFieldViews(academics, data);
    const byName = Object.fromEntries(views.map((v) => [v.name, v.value]));
    expect(byName.gpa).toBe('4.0');
    expect(byName['testScore']).toBe('');
    expect(byName['major']).toBe('Undecided');
  });
});

const S = (k: string) => SECTIONS.find((s) => s.key === k)!;

describe('applySectionValues', () => {
  it('rejects blank required identity fields', () => {
    const data = { first: 'Tyler', last: 'Baleno', position: 'DB',
      positionShort: 'DB', jersey: '3', gradYear: '2027', school: 'Plum', team: 'Plum', location: 'Pittsburgh, PA' };
    const res = applySectionValues(S('identity'), data, { first: '   ' });
    expect('error' in res).toBe(true);
  });

  it('rejects a malformed URL field', () => {
    const data = { title: 't', hudlEmbed: '', hudlWatch: '', hudlProfile: '' };
    const res = applySectionValues(S('film'), data, { hudlWatch: 'not-a-url' });
    expect('error' in res).toBe(true);
  });

  it('accepts a valid URL and empty URL (empty = TBD, allowed)', () => {
    const data = { title: 't', hudlEmbed: '', hudlWatch: '', hudlProfile: '' };
    const res = applySectionValues(S('film'), data, { hudlWatch: 'https://hudl.com/x', hudlProfile: '' });
    expect('error' in res).toBe(false);
  });

  it('derives placeholder=true when a placeholder-capable field is blanked', () => {
    const data = { gpa: '4.0', scale: '4.0',
      testScore: { value: '1300', placeholder: false }, major: { value: 'Undecided', placeholder: false } };
    const res = applySectionValues(S('academics'), data, { testScore: '' }) as { data: any };
    expect(res.data.testScore).toEqual({ value: '', placeholder: true });
    expect(res.data.major).toEqual({ value: 'Undecided', placeholder: false }); // untouched key keeps value
  });

  it('derives placeholder=false when a placeholder-capable field gets a value', () => {
    const data = { athlete: { name: 'T', phone: '', twitter: '', twitterUrl: '' },
      coach: { name: 'M', title: 'HC', contact: '', placeholder: true }, hudl: '' };
    const res = applySectionValues(S('contact'), data, { 'coach.contact': 'coach@plum.org' }) as { data: any };
    expect(res.data.coach.contact).toBe('coach@plum.org');
    expect(res.data.coach.placeholder).toBe(false);
  });

  it('derives placeholder on stat rows from value emptiness', () => {
    const data = [{ label: 'Shuttle', value: '4.2', placeholder: false }, { label: 'Vertical', value: '', placeholder: true }];
    const res = applySectionValues(S('measurables'), data, { '0': '', '1': '38"' }) as { data: any };
    expect(res.data[0]).toEqual({ label: 'Shuttle', value: '', placeholder: true });
    expect(res.data[1]).toEqual({ label: 'Vertical', value: '38"', placeholder: false });
  });
});
