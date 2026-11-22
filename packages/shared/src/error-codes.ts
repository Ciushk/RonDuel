export type ApiErrorCode =
  | 'PLAY_NOT_FOUND'
  | 'PLAY_ALREADY_FINISHED'
  | 'ITEM_NOT_SERVED'
  | 'ITEM_ALREADY_ANSWERED'
  | 'LEAGUE_NOT_FOUND'
  | 'LEAGUE_FULL'
  | 'LEAGUE_LIMIT_REACHED'
  | 'LEAGUE_NAME_TAKEN'
  | 'LEAGUE_NAME_INVALID'
  | 'LEAGUE_OWNER_ONLY'
  | 'LEAGUE_PRO_FEATURE'
  | 'CODE_INVALID'
  | 'NICKNAME_INVALID'
  | 'NICKNAME_TAKEN'
  | 'NICKNAME_CHANGE_COOLDOWN'
  | 'DUEL_NOT_FOUND'
  | 'DUEL_FULL'
  | 'DUEL_INACTIVE'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  public code: ApiErrorCode;
  public status: number;
  public details?: Record<string, unknown>;

  constructor(
    code: ApiErrorCode,
    message: string,
    status = 400,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
