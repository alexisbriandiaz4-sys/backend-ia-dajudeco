"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validarApiKey = validarApiKey;
const logger_1 = __importDefault(require("./logger"));
function validarApiKey(req, res, next) {
    logger_1.default.info(`🔐 Headers recibidos: ${JSON.stringify(req.headers)}`);
    const apiKey = req.headers['x-api-key'];
    const secretEsperado = process.env.API_SECRET;
    logger_1.default.info(`🔑 apiKey recibida: ${apiKey}`);
    logger_1.default.info(`🔑 secret esperado: ${secretEsperado}`);
    if (!secretEsperado) {
        logger_1.default.error('API_SECRET no configurado');
        return res.status(500).json({ error: 'Configuración incompleta del servidor' });
    }
    if (!apiKey || apiKey !== secretEsperado) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    next();
}
