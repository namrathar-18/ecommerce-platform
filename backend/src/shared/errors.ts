export class AppError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = "APP_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const BadRequest = (m: string) => new AppError(400, m, "BAD_REQUEST");
export const Unauthorized = (m = "Unauthorized") => new AppError(401, m, "UNAUTHORIZED");
export const Forbidden = (m = "Forbidden") => new AppError(403, m, "FORBIDDEN");
export const NotFound = (m = "Not found") => new AppError(404, m, "NOT_FOUND");
export const Conflict = (m: string) => new AppError(409, m, "CONFLICT");
