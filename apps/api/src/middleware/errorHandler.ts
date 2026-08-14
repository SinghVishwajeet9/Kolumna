// Express recognizes this as ERROR-HANDLING middleware specifically because
// it takes FOUR parameters (err, req, res, next) instead of three. That's
// not a style choice — Express inspects the function's arity (arg count) to
// decide whether a middleware is a normal one or an error handler. Get this
// wrong (e.g. drop an unused `_next` param to "clean it up") and Express
// silently stops treating it as an error handler at all.
//
// This must be registered LAST, after every route, in index.ts — Express
// error handlers only catch errors from things registered before them.

import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Anything else is unexpected — a real bug, a DB hiccup, whatever.
  // Log the real error server-side for debugging, but never leak internal
  // details (stack traces, raw DB error messages) to the client — that's
  // an information-disclosure risk, not just an ugly response.
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
