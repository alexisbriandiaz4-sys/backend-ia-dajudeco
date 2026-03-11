"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validarApiKey = validarApiKey;
function validarApiKey(req, res, next) {
    console.log('🔐 Headers recibidos:', JSON.stringify(req.headers));
    const apiKey = req.headers['x-api-key'];
    const secretEsperado = process.env.API_SECRET;
    console.log('🔑 apiKey recibida:', apiKey);
    console.log('🔑 secret esperado:', secretEsperado);
    if (!secretEsperado) {
        console.error('API_SECRET no configurado');
        return res.status(500).json({ error: 'Configuración incompleta del servidor' });
    }
    if (!apiKey || apiKey !== secretEsperado) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    next();
}
