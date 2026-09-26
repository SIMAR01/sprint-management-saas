import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

/**
 * Production Correlation ID Middleware.
 * Extracts or generates a unique UUID for every incoming HTTP request,
 * attaches it to `req.correlationId`, and reflects it in the response header `x-correlation-id`.
 */
export const correlationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const incomingHeader = req.headers["x-correlation-id"];
  const correlationId = (Array.isArray(incomingHeader) ? incomingHeader[0] : incomingHeader) || uuidv4();

  req.correlationId = correlationId;
  res.setHeader("x-correlation-id", correlationId);

  next();
};
