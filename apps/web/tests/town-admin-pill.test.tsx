// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TOWN_CATALOG } from '@ronduel/shared';
import { BuyLandSheet } from '@/components/rontown/BuyLandSheet';
import { SpeedupConfirmSheet } from '@/components/rontown/SpeedupConfirmSheet';
import roMessages from '../messages/ro.json';

vi.mock('next-intl', () => ({
  useTranslations: () => {
    return (key: string, values?: Record<string, string | number>) => {
      const parts = key.split('.');
      let cur: unknown = roMessages;
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

describe('RonTown admin ∞ coin pill and affordability', () => {
  afterEach(() => {
    cleanup();
  });

  it('BuyLandSheet renders ∞ + RonCoins nelimitate aria-label and enables purchase when isAdmin with 0 balance', () => {
    render(
      <BuyLandSheet
        targetCell={{ x: 2, y: 3 }}
        walletBalance={0}
        isAdmin={true}
        purchasing={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const pill = screen.getByLabelText('RonCoins nelimitate');
    expect(pill).not.toBeNull();
    expect(pill.textContent).toContain('∞');

    // Confirm button is enabled despite walletBalance=0 while price remains visible
    const confirmBtn = screen.getByRole('button', { name: /Cumpără/i }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
  });

  it('BuyLandSheet renders numeric walletBalance and disables purchase when non-admin has 0 balance', () => {
    render(
      <BuyLandSheet
        targetCell={{ x: 2, y: 3 }}
        walletBalance={0}
        isAdmin={false}
        purchasing={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const pill = screen.getByLabelText('0 RonCoins');
    expect(pill).not.toBeNull();
    expect(pill.textContent).toContain('0');

    const confirmBtn = screen.getByRole('button', { name: /Cumpără/i }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });

  it('SpeedupConfirmSheet allows admin speed-up with 0 balance while displaying real cost', () => {
    const now = Date.now();
    render(
      <SpeedupConfirmSheet
        tile={{
          x: 3,
          y: 4,
          itemId: 'plot',
          cropId: 'wheat',
          plantedAt: new Date(now - 60_000).toISOString(),
          readyAt: new Date(now + 3_600_000).toISOString(),
        }}
        catalog={DEFAULT_TOWN_CATALOG}
        walletBalance={0}
        isAdmin={true}
        loading={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('RonCoins nelimitate')).not.toBeNull();
    const confirmBtn = screen.getByTestId('speedup-confirm-btn') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
  });
});
