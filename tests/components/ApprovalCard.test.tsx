import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Source-level regression guards for the SFDC approval card. We assert against
// the source text because the project does not have React Testing Library
// wired up; behavioural tests would add a dependency.
const SRC = readFileSync(
  join(__dirname, '..', '..', 'components', 'primitives', 'ApprovalCard.tsx'),
  'utf8',
);

describe('ApprovalCard source-level guards', () => {
  it('renders a stake badge derived from payload.stake', () => {
    expect(SRC).toMatch(/StakeBadge/);
    expect(SRC).toMatch(/payload\.stake/);
  });

  it('Approve button calls onApprove with payload.batchId', () => {
    expect(SRC).toMatch(/onApprove\(payload\.batchId\)/);
  });

  it('disables Approve when a mass-action batch needs a second approver and none entered', () => {
    expect(SRC).toMatch(/needsSecond/);
    expect(SRC).toMatch(/secondId/);
    expect(SRC).toMatch(/canApprove/);
  });

  it('disables Approve while state is submitting', () => {
    expect(SRC).toMatch(/disabled=\{!canApprove \|\| submitting\}/);
    expect(SRC).toMatch(/state === 'submitting'/);
  });

  it('renders a preview table sourced from payload.preview', () => {
    expect(SRC).toMatch(/PreviewTable/);
    expect(SRC).toMatch(/payload\.preview/);
  });
});
