export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  rol: string
  is_superuser: boolean
  is_staff: boolean
}

// SnapBancos — refleja exactamente el modelo Django
export interface SnapBancos {
  id: string
  fecha_corte: string
  banco: string
  total_ingresos: number
  identificados: number
  no_identificados: number
  cant_transacciones: number
  flag_cuadre: boolean
  detalle_json: unknown[]
  generado_at: string
}

// SnapCartera — campo correcto es cliente_nit (no cliente_codigo)
export interface SnapCartera {
  id: string
  fecha_corte: string
  cliente_nit: string
  cliente_nombre: string
  vigente: number
  dias_1_30: number
  dias_31_60: number
  dias_61_90: number
  dias_91_180: number
  mas_180_dias: number
  total_deuda: number
  ultima_factura: string | null
  // Campos adicionales para reporte ejecutivo
  proxima_fecha_vencimiento: string | null
  responsable_cobro: string
  dias_mora_max: number
  // Dimensiones de negocio
  ciudad: string
  vendedor: string
  linea: string
}

export interface Factura {
  num_doc: string
  fecha_emision: string
  fecha_vencimiento: string
  dias_vencida: number
  saldo: number
}

export interface CiudadAgregada {
  ciudad: string
  clientes_count: number
  total_deuda: number
  vigente: number
  dias_1_30: number
  dias_31_60: number
  dias_61_90: number
  dias_91_mas: number
  total_vencida: number
  porcentaje: number
  clientes: Array<{
    cliente_nit: string
    cliente_nombre: string
    total_deuda: number
    vigente: number
    dias_91_180: number
    mas_180_dias: number
    dias_mora_max: number
  }>
}

export interface ProximoVencimiento {
  cliente: string
  cliente_nit: string
  num_doc: string
  fecha_vencimiento: string
  saldo: number
  dias_para_vencer: number
  vendedor: string
}

export interface ClienteResumen {
  cliente_nit: string
  cliente_nombre: string
  total_deuda: number
  vigente: number
  dias_91_180: number
  mas_180_dias: number
  dias_mora_max: number
  ciudad?: string
}

export interface VendedorAgregado {
  vendedor: string
  clientes_count: number
  total_deuda: number
  vigente: number
  dias_1_30: number
  dias_31_60: number
  dias_61_90: number
  dias_91_mas: number
  total_vencida: number
  porcentaje: number
  clientes: ClienteResumen[]
}

export interface AnalisisIA {
  fecha_corte: string
  contenido_html: string
  modelo?: string
  tokens_usados?: number
  tiempo_generacion?: number
  generado_at?: string
}

export interface Alert {
  titulo: string
  nivel: 'ok' | 'warn' | 'error'
  descripcion: string
}

export interface Pipeline {
  nombre: string
  estado: string
  nivel: 'ok' | 'warn' | 'error'
  ultima_ejecucion: string | null
}

// Tipos separados para cada sección del dashboard
export interface BancosResumen {
  fecha_corte: string
  total_ingresos: number
  total_identificados: number
  total_no_identificados: number
  total_transacciones: number
  bancos_con_diferencia: number
  ingresos_fmt: string
  identificados_fmt: string
  no_identificados_fmt: string
}

export interface CarteraResumen {
  fecha_corte: string
  frescas: number
  atencion: number
  riesgo: number
  frescas_fmt: string
  atencion_fmt: string
  riesgo_fmt: string
  top_criticos: { nombre: string; deuda: number }[]
}

// bancos/cartera pueden ser {} si no hay datos aún
export interface DashboardResumen {
  bancos: BancosResumen | Record<string, never>
  cartera: CarteraResumen | Record<string, never>
  pipelines: Pipeline[]
  alertas: Alert[]
}

// tokens_usados y latencia_ms son nullable en el modelo
export interface Mensaje {
  id: string
  role: 'user' | 'assistant'
  contenido: string
  dominio_detectado: string
  tokens_usados: number | null
  latencia_ms: number | null
  created_at: string
}

// nombre es string (no null) — el modelo usa blank=True, default=""
export interface Conversacion {
  id: string
  nombre: string
  canal: string
  activa: boolean
  created_at: string
  updated_at: string
  mensajes: Mensaje[]
  ultimo_mensaje: { contenido: string; created_at: string } | null
}

export interface Pedido {
  id: string
  consecutivo: number
  estado: string
  fecha_cirugia: string
  paciente_nombre: string
  paciente_documento: string | null
  eps_pagador: string | null
  institucion: string | number
  sede_origen: string | number
  canal_entrada: string
  diagnostico: string
  comentarios: string
  saint_sync_at: string | null
  created_at: string
}

// archivo es CharField(blank=True) — nunca null, puede ser string vacío
export interface LogEnvio {
  id: string
  tipo_reporte: string
  canal: string
  destinatario: string
  estado: string
  detalle: string
  archivo: string
  created_at: string
}
