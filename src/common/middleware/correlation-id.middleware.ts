import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = (req.headers['x-request-id'] as string) || uuidv4();
    req.headers['x-request-id'] = correlationId;
    res.setHeader('x-request-id', correlationId);
    next();
  }
}
