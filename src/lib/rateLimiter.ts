import rateLimit from 'express-rate-limit';
import logger from './logger';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limitar cada IP a 100 peticiones por ventana de tiempo
  message: {
    success: false,
    error: 'Demasiadas peticiones desde esta IP, por favor intente de nuevo más tarde.'
  },
  standardHeaders: true, // Retorna rate limit info en los headers `RateLimit-*`
  legacyHeaders: false, // Desactiva los headers `X-RateLimit-*`
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit excedido para IP: ${req.ip}`);
    res.status(options.statusCode).send(options.message);
  }
});
