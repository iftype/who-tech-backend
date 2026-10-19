import type { TecoTalkAdminItem } from '../../lib/types.js';

export function countTecoTalkMatches(tecoTalks: TecoTalkAdminItem[]) {
  return tecoTalks.reduce(
    (acc, talk) => {
      acc[talk.matchStatus] += 1;
      return acc;
    },
    { matched: 0, ambiguous: 0, unmatched: 0 },
  );
}
