import { Request, Response, NextFunction } from 'express';
import logger from './logger';

export const globalErrorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error(`Unhandled Error: ${err.message}`, { stack: err.stack });

  // Prevenir fuga de información sensible en producción
  const isProd = process.env.NODE_ENV === 'production';
  const message = isProd ? 'Ocurrió un error interno en el servidor.' : err.message;

  res.status(500).json({
    success: false,
    error: message,
    ...( !isProd && { stack: err.stack } )
  });
};
