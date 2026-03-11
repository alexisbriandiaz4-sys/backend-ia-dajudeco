import mammoth from 'mammoth'

export async function extraerTextoWord(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    const texto = result.value.trim()
    if (!texto) return '[Documento Word vacío o sin texto]'
    return texto.length > 8000 ? texto.substring(0, 8000) + '...[truncado]' : texto
  } catch (error) {
    return `[Error al procesar Word: ${error instanceof Error ? error.message : 'desconocido'}]`
  }
}