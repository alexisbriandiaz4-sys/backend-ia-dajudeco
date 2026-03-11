import { createExtractorFromData } from 'node-unrar-js'
import { extraerTextoPDF } from './pdf'
import { extraerTextoWord } from './word'
import { extraerTextoExcel } from './excel'

interface ArchivoDescomprimido {
  nombre: string
  contenido: string
}

export async function procesarRar(buffer: Buffer): Promise<string> {
  const archivos: ArchivoDescomprimido[] = []

  try {
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
    const extractor = await createExtractorFromData({ data: arrayBuffer })
    const { files } = extractor.extract()

    for (const file of files) {
      // Ignorar directorios
      if (file.fileHeader.flags.directory) continue

      const nombre = file.fileHeader.name

      // Ignorar archivos ocultos y carpetas del sistema
      if (nombre.startsWith('__MACOSX') || nombre.startsWith('.')) continue

      const archivoBuffer = Buffer.from(file.extraction!)

      // Limitar tamaño por archivo dentro del RAR
      if (archivoBuffer.length > 5 * 1024 * 1024) {
        archivos.push({ nombre, contenido: '[Archivo muy grande, omitido]' })
        continue
      }

      const ext = nombre.split('.').pop()?.toLowerCase() ?? ''
      let contenido = ''

      if (ext === 'pdf') {
        contenido = await extraerTextoPDF(archivoBuffer)
      } else if (['doc', 'docx'].includes(ext)) {
        contenido = await extraerTextoWord(archivoBuffer)
      } else if (['xls', 'xlsx'].includes(ext)) {
        contenido = await extraerTextoExcel(archivoBuffer)
      } else if (['txt', 'csv', 'log'].includes(ext)) {
        contenido = archivoBuffer.toString('utf-8').substring(0, 3000)
      } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        contenido = `[Imagen: ${nombre} — se procesará por separado si es necesario]`
      } else {
        contenido = `[Tipo de archivo no procesable: .${ext}]`
      }

      archivos.push({ nombre, contenido })

      // Máximo 10 archivos por RAR
      if (archivos.length >= 10) {
        archivos.push({ nombre: '...', contenido: '[Se omitieron archivos adicionales]' })
        break
      }
    }

    if (archivos.length === 0) return '[RAR vacío o sin archivos procesables]'

    return archivos
      .map(a => `\n--- Archivo: ${a.nombre} ---\n${a.contenido}`)
      .join('\n')

  } catch (error) {
    return `[Error al procesar RAR: ${error instanceof Error ? error.message : 'desconocido'}]`
  }
}