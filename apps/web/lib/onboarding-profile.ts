/** Nickname getOrCreateUser assigns before the player picks one. */
export function isAutoNickname(nickname: string): boolean {
  return /^Player_[A-Za-z0-9]{2,8}$/.test(nickname.trim());
}

/**
 * Profile fields to copy from the server into the local session.
 * Returns null when the session is already confirmed, or the server has no real nickname
 * and an explicit age confirmation.
 */
export function serverProfileToApply(input: {
  sessionNickname: string;
  sessionAgeConfirmed: boolean;
  serverNickname?: string | null;
  serverAgeConfirmed?: boolean | null;
}): { nickname: string; ageConfirmed16: true } | null {
  if (input.sessionNickname && input.sessionAgeConfirmed) return null;
  const serverNickname = (input.serverNickname ?? '').trim();
  if (!serverNickname || isAutoNickname(serverNickname)) return null;
  if (input.serverAgeConfirmed !== true) return null;
  return {
    nickname: input.sessionNickname || serverNickname,
    ageConfirmed16: true,
  };
}
