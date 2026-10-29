import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

/**
 * Errors carry a stable machine code; clients translate codes into ru/ky text.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code);
  }
}

export const notFound = (what: string) => new AppError(`${what}_not_found`, 404);
export const forbidden = () => new AppError('forbidden', 403);

export function errorHandler(
  error: FastifyError | AppError | ZodError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    return reply
      .status(error.status)
      .send({ error: { code: error.code, message: error.message, details: error.details } });
  }
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: { code: 'validation_error', message: 'Invalid request', details: error.flatten() },
    });
  }
  const status = (error as FastifyError).statusCode ?? 500;
  if (status >= 500) request.log.error(error);
  return reply.status(status).send({
    error: {
      code: status >= 500 ? 'internal_error' : ((error as FastifyError).code ?? 'bad_request'),
      message: status >= 500 ? 'Internal server error' : error.message,
    },
  });
}
