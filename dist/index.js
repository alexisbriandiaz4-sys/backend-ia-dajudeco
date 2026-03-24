"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const seguridad_1 = require("./lib/seguridad");
const analizar_1 = __importDefault(require("./routes/analizar"));
const logger_1 = __importDefault(require("./lib/logger"));
const errorHandler_1 = require("./lib/errorHandler");
const rateLimiter_1 = require("./lib/rateLimiter");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middlewares de seguridad y generales
app.use((0, helmet_1.default)()); // Cabeceras de seguridad
app.use((0, cors_1.default)({
    origin: process.env.ALLOWED_ORIGIN || '*',
    methods: ['POST', 'GET'],
}));
app.use(express_1.default.json({ limit: '50mb' }));
// Rate limiting global
app.use(rateLimiter_1.apiLimiter);
app.use(express_1.default.json({ limit: '50mb' }));
// Health check — para verificar que el servidor está vivo
app.get('/health', (_req, res) => {
    res.json({
        ok: true,
        servicio: 'backend-ia-dajudeco',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});
// Rutas protegidas con API key
app.use('/analizar', seguridad_1.validarApiKey, analizar_1.default);
// Manejo de rutas no encontradas
app.use((_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});
// Middleware global de manejo de errores
app.use(errorHandler_1.globalErrorHandler);
app.listen(PORT, () => {
    logger_1.default.info(`✅ Backend IA DAJUDECO corriendo en puerto ${PORT}`);
    logger_1.default.info(`   Health check: http://localhost:${PORT}/health`);
    logger_1.default.info(`   Endpoint: POST http://localhost:${PORT}/analizar`);
    logger_1.default.info(`   ZIP recursivo: activado (Open.buffer)`);
    logger_1.default.info(`   Límite de contenido Groq: 3500 chars`);
});
exports.default = app;
