"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.describirImagen = describirImagen;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
async function describirImagen(buffer, mimeType) {
    try {
        const groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY });
        const base64 = buffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;
        const response = await groq.chat.completions.create({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: { url: dataUrl }
                        },
                        {
                            type: 'text',
                            text: `Sos un asistente forense judicial argentino. Describí detalladamente esta imagen en español.
Incluí:
- Qué tipo de documento o imagen es
- Texto visible (si hay)
- Elementos relevantes para una investigación judicial
- Fechas, nombres, números o datos identificatorios visibles
Sé preciso y objetivo.`
                        }
                    ]
                }
            ],
            max_tokens: 1000
        });
        return response.choices[0]?.message?.content ?? '[Sin descripción disponible]';
    }
    catch (error) {
        return `[Error al analizar imagen: ${error instanceof Error ? error.message : 'desconocido'}]`;
    }
}
