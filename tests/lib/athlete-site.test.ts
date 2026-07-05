import { describe, it, expect } from 'vitest';
import { loadAthleteSite } from '../../src/lib/athlete-site';

describe('loadAthleteSite', () => {
  it('assembles player + ordered panels for a configured athlete', async () => {
    const site = await loadAthleteSite('tyler-baleno');
    expect(site).not.toBeNull();
    expect(site!.player.first).toBe('Tyler');
    expect(site!.panels[0]?.key).toBe('hero');
    expect(site!.panels.length).toBeGreaterThan(1);
  });

  it('returns null for an unknown slug (route turns it into a 404)', async () => {
    expect(await loadAthleteSite('nobody-here')).toBeNull();
  });
});
