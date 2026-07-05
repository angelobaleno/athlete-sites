import { describe, it, expect } from 'vitest';
import {
  SECTIONS, getPath, setPath, resolveFields, sectionFieldViews,
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
