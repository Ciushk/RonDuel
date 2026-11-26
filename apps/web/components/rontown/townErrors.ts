/**
 * Maps known English server error codes/messages to localized `town.errors.*` i18n keys
 * without altering server error strings.
 */
export function townErrorKey(message?: string | null): string | null {
  if (!message) return null;
  const raw = String(message);
  const upper = raw.toUpperCase();
  if (upper.includes('INSUFFICIENT_FUNDS') || upper.includes('NOT ENOUGH')) {
    return 'town.errors.insufficientFunds';
  }
  if (upper.includes('PRICE_CHANGED')) {
    return 'town.errors.priceChanged';
  }
  if (upper.includes('NOT_ROTATABLE')) {
    return 'town.errors.notRotatable';
  }
  if (upper.includes('WALLET_LOCKED')) {
    return 'town.errors.walletLocked';
  }
  if (upper.includes('TOWN_NOT_FOUND') || upper.includes('NOT INITIALIZED')) {
    return 'town.errors.townNotFound';
  }
  if (upper.includes('PLOT_NOT_FOUND') || upper.includes('NO_GROWING_CROP')) {
    return 'town.errors.plotNotFound';
  }
  if (upper.includes('NOT READY') || upper.includes('NOT_YET')) {
    return 'town.errors.notReady';
  }
  if (upper.includes('DISABLED')) {
    return 'town.errors.disabled';
  }
  if (upper.includes('DAILY') || upper.includes('CAP') || upper.includes('LIMIT')) {
    return 'town.errors.dailyCap';
  }
  if (upper.includes('ALREADY')) {
    return 'town.errors.alreadyUsed';
  }
  return null;
}
