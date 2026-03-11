import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { validarApiKey } from './lib/seguridad'
import analizarRouter from './routes/analizar'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middlewares
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['POST', 'GET'],
}))
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

app.listen(PORT, () => {
  console.log(`✅ Backend IA DAJUDECO corriendo en puerto ${PORT}`)
  console.log(`   Health check: http://localhost:${PORT}/health`)
  console.log(`   Endpoint: POST http://localhost:${PORT}/analizar`)
})

export default app