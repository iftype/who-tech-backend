import { describe, expect, it } from '@jest/globals';
import { computeDominantTrack } from '../../shared/member-track.js';

const sub = (track: string | null, status = 'merged') => ({ status, missionRepo: { track } });

describe('computeDominantTrack', () => {
  it('should return null without any tracked submission', () => {
    expect(computeDominantTrack([])).toBeNull();
    expect(computeDominantTrack([sub(null), sub(null)])).toBeNull();
  });

  it('should pick the most frequent track regardless of order', () => {
    expect(
      computeDominantTrack([sub('android'), sub('backend'), sub('frontend'), sub('backend'), sub('backend')]),
    ).toBe('backend');
    expect(
      computeDominantTrack([sub('frontend'), sub('frontend'), sub('android'), sub('android'), sub('android')]),
    ).toBe('android');
  });

  it('should ignore closed submissions', () => {
    expect(
      computeDominantTrack([
        sub('frontend', 'closed'),
        sub('frontend', 'closed'),
        sub('frontend', 'closed'),
        sub('backend'),
      ]),
    ).toBe('backend');
  });
});
