// Custom error classes. Instead of every route handler manually calling
// res.status(...).json({ error: ... }), route/middleware code can just
// `throw new NotFoundError("Board not found")` and the centralized error
// handler (middleware/errorHandler.ts) turns it into the right HTTP response.
// This is what keeps status-code decisions consistent across the whole app
// instead of re-decided ad hoc in every handler.

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request") {
    super(message, 400);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}
