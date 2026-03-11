"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const seguridad_1 = require("./lib/seguridad");
const analizar_1 = __importDefault(require("./routes/analizar"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middlewares
app.use((0, cors_1.default)({
    origin: process.env.ALLOWED_ORIGIN || '*',
    methods: ['POST', 'GET'],
}));
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
app.listen(PORT, () => {
    console.log(`✅ Backend IA DAJUDECO corriendo en puerto ${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`   Endpoint: POST http://localhost:${PORT}/analizar`);
});
exports.default = app;
