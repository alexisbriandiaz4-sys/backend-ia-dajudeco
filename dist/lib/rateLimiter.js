"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = __importDefault(require("./logger"));
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limitar cada IP a 100 peticiones por ventana de tiempo
    message: {
        success: false,
        error: 'Demasiadas peticiones desde esta IP, por favor intente de nuevo más tarde.'
    },
    standardHeaders: true, // Retorna rate limit info en los headers `RateLimit-*`
    legacyHeaders: false, // Desactiva los headers `X-RateLimit-*`
    handler: (req, res, next, options) => {
        logger_1.default.warn(`Rate limit excedido para IP: ${req.ip}`);
        res.status(options.statusCode).send(options.message);
    }
});
