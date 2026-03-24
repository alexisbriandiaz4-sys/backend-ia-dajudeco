import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import { validarApiKey } from './lib/seguridad'
import analizarRouter from './routes/analizar'
import logger from './lib/logger'
import { globalErrorHandler } from './lib/errorHandler'
import { apiLimiter } from './lib/rateLimiter'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middlewares de seguridad y generales
app.use(helmet()) // Cabeceras de seguridad
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['POST', 'GET'],
}))
app.use(express.json({ limit: '50mb' }))

// Rate limiting global
app.use(apiLimiter)
app.use(express.json({ limit: '50mb' }))

// Health check — para verificar que el servidor está vivo
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    servicio: 'backend-ia-dajudeco',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })
})

// Rutas protegidas con API key
app.use('/analizar', validarApiKey, analizarRouter)

// Manejo de rutas no encontradas
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' })
})

// Middleware global de manejo de errores
app.use(globalErrorHandler)

app.listen(PORT, () => {
  logger.info(`✅ Backend IA DAJUDECO corriendo en puerto ${PORT}`)
  logger.info(`   Health check: http://localhost:${PORT}/health`)
  logger.info(`   Endpoint: POST http://localhost:${PORT}/analizar`)
  logger.info(`   ZIP recursivo: activado (Open.buffer)`)
  logger.info(`   Límite de contenido Groq: 3500 chars`)
})

export default app