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
  convenio: string
  perfil_cliente: string
}

export interface ClienteGrupo {
  cliente_nit: string
  cliente_nombre: string
  ciudad: string
  vendedor: string
  convenio: string
  total_deuda: number
  vigente: number
  dias_1_30: number
  dias_31_60: number
  dias_61_90: number
  dias_91_180: number
  mas_180_dias: number
  total_vencida: number
  mora_90: number
  dias_mora_max: number
}

export interface GrupoAgregado {
  perfil: string
  peso: number
  clientes_count: number
  total_deuda: number
  vigente: number
  dias_1_30: number
  dias_31_60: number
  dias_61_90: number
  dias_91_mas: number
  total_vencida: number
  mora_90: number
  porcentaje: number
  clientes: ClienteGrupo[]
}

export interface Factura {
  num_doc: string
  fecha_emision: string
  fecha_vencimiento: string
  dias_vencida: number
  saldo: number
}

export interface RegionAgregada {
  ranking: number
  departamento: string
  clientes_count: number
  ciudades_count: number
  total_deuda: number
  vigente: number
  dias_1_30: number
  dias_31_60: number
  dias_61_90: number
  dias_91_mas: number
  total_vencida: number
  mora_90: number
  porcentaje: number
  ciudades: CiudadAgregada[]
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
  top_regiones?: Array<{
    departamento: string
    ventas: number
    recaudo: number
  }>
  ingresos_fmt: string
  identificados_fmt: string
  no_identificados_fmt: string
}

export interface CarteraResumen {
  fecha_corte: string
  // Totales
  total_cartera: number
  total_cartera_fmt: string
  total_vencida: number
  total_vencida_fmt: string
  mora_90: number
  mora_90_fmt: string
  pct_vencida: number
  pct_mora_90: number
  // Conteos
  clientes_count: number
  clientes_criticos_count: number
  // Legado (compatibilidad)
  frescas: number
  atencion: number
  riesgo: number
  frescas_fmt: string
  atencion_fmt: string
  riesgo_fmt: string
  // Distribución por tramo
  distribucion: { tramo: string; monto: number }[]
  // Top críticos enriquecidos
  top_criticos: { nombre: string; ciudad: string; vendedor: string; deuda: number; mora_90: number; mora_90_fmt: string }[]
}

// bancos/cartera pueden ser {} si no hay datos aún

export interface DashboardResumen {
  bancos: BancosResumen | Record<string, never>
  cartera: CarteraResumen | Record<string, never>
  pipelines: Pipeline[]
  alertas: Alert[]
  fecha_consulta: string
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

// Dashboard de Bancos - Ventas Netas vs Recaudo
export interface DashboardBancosKPIs {
  ventas_netas: number
  ventas_netas_fmt: string
  recaudo: number
  recaudo_fmt: string
  porcentaje_recaudo: number
}

export interface VentaMensual {
  mes: string
  mes_num: number
  ventas_netas: number
  recaudo: number
}

export interface VentaCiudad {
  ciudad: string
  departamento?: string
  ciudad_original?: string | null
  ventas: number
  recaudo: number
}

export interface VentaRegion {
  departamento: string
  ventas: number
  recaudo: number
  ciudades_count: number
  porcentaje_ventas: number
  porcentaje_recaudo: number
  ciudades: Array<{
    ciudad: string
    ventas: number
    recaudo: number
  }>
}

export interface OpcionesMes {
  value: number
  label: string
}

export interface DashboardBancosRespuesta {
  año: number
  filtros_aplicados: {
    mes: string | null
    ciudad: string | null
    vendedor: string | null
  }
  kpis: DashboardBancosKPIs
  ventas_por_mes: VentaMensual[]
  ventas_por_ciudad: VentaCiudad[]
  ventas_por_region?: VentaRegion[]
  opciones_filtros: {
    ciudades: string[]
    meses: OpcionesMes[]
    vendedores: string[]
    años: number[]
  }
  ultima_actualizacion: string
  nota?: string
}
