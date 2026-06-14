import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Single source of truth for error → HTTP mapping.
 * Always returns an RFC-7807 problem document. Unknown errors → 500, logged with stack.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail: string | undefined;
    let errors: Record<string, string[]> | undefined;
    let type = 'about:blank';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        title = payload;
      } else if (typeof payload === 'object' && payload) {
        const p = payload as { message?: unknown; error?: string; errors?: unknown };
        title = p.error ?? exception.name;
        if (Array.isArray(p.message)) {
          errors = collectValidationErrors(p.message as string[]);
          detail = 'Validation failed';
        } else if (typeof p.message === 'string') {
          detail = p.message;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ status, title, detail, type } = mapPrismaError(exception));
    } else if (exception instanceof Error) {
      detail = exception.message;
      this.logger.error(`Unhandled ${exception.name}: ${exception.message}`, exception.stack);
    } else {
      this.logger.error('Unknown exception', JSON.stringify(exception));
    }

    res.status(status).json({
      type,
      title,
      status,
      ...(detail && { detail }),
      ...(errors && { errors }),
      instance: req.originalUrl,
    });
  }
}

function collectValidationErrors(messages: string[]): Record<string, string[]> {
  // class-validator emits "field must be ..." — group by leading word.
  const out: Record<string, string[]> = {};
  for (const m of messages) {
    const field = m.split(' ')[0] ?? '_';
    out[field] ??= [];
    out[field].push(m);
  }
  return out;
}

function mapPrismaError(e: Prisma.PrismaClientKnownRequestError) {
  switch (e.code) {
    case 'P2002':
      return {
        status: HttpStatus.CONFLICT,
        title: 'Conflict',
        detail: `Unique constraint violated on ${(e.meta?.target as string[] | undefined)?.join(', ') ?? 'unknown field'}`,
        type: 'https://harmony.example/errors/unique-constraint',
      };
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        title: 'Not Found',
        detail: 'Record does not exist',
        type: 'about:blank',
      };
    case 'P2003':
      return {
        status: HttpStatus.BAD_REQUEST,
        title: 'Foreign key violation',
        detail: 'Referenced record does not exist',
        type: 'about:blank',
      };
    default:
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        title: 'Database error',
        detail: e.code,
        type: 'about:blank',
      };
  }
}
