import { Router, Request, Response, NextFunction } from 'express'
import fetch from 'node-fetch'
import { z } from 'zod'
import logger from '../lib/logger'
import { extraerTextoPDF } from '../procesadores/pdf'
import { extraerTextoWord } from '../procesadores/word'
import { extraerTextoExcel } from '../procesadores/excel'
import { describirImagen } from '../procesadores/imagen'
import { procesarZip } from '../procesadores/zip'
import { procesarRar } from '../procesadores/rar'
import { analizarConGroq, extraerGrafosConGroq, transcribirAudioConGroq } from '../ia/groq'

const router = Router()

const bodySchema = z.object({
  url: z.string().url('La URL del archivo es inválida'),
  tipo: z.string().min(1, 'El tipo de archivo es requerido'),
  nombre: z.string().min(1, 'El nombre del archivo es requerido'),
  legajoId: z.string().min(1, 'El ID de legajo es requerido'),
  archivoId: z.string().min(1, 'El ID de archivo es requerido'),
  webhookUrl: z.string().url().optional().or(z.literal(''))
})

type BodyAnalizar = z.infer<typeof bodySchema>

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const result = bodySchema.safeParse(req.body)
  
  if (!result.success) {
    const errorMessages = result.error.issues.map((e) => e.message).join(', ')
    logger.warn(`Intento de análisis con datos inválidos: ${errorMessages}`)
    return res.status(400).json({ error: `Datos inválidos: ${errorMessages}` })
  }

  const { url, tipo, nombre, legajoId, archivoId, webhookUrl } = result.data

  logger.info(`Analizando de forma asíncrona: ${nombre} (legajo: ${legajoId})`)

  // Se retorna inmediatamente el Accepted/202 para que el host originador (como Vercel)
  // no aborte el request por Timeout si esto toma más de 60 segundos.
  res.status(202).json({ ok: true, msg: 'Procesamiento en background iniciado', archivoId, legajoId })

  // Comienza la función auto-ejecutada de Worker desconectado del Socket del cliente HTTP
  ;(async () => {
    try {
      // 1. Descargar el archivo desde Cloudinary
      const respuestaDescarga = await fetch(url)
      if (!respuestaDescarga.ok) {
         logger.error(`${nombre}: No se pudo descargar archivo desde ${url}`)
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
      } else if (['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 'audio/mp4', 'video/mp4'].includes(tipo) || ['mp3', 'wav', 'ogg', 'm4a', 'mp4'].includes(ext)) {
        // Enviar Buffer como audio a Whisper - Groq permite máx 25MB
        logger.info(`[AUDIO] Enviando ${nombre} a Whisper IA...`)
        contenidoExtraido = await transcribirAudioConGroq(buffer, nombre)
      } else {
        contenidoExtraido = `[Tipo de archivo no soportado: ${tipo}]`
      }

      // 3. Analizar con Groq (límite diferenciado por tipo) - en PARALELO (Resumen Textual + Grafo JSON)
      const esComprimido = tipo === 'application/zip' || tipo === 'application/x-zip-compressed' || ext === 'zip' ||
                           tipo === 'application/x-rar-compressed' || tipo === 'application/vnd.rar' || ext === 'rar'
                           
      const limiteTexto = esComprimido ? 3500 : 12000;
      
      const [informe, grafos] = await Promise.all([
        analizarConGroq(contenidoExtraido, nombre, limiteTexto),
        extraerGrafosConGroq(contenidoExtraido, limiteTexto)
      ])

      logger.info(`✓ Análisis de Worker completado: ${nombre}. Enviando reporte Webhook.`)
      
      // 4. Devolver resultado usando Webhook al servidor primario
      let SAP_URL = webhookUrl || process.env.SAP_WEBHOOK_URL || 'http://localhost:3000'
      
      // Si el frontend está corriendo localmente, mandará localhost. 
      // Railway en la nube no puede alcanzar el localhost de la PC del usuario.
      if (SAP_URL.includes('localhost') && process.env.SAP_WEBHOOK_URL) {
         SAP_URL = process.env.SAP_WEBHOOK_URL
      }

      if (SAP_URL && !SAP_URL.startsWith('http')) {
        SAP_URL = 'https://' + SAP_URL
      }
      if (SAP_URL.endsWith('/')) {
        SAP_URL = SAP_URL.slice(0, -1)
      }
      
      const SAP_SECRET = process.env.API_SECRET || process.env.SAP_WEBHOOK_SECRET || ''

      logger.info(`Despachando callback a -> ${SAP_URL}/api/ia/callback`)

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
            grafos: grafos.conexiones,
            procesadoEn: new Date().toISOString()
          })
        })
      } catch (webhookErr) {
        logger.error(`Falló la comunicación hacia Next.js:`, webhookErr)
      }
      
    } catch (error) {
      logger.error(`Worker colapsó procesando ${nombre}:`, error)
      // Idealmente, se debe avisar a backend de NextJS del fracaso, pero omitimos por ahora la res.
      
      let SAP_URL = webhookUrl || process.env.SAP_WEBHOOK_URL || 'http://localhost:3000'

      if (SAP_URL.includes('localhost') && process.env.SAP_WEBHOOK_URL) {
         SAP_URL = process.env.SAP_WEBHOOK_URL
      }

      if (SAP_URL && !SAP_URL.startsWith('http')) {
        SAP_URL = 'https://' + SAP_URL
      }
      if (SAP_URL.endsWith('/')) {
        SAP_URL = SAP_URL.slice(0, -1)
      }

      const SAP_SECRET = process.env.API_SECRET || process.env.SAP_WEBHOOK_SECRET || ''
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