"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = void 0;
const logger_1 = __importDefault(require("./logger"));
const globalErrorHandler = (err, _req, res, _next) => {
    logger_1.default.error(`Unhandled Error: ${err.message}`, { stack: err.stack });
    // Prevenir fuga de información sensible en producción
    const isProd = process.env.NODE_ENV === 'production';
    const message = isProd ? 'Ocurrió un error interno en el servidor.' : err.message;
    res.status(500).json({
        success: false,
        error: message,
        ...(!isProd && { stack: err.stack })
    });
};
exports.globalErrorHandler = globalErrorHandler;
