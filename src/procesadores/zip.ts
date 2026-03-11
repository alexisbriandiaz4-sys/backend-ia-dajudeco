import unzipper from 'unzipper'
import { Readable } from 'stream'
import { extraerTextoPDF } from './pdf'
import { extraerTextoWord } from './word'
import { extraerTextoExcel } from './excel'

interface ArchivoDescomprimido {
  nombre: string
  contenido: string
}

const MAX_ARCHIVOS = 20
const MAX_BYTES_POR_ARCHIVO = 10 * 1024 * 1024 // 10MB
const MAX_BYTES_TOTALES = 50 * 1024 * 1024     // 50MB acumulativos de extracción total para prevenir ZIP Bombs
const MAX_PROFUNDIDAD = 3                      // Máximo de carpetas/zips de anidamiento

async function procesarArchivo(buffer: Buffer, nombre: string): Promise<string> {
  const ext = nombre.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'pdf') {
    return await extraerTextoPDF(buffer)
  } else if (['doc', 'docx'].includes(ext)) {
    return await extraerTextoWord(buffer)
  } else if (['xls', 'xlsx'].includes(ext)) {
    return await extraerTextoExcel(buffer)
  } else if (['txt', 'csv', 'log'].includes(ext)) {
    return buffer.toString('utf-8').substring(0, 3000)
  } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return `[Imagen: ${nombre} — se procesará por separado si es necesario]`
  } else {
    return `[Tipo de archivo no procesable: .${ext}]`
  }
}

async function procesarZipBuffer(
  buffer: Buffer,
  nombreZip: string,
  acumulados: ArchivoDescomprimido[],
  estadoGlobal: { bytesTotales: number, archivosProcesados: number },
  profundidadActual: number = 0
): Promise<void> {
  if (profundidadActual > MAX_PROFUNDIDAD) {
    acumulados.push({ nombre: nombreZip, contenido: '[Profundidad máxima de carpetas/ZIPs alcanzada. Vulnerabilidad ZIP Bomb prevenida.]' })
    return
  }
  try {
    // Usar Open.buffer para soportar tanto el ZIP principal como los anidados
    const zip = await unzipper.Open.buffer(buffer)

    for (const entry of zip.files) {
      const nombre = entry.path

      // Ignorar directorios
      if (entry.type === 'Directory') continue

      // Ignorar archivos del sistema
      if (
        nombre.startsWith('__MACOSX') ||
        nombre.startsWith('.') ||
        nombre.includes('/__MACOSX/') ||
        nombre.includes('/.')
      ) continue

      // Límite total de archivos
      if (estadoGlobal.archivosProcesados >= MAX_ARCHIVOS) break

      // Leer el contenido del entry
      const archivoBuffer: Buffer = await entry.buffer()

      // Límite Acumulativo Total (Defensa activa contra bomba de descompresión geométrica)
      estadoGlobal.bytesTotales += archivoBuffer.length
      if (estadoGlobal.bytesTotales > MAX_BYTES_TOTALES) {
        acumulados.push({ nombre, contenido: `[Límite crítico de seguridad alcanzado (${MAX_BYTES_TOTALES / 1024 / 1024}MB). Extracción abortada para proteger el servidor del colapso.]` })
        break 
      }

      if (archivoBuffer.length > MAX_BYTES_POR_ARCHIVO) {
        acumulados.push({ nombre, contenido: '[Archivo muy grande, omitido]' })
        estadoGlobal.archivosProcesados++
        continue
      }

      const ext = nombre.split('.').pop()?.toLowerCase() ?? ''

      if (ext === 'zip') {
        // ZIP anidado — entrar recursivamente sumando profundidad
        await procesarZipBuffer(archivoBuffer, nombre, acumulados, estadoGlobal, profundidadActual + 1)
        estadoGlobal.archivosProcesados++
        continue
      }

      const contenido = await procesarArchivo(archivoBuffer, nombre)
      acumulados.push({ nombre, contenido })
      estadoGlobal.archivosProcesados++
    }
  } catch (error) {
    acumulados.push({
      nombre: nombreZip,
      contenido: `[Error al procesar ZIP "${nombreZip}": ${error instanceof Error ? error.message : 'desconocido'}]`
    })
  }
}

export async function procesarZip(buffer: Buffer): Promise<string> {
  const acumulados: ArchivoDescomprimido[] = []
  const estadoGlobal = { bytesTotales: 0, archivosProcesados: 0 }
  await procesarZipBuffer(buffer, 'archivo.zip', acumulados, estadoGlobal, 0)

  if (acumulados.length === 0) return '[ZIP vacío o sin archivos procesables]'

  return acumulados
    .map(a => `\n--- Archivo: ${a.nombre} ---\n${a.contenido}`)
    .join('\n')
}