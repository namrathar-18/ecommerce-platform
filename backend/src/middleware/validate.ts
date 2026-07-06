import { Request, Response, NextFunction } from "express";
import { AnyZodObject } from "zod";

// Validates req against a schema of shape { body?, query?, params? }.
// On success, replaces req parts with parsed (typed/coerced) values.
export const validate =
  (schema: AnyZodObject) => (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse({ body: req.body, query: req.query, params: req.params });
    if (parsed.body) req.body = parsed.body;
    if (parsed.query) Object.assign(req.query, parsed.query);
    if (parsed.params) Object.assign(req.params, parsed.params);
    next();
  };
