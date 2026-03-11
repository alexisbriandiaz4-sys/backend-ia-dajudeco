// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

export async function extraerTextoPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer)
    const texto = data.text.trim()
    if (!texto) return '[PDF sin texto extraíble — puede ser una imagen escaneada]'
    // Limitar a 8000 caracteres para no saturar la IA
    return texto.length > 8000 ? texto.substring(0, 8000) + '...[truncado]' : texto
  } catch (error) {
    return `[Error al procesar PDF: ${error instanceof Error ? error.message : 'desconocido'}]`
  }
}