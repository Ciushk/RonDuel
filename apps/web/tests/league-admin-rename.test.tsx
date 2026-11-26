// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enMessages from '../messages/en.json';

const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();
const mockRouter = { push: mockRouterPush, replace: mockRouterReplace };

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace?: string) => {
    const base = namespace
      ? (enMessages as Record<string, unknown>)[namespace]
      : (enMessages as Record<string, unknown>);
    return (key: string, values?: Record<string, string | number>) => {
      const parts = key.split('.');
      let cur: unknown = base;
      for (const p of parts) {
        cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[p] : undefined;
      }
      let out = typeof cur === 'string' ? cur : key;
      if (values) {
        for (const [k, v] of Object.entries(values)) {
          out = out.replaceAll(`{${k}}`, String(v));
        }
      }
      return out;
    };
  },
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'lg_123' }),
  useRouter: () => mockRouter,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  getLocalSession: () => ({ uid: 'u_owner', nickname: 'Andrei' }),
  getBrowserTimeZone: () => 'UTC',
}));

import LeagueAdminPage from '@/app/[locale]/league/[id]/admin/page';
import { resolveLeagueDisplayName } from '@/lib/league-name';

describe('resolveLeagueDisplayName', () => {
  it('returns trimmed name, falls back to title/leagueName, and never returns literal "undefined"', () => {
    expect(resolveLeagueDisplayName({ name: '  Coffee Squad  ' })).toBe('Coffee Squad');
    expect(resolveLeagueDisplayName({ name: 'undefined', title: 'Legacy Crew' })).toBe(
      'Legacy Crew',
    );
    expect(resolveLeagueDisplayName({ name: 'UNDEFINED' })).toBe('');
    expect(resolveLeagueDisplayName({ name: undefined, leagueName: 'Old Name' })).toBe('Old Name');
    expect(resolveLeagueDisplayName({ name: null })).toBe('');
    expect(resolveLeagueDisplayName(null)).toBe('');
  });
});

describe('LeagueAdminPage rename & safe league name', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  it('never renders literal "undefined" in header or rename input when stored name is corrupt', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/leagues/')) {
        return {
          ok: true,
          json: async () => ({
            id: 'lg_123',
            name: 'undefined',
            inviteCode: 'ABCD12',
            ownerUid: 'u_owner',
            adminName: 'Andrei',
            memberCount: 2,
            maxMembers: 200,
            isOwner: true,
            privateApproval: false,
            allTime: [
              {
                uid: 'u_owner',
                nickname: 'Andrei',
                joinedAt: '2026-11-01T10:00:00Z',
                allTimeScore: 900,
                roundsPlayed: 3,
              },
            ],
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ isPro: true }) } as Response;
    }) as unknown as typeof fetch;

    render(<LeagueAdminPage />);

    const input = (await screen.findByTestId('admin-rename-input')) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.getByTestId('admin-league-name').textContent).toBe('');
    // Zero raw league.* keys rendered
    expect(document.body.textContent).not.toMatch(/\bleague\.[a-zA-Z]+/);
    expect(document.body.textContent).not.toContain('undefined');
  });

  it('rejects literal "undefined" rename with error toast, surfaces LEAGUE_NAME_TAKEN, and updates on valid save', async () => {
    let serverName = 'Trivia Legends';

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/leagues/') && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body));
        if (body.name === 'Taken Name') {
          return {
            ok: false,
            status: 400,
            json: async () => ({
              code: 'LEAGUE_NAME_TAKEN',
              error: 'League name is already taken',
            }),
          } as Response;
        }
        serverName = body.name;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, name: serverName }),
        } as Response;
      }
      if (url.includes('/api/leagues/')) {
        return {
          ok: true,
          json: async () => ({
            id: 'lg_123',
            name: serverName,
            inviteCode: 'ABCD12',
            ownerUid: 'u_owner',
            adminName: 'Andrei',
            memberCount: 2,
            maxMembers: 5,
            isOwner: true,
            privateApproval: false,
            allTime: [
              {
                uid: 'u_owner',
                nickname: 'Andrei',
                joinedAt: '2026-11-01T10:00:00Z',
                allTimeScore: 900,
                roundsPlayed: 3,
              },
            ],
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ isPro: false }) } as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<LeagueAdminPage />);

    const input = (await screen.findByTestId('admin-rename-input')) as HTMLInputElement;
    expect(input.value).toBe('Trivia Legends');
    expect(screen.getByTestId('admin-league-name').textContent).toBe('Trivia Legends');

    // 1. Reject literal "undefined"
    fireEvent.change(input, { target: { value: 'undefined' } });
    fireEvent.submit(input.closest('form')!);
    expect(screen.getByTestId('admin-toast').textContent).toContain(
      'League name must be between 2 and 30 characters.',
    );
    expect(screen.getByTestId('admin-league-name').textContent).toBe('Trivia Legends');

    // 2. Surface LEAGUE_NAME_TAKEN from API
    fireEvent.change(input, { target: { value: 'Taken Name' } });
    await act(async () => {
      fireEvent.submit(input.closest('form')!);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByTestId('admin-toast').textContent).toContain(
        'This league name is already taken.',
      );
    });
    expect(screen.getByTestId('admin-league-name').textContent).toBe('Trivia Legends');

    // 3. Valid rename updates header and shows success toast
    fireEvent.change(input, { target: { value: 'Morning Champions' } });
    await act(async () => {
      fireEvent.submit(input.closest('form')!);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByTestId('admin-league-name').textContent).toBe('Morning Champions');
      expect(screen.getByTestId('admin-toast').textContent).toContain('League name updated!');
    });
  });
});
