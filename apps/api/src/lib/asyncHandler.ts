// Express 4 doesn't catch errors thrown (or rejected) inside an async route
// handler: without a try/catch that calls next(err), a failed database call
// becomes an unhandled rejection and takes the whole process down. This
// wrapper sends any rejection to the error handler (a clean 500) instead.

import type { NextFunction, Request, RequestHandler, Response } from "express";

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
