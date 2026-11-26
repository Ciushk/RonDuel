import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { townErrorKey } from '../components/rontown/townErrors';

describe('RonTown i18n coverage and error mapping', () => {
  it('passes scripts/check-town-i18n.mjs across all 26 locales with zero untranslated town.* keys', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const scriptPath = path.join(repoRoot, 'scripts/check-town-i18n.mjs');
    const out = execFileSync(process.execPath, [scriptPath], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    expect(out).toContain('All 26 locales passed RonTown i18n verification');
  });

  it('maps server error codes/messages to localized town.errors.* keys without changing server strings', () => {
    expect(townErrorKey('INSUFFICIENT_FUNDS: Required 8 coins')).toBe(
      'town.errors.insufficientFunds',
    );
    expect(townErrorKey('PRICE_CHANGED: Current speed-up cost is 12')).toBe(
      'town.errors.priceChanged',
    );
    expect(townErrorKey('NOT_ROTATABLE: Ground tile cannot be rotated')).toBe(
      'town.errors.notRotatable',
    );
    expect(townErrorKey("RonTown feature 'speedupEnabled' is currently disabled")).toBe(
      'town.errors.disabled',
    );
    expect(townErrorKey('WALLET_LOCKED: Wallet is locked')).toBe('town.errors.walletLocked');
    expect(townErrorKey('TOWN_NOT_FOUND: Town not initialized')).toBe('town.errors.townNotFound');
    expect(townErrorKey('PLOT_NOT_FOUND: Missing plot')).toBe('town.errors.plotNotFound');
    expect(townErrorKey('Crop is not ready yet')).toBe('town.errors.notReady');
    expect(townErrorKey('Daily cap exceeded')).toBe('town.errors.dailyCap');
    expect(townErrorKey('Already completed')).toBe('town.errors.alreadyUsed');
    expect(townErrorKey('Some unknown error')).toBeNull();
    expect(townErrorKey(undefined)).toBeNull();
  });
});
