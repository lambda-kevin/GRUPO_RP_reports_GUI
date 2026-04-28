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

// Desglose por línea de producto embebido en cada cliente consolidado
export interface LineaDeuda {
  cod_vend: string        // código numérico: '02', '04', '09'…
  linea_nombre: string    // nombre desde SAVEND: 'Maxilo', 'Ortopedia'…
  total_deuda: number
  vigente: number
  dias_1_30: number
  dias_31_60: number
  dias_61_90: number
  dias_91_180: number
  mas_180_dias: number
}

// SnapCartera — un registro por cliente (consolidado: suma de todas sus líneas)
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
  proxima_fecha_vencimiento: string | null
  responsable_cobro: string
  dias_mora_max: number
  // Dimensiones de negocio
  ciudad: string
  /** Nombres de línea concatenados, ej: "Maxilo, Ortopedia". NO es nombre de persona. */
  vendedor: string
  linea: string
  /** Código(s) de línea, ej: "02, 04". Corresponde a CodVend en SAACXC. */
  cod_vend: string
  convenio: string
  perfil_cliente: string
  /** Desglose por línea de producto (un item por CodVend) */
  lineas?: LineaDeuda[]
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
  // Rentabilidad
  ventas_anio: number
  ratio_cartera_ventas: number | null   // % cartera / ventas del año
  dias_cartera: number | null           // días promedio de cobro (DSO)
  // Pareto interno al grupo
  porcentaje_en_grupo: number
  porcentaje_acumulado_en_grupo: number
}

export interface GrupoAgregado {
  grupo: string
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
  porcentaje_acumulado: number   // Pareto acumulado (grupos ordenados por deuda desc)
  // Rentabilidad
  ventas_anio: number
  ratio_cartera_ventas: number | null
  dias_cartera: number | null
  clientes: ClienteGrupo[]
}

/** Item del Pareto plano de clientes (vista micro, todos los grupos combinados) */
export interface ParetoClienteItem {
  grupo: string
  peso: number
  cliente_nit: string
  cliente_nombre: string
  ciudad: string
  total_deuda: number
  mora_90: number
  total_vencida: number
  ventas_anio: number
  ratio_cartera_ventas: number | null
  dias_cartera: number | null
  porcentaje: number
  porcentaje_acumulado: number
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

/** Cartera agrupada por Línea de Producto (CodVend/SAVEND). "vendedor" es el nombre de la línea, no una persona. */
export interface LineaAgregada {
  /** Nombre de la línea desde SAVEND (ej: "Maxilo", "Ortopedia"). */
  linea: string
  /** Campo heredado — mismo valor que linea. Mantener para compatibilidad. */
  vendedor: string
  /** Código numérico de la línea en Saint (ej: "02", "04"). */
  cod_vend: string
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

/** @deprecated Usar LineaAgregada */
export type VendedorAgregado = LineaAgregada

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

export interface GrupoCartDash {
  grupo: string
  peso: number
  clientes_count: number
  total_deuda: number
  mora_90: number
  porcentaje: number
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
  // Grupos empresariales (concentración rápida para dashboard)
  grupos_cartera?: GrupoCartDash[]
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

export interface TesoreriaKpis {
  cxp_total: number
  cxp_total_fmt: string
  pagos_7_dias: number
  pagos_7_dias_fmt: string
  pagos_30_dias: number
  pagos_30_dias_fmt: string
  ingresos_periodo: number
  ingresos_periodo_fmt: string
  egresos_periodo: number
  egresos_periodo_fmt: string
  flujo_neto_periodo: number
  flujo_neto_periodo_fmt: string
}

export interface CxpEdadItem {
  tramo: string
  saldo: number
}

export interface ProximoPagoItem {
  proveedor: string
  tipo_proveedor?: 'bancario' | 'proveedores' | 'todos' | string
  documento: string
  fecha_vencimiento: string
  saldo: number
  dias_para_vencer: number
}

export interface IngresoBancarioItem {
  mes: string
  mes_num: number
  ingresos: number
}

export interface FlujoItem {
  mes: string
  mes_num: number
  ingresos: number
  egresos: number
  flujo_neto: number
}

export interface DashboardTesoreriaRespuesta {
  año: number
  mes: number | null
  tipo_proveedor?: 'bancario' | 'proveedores' | 'todos' | string
  kpis: TesoreriaKpis
  cxp_por_edad: CxpEdadItem[]
  proximos_pagos: ProximoPagoItem[]
  ingresos_bancarios: IngresoBancarioItem[]
  flujo: FlujoItem[]
  fuente_db: string
  ultima_actualizacion: string
}

export interface SaldoFavorItem {
  id: string
  fecha_corte: string
  cliente_nit: string
  cliente_nombre: string
  num_documentos: number
  total_saldo_favor: number
  /** total_deuda_cartera - total_saldo_favor; null si el cliente no tiene cartera activa */
  saldo_neto: number | null
}

export interface SaldoFavorRespuesta {
  fecha_corte: string | null
  total_clientes: number
  total_saldo_favor: number
  clientes: SaldoFavorItem[]
}

export interface AsesorCliente {
  cliente_nit: string
  cliente_nombre: string
  ciudad: string
  total_deuda: number
  vigente: number
  dias_91_180: number
  mas_180_dias: number
  dias_mora_max: number
}

export interface AsesorItem {
  asesor: string
  clientes_count: number
  lineas: string[]
  total_deuda: number
  vigente: number
  total_vencida: number
  mora_90: number
  porcentaje: number
  clientes: AsesorCliente[]
}

export interface AsesorRespuesta {
  fecha_corte: string
  asesores: AsesorItem[]
  total_general: number
}
