export type LeadAccessErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND";

/**
 * Lỗi truy cập Lead. Lớp API (route/controller) nên ánh xạ:
 *  UNAUTHENTICATED -> 401, FORBIDDEN -> 403, NOT_FOUND -> 404.
 */
export class LeadAccessError extends Error {
  readonly code: LeadAccessErrorCode;

  constructor(code: LeadAccessErrorCode, message: string) {
    super(message);
    this.name = "LeadAccessError";
    this.code = code;
  }
}
