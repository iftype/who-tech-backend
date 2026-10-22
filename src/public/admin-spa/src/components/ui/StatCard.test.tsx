import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatCard, StatGrid, statBadgeVariants } from './StatCard';

const set = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

describe('StatCard', () => {
  it('should render label, value, aside badge and hint', () => {
    render(
      <StatGrid columns={3}>
        <StatCard
          label="GitHub API"
          value="4990/5000"
          aside={<span className={statBadgeVariants({ tone: 'success' })}>정상</span>}
          hint="reset 12:00"
        />
      </StatGrid>,
    );
    expect(screen.getByText('GitHub API')).toBeInTheDocument();
    expect(screen.getByText('4990/5000')).toBeInTheDocument();
    expect(screen.getByText('정상')).toBeInTheDocument();
    expect(screen.getByText('reset 12:00')).toBeInTheDocument();
  });

  it('should keep the small status badge classes the cards and header used', () => {
    expect(set(statBadgeVariants({ tone: 'danger' }))).toEqual(
      set('text-2xs px-1.5 py-0.5 rounded font-medium bg-danger-100 text-danger-700'),
    );
    expect(set(statBadgeVariants())).toEqual(
      set('text-2xs px-1.5 py-0.5 rounded font-medium bg-base-100 text-base-500'),
    );
  });
});
