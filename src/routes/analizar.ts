import { Router, Request, Response } from 'express'
import fetch from 'node-fetch'
import { extraerTextoPDF } from '../procesadores/pdf'
import { extraerTextoWord } from '../procesadores/word'
import { extraerTextoExcel } from '../procesadores/excel'
import { describirImagen } from '../procesadores/imagen'
import { procesarZip } from '../procesadores/zip'
import { procesarRar } from '../procesadores/rar'
import { analizarConGroq } from '../ia/groq'

const router = Router()

interface BodyAnalizar {
  url: string
  tipo: string
  nombre: string
  legajoId: string
  archivoId: string
}

router.post('/', async (req: Request, res: Response) => {
  const { url, tipo, nombre, legajoId, archivoId } = req.body as BodyAnalizar

  // Validar campos requeridos
  if (!url || !tipo || !nombre || !legajoId || !archivoId) {
    return res.status(400).json({ error: 'Faltan campos requeridos: url, tipo, nombre, legajoId, archivoId' })
  }

  console.log(`[${new Date().toISOString()}] Analizando de forma asíncrona: ${nombre} (legajo: ${legajoId})`)

  // Se retorna inmediatamente el Accepted/202 para que el host originador (como Vercel)
  // no aborte el request por Timeout si esto toma más de 60 segundos.
  res.status(202).json({ ok: true, msg: 'Procesamiento en background iniciado', archivoId, legajoId })

  // Comienza la función auto-ejecutada de Worker desconectado del Socket del cliente HTTP
  ;(async () => {
    try {
      // 1. Descargar el archivo desde Cloudinary
      const respuestaDescarga = await fetch(url)
      if (!respuestaDescarga.ok) {
         console.error(`[ERROR ASYNC] ${nombre}: No se pudo descargar archivo`)
         return
      }
      const arrayBuffer = await respuestaDescarga.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // 2. Extraer contenido según el tipo de archivo
      let contenidoExtraido = ''
      const ext = nombre.split('.').pop()?.toLowerCase() ?? ''

      if (tipo === 'application/pdf') {
        contenidoExtraido = await extraerTextoPDF(buffer)
      } else if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(tipo)) {
        contenidoExtraido = await describirImagen(buffer, tipo)
      } else if (['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(tipo) || ['doc', 'docx'].includes(ext)) {
        contenidoExtraido = await extraerTextoWord(buffer)
      } else if (['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(tipo) || ['xls', 'xlsx'].includes(ext)) {
        contenidoExtraido = await extraerTextoExcel(buffer)
      } else if (tipo === 'application/zip' || tipo === 'application/x-zip-compressed' || ext === 'zip') {
        contenidoExtraido = await procesarZip(buffer)
      } else if (tipo === 'application/x-rar-compressed' || tipo === 'application/vnd.rar' || ext === 'rar') {
        contenidoExtraido = await procesarRar(buffer)
      } else {
        contenidoExtraido = `[Tipo de archivo no soportado: ${tipo}]`
      }

      // 3. Analizar con Groq (límite diferenciado por tipo)
      const esComprimido = tipo === 'application/zip' || tipo === 'application/x-zip-compressed' || ext === 'zip' ||
                           tipo === 'application/x-rar-compressed' || tipo === 'application/vnd.rar' || ext === 'rar'
      const informe = await analizarConGroq(contenidoExtraido, nombre, esComprimido ? 3500 : 12000)

      console.log(`[${new Date().toISOString()}] ✓ Análisis de Worker completado: ${nombre}. Enviando reporte Webhook.`)
      
      // 4. Devolver resultado usando Webhook al servidor primario
      const SAP_URL = process.env.SAP_WEBHOOK_URL || 'http://localhost:3000'
      const SAP_SECRET = process.env.API_SECRET || ''

      try {
        await fetch(`${SAP_URL}/api/ia/callback`, {
          method: 'POST',
          headers: {
             'Content-Type': 'application/json',
             'x-api-key': SAP_SECRET
          },
          body: JSON.stringify({
            ok: true,
            archivoId,
            legajoId,
            informe,
            procesadoEn: new Date().toISOString()
          })
        })
      } catch (webhookErr) {
        console.error(`[ERROR WEBHOOK] Falló la comunicación hacia Next.js: ${webhookErr}`)
      }
      
    } catch (error) {
      console.error(`[CRÍTICO ASYNC] Worker colapsó procesando ${nombre}:`, error)
      // Idealmente, se debe avisar a backend de NextJS del fracaso, pero omitimos por ahora la res.
      
      const SAP_URL = process.env.SAP_WEBHOOK_URL || 'http://localhost:3000'
      const SAP_SECRET = process.env.API_SECRET || ''
      try {
        await fetch(`${SAP_URL}/api/ia/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SAP_SECRET },
          body: JSON.stringify({
            ok: false,
            archivoId,
            legajoId,
            error: 'Fracaso catastrófico en Worker de IA o extrayendo texto.'
          })
        })
      } catch (webhookErr) {}
    }
  })() // Inicia inmediatamente sin "await" en la promesa general.
})

export default router