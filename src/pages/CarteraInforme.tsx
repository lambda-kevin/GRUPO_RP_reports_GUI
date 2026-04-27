import { useState, useRef, useEffect, useMemo, Fragment, type ReactNode } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip as RTooltip, ReferenceLine, Cell,
} from 'recharts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import {
  Wallet,
  AlertTriangle, Clock, ChevronDown, ChevronRight,
  Calendar, MapPin, UserCheck, Search, ShieldAlert, CheckCircle, Mail,
  Settings, X, Trash2, ToggleLeft, ToggleRight, UserPlus, Building2, ChevronUp, Users,
} from 'lucide-react'
import {
  getCartera, getProximosVencimientos,
  getCarteraRegiones, getFacturas, getCarteraGrupos,
  getSaldoFavor, getCarteraAsesores,
  enviarReporteCartera,
  getDestinatariosCartera, crearDestinatarioCartera,
  toggleDestinatarioCartera, eliminarDestinatarioCartera,
  getGruposEmpresariales, crearGrupoEmpresarial, eliminarGrupoEmpresarial,
  actualizarGrupoEmpresarial, agregarMiembroGrupo, eliminarMiembroGrupo,
  type FiltroFecha, type Destinatario, type GrupoEmpresarial as GrupoEmpresarialAPI,
} from '../api/dashboard'
import { Spinner } from '../components/ui/Spinner'
import { fmtCOP, fmtPct } from '../utils/fmt'
import type {
  SnapCartera, Factura, ProximoVencimiento,
  CiudadAgregada, RegionAgregada, GrupoAgregado, ParetoClienteItem,
  SaldoFavorItem, AsesorItem, AsesorCliente,
} from '../types'

const fmt  = fmtCOP
const fmtM = fmtCOP

const PAGE_SIZE = 10
const totalPages = (items: number) => Math.max(1, Math.ceil(items / PAGE_SIZE))
const paginate = <T,>(items: T[], page: number) =>
  items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

const hoy = () => new Date().toISOString().slice(0, 10)

// ─── Riesgo ────────────────────────────────────────────────────────────────────

const nivelRiesgo = (c: Pick<SnapCartera, 'dias_91_180' | 'mas_180_dias' | 'dias_61_90' | 'dias_31_60' | 'dias_1_30'>) => {
  if (c.dias_91_180 + c.mas_180_dias >= 1) return 'critico'
  if (c.dias_61_90 >= 1)                   return 'alto'
  if (c.dias_31_60 >= 1)                   return 'medio'
  if (c.dias_1_30  >= 1)                   return 'leve'
  return 'ok'
}

// Devuelve true si el cliente tiene saldo en el tramo indicado.
// Un cliente puede cumplir varios tramos a la vez (vigente + mora).
const tieneEnBucket = (
  c: Pick<SnapCartera, 'vigente' | 'dias_1_30' | 'dias_31_60' | 'dias_61_90' | 'dias_91_180' | 'mas_180_dias'>,
  bucket: string,
): boolean => {
  switch (bucket) {
    case 'ok':      return c.dias_1_30 === 0 && c.dias_31_60 === 0 && c.dias_61_90 === 0 && c.dias_91_180 === 0 && c.mas_180_dias === 0
    case 'leve':    return c.dias_1_30 >= 1
    case 'medio':   return c.dias_31_60 >= 1
    case 'alto':    return c.dias_61_90 >= 1
    case 'critico': return c.dias_91_180 + c.mas_180_dias >= 1
    default:        return true
  }
}

const badgeCls = (nivel: string) => ({
  critico: 'bg-red-100 text-red-800 border border-red-300',
  alto:    'bg-orange-100 text-orange-800 border border-orange-300',
  medio:   'bg-yellow-100 text-yellow-800 border border-yellow-300',
  leve:    'bg-blue-100 text-blue-800 border border-blue-300',
  ok:      'bg-green-100 text-green-800 border border-green-300',
}[nivel] ?? 'bg-gray-100 text-gray-600 border border-gray-300')

const rowBgCls = (nivel: string) => ({
  critico: 'bg-red-50',
  alto:    'bg-orange-50',
  medio:   'bg-yellow-50',
  leve:    'bg-blue-50',
  ok:      'bg-white',
}[nivel] ?? 'bg-white')

// ─── Tooltip desglose vencida ─────────────────────────────────────────────────

type VBuckets = { dias_1_30: number; dias_31_60: number; dias_61_90: number; dias_91_180: number; mas_180_dias: number }

const TooltipVencida = ({ b, vencida }: { b: VBuckets; vencida: number }) => {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  if (vencida <= 0) return <span className="text-gray-300">—</span>
  const tramos = [
    { label: '1 – 30 días',   val: b.dias_1_30,    cls: 'text-blue-600' },
    { label: '31 – 60 días',  val: b.dias_31_60,   cls: 'text-yellow-600' },
    { label: '61 – 90 días',  val: b.dias_61_90,   cls: 'text-orange-500' },
    { label: '91 – 180 días', val: b.dias_91_180,  cls: 'text-red-600' },
    { label: '+180 días',     val: b.mas_180_dias, cls: 'text-red-900 font-bold' },
  ].filter(t => t.val > 0)
  return (
    <span
      className="inline-block cursor-help"
      onMouseEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseMove={(e)  => setPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setPos(null)}
    >
      <span className="font-semibold text-orange-600 underline decoration-dotted decoration-orange-300">
        {fmtM(vencida)}
      </span>
      {pos && (
        <div
          className="fixed z-[9999] pointer-events-none bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden w-64"
          style={{ left: Math.max(8, pos.x - 260), top: Math.max(8, pos.y - 240) }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <div className="w-1.5 h-3.5 rounded-full bg-orange-400 shrink-0" />
            <span className="text-xs font-bold text-gray-700 uppercase tracking-widest">Desglose mora</span>
          </div>
          {/* Rows */}
          <div className="px-4 py-2 space-y-1.5">
            {tramos.map(({ label, val, cls }) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <span className={`text-xs font-semibold ${cls} shrink-0`}>{label}</span>
                <span className="text-xs font-bold text-gray-800 tabular-nums">{fmtM(val)}</span>
              </div>
            ))}
          </div>
          {/* Total */}
          <div className="flex items-center justify-between gap-4 mx-3 mb-3 mt-1 px-3 py-2 rounded-xl bg-orange-50 border border-orange-200">
            <span className="text-xs font-bold text-orange-600 uppercase tracking-wide shrink-0">Total</span>
            <span className="text-xs font-extrabold text-orange-600 tabular-nums">{fmtM(vencida)}</span>
          </div>
        </div>
      )}
    </span>
  )
}

// ─── Facturas expandidas de un cliente ────────────────────────────────────────

const FACT_PAGE_SIZE = 10

const FilaFacturas = ({ nit, cols, filtro, soloVigente }: { nit: string; cols: number; filtro?: FiltroFecha; soloVigente?: boolean }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['facturas', nit, filtro],
    queryFn: () => getFacturas(nit, filtro),
    staleTime: 5 * 60 * 1000,
  })
  const [page, setPage] = useState(1)
  const facturas = soloVigente
    ? (data?.facturas ?? []).filter(f => f.dias_vencida <= 0)
    : (data?.facturas ?? [])
  const pages     = Math.max(1, Math.ceil(facturas.length / FACT_PAGE_SIZE))
  const pg        = Math.min(page, pages)
  const paginated = facturas.slice((pg - 1) * FACT_PAGE_SIZE, pg * FACT_PAGE_SIZE)
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-2">
        <div className="bg-slate-50 border border-slate-200 rounded-xl mx-8 mb-3 overflow-hidden">
          {isLoading && (
            <div className="flex items-center gap-2 px-5 py-4 text-base text-gray-500">
              <Spinner className="h-5 w-5" /> Cargando facturas…
            </div>
          )}
          {error && <p className="px-5 py-4 text-base text-red-500">Error al cargar facturas.</p>}
          {!isLoading && !error && facturas.length === 0 && (
            <p className="px-5 py-4 text-base text-gray-400">
              {soloVigente ? 'Sin facturas por vencer para este cliente.' : 'Sin facturas en el período consultado.'}
            </p>
          )}
          {facturas.length > 0 && (
            <>
            <div className="px-5 py-3 bg-slate-100 font-bold text-slate-700 text-base border-b border-slate-200 flex items-center justify-between">
              <span>{soloVigente ? 'FACTURAS POR VENCER — AÚN NO VENCIDAS' : 'FACTURAS PENDIENTES — DE LA MÁS ANTIGUA A LA MÁS RECIENTE'}</span>
              {pages > 1 && (
                <span className="text-xs font-semibold text-slate-500">
                  {(pg - 1) * FACT_PAGE_SIZE + 1}–{Math.min(pg * FACT_PAGE_SIZE, facturas.length)} de {facturas.length}
                </span>
              )}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-200 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Documento</th>
                  <th className="px-4 py-3 text-left font-semibold">Emisión</th>
                  <th className="px-4 py-3 text-left font-semibold">Vencimiento</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((f: Factura, i: number) => {
                  const dv = f.dias_vencida
                  const cls =
                    dv > 90 ? 'text-red-900 font-bold' :
                    dv > 60 ? 'text-red-600' :
                    dv > 30 ? 'text-orange-600' :
                    dv > 0  ? 'text-yellow-700' : 'text-green-600'
                  const lbl =
                    dv > 0  ? `Vencida hace ${dv}d` :
                    dv === 0 ? 'Vence hoy' : `Vence en ${-dv}d`
                  return (
                    <tr key={i} className="border-t border-slate-200 hover:bg-white">
                      <td className="px-4 py-2 font-mono text-sm">{f.num_doc}</td>
                      <td className="px-4 py-2 text-gray-600">{f.fecha_emision}</td>
                      <td className="px-4 py-2 text-gray-600">{f.fecha_vencimiento}</td>
                      <td className={`px-4 py-2 font-semibold ${cls}`}>{lbl}</td>
                      <td className="px-4 py-2 text-right font-bold text-[#0f3460]">{fmt(f.saldo)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={4} className="px-4 py-2 font-bold text-slate-700">
                    {facturas.length} {facturas.length === 1 ? 'factura' : 'facturas'}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-slate-700">
                    {fmt(facturas.reduce((s, f) => s + f.saldo, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
            {pages > 1 && (
              <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-slate-200">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={pg <= 1}
                  className="px-3 py-1 rounded-lg border border-slate-300 text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition-colors"
                >← Ant.</button>
                <span className="text-xs font-semibold text-slate-500">Pág. {pg} / {pages}</span>
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={pg >= pages}
                  className="px-3 py-1 rounded-lg border border-slate-300 text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition-colors"
                >Sig. →</button>
              </div>
            )}
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Facturas de muestra (modo demo) ─────────────────────────────────────────

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KPICard = ({
  label, value, sub, gradient, icon,
}: { label: string; value: string; sub: ReactNode; gradient: string; icon: ReactNode }) => (
  <div className={`bg-gradient-to-br ${gradient} text-white rounded-2xl p-6 shadow-lg`}>
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-base font-medium opacity-90 mb-2 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-extrabold mb-1 leading-tight tabular-nums">{value}</p>
        <div className="text-sm opacity-80">{sub}</div>
      </div>
      <div className="opacity-15 ml-3">{icon}</div>
    </div>
  </div>
)

// ─── Encabezado de sección ────────────────────────────────────────────────────

type SectionColor = 'blue' | 'orange' | 'purple' | 'teal' | 'indigo'

const SECTION_COLORS: Record<SectionColor, { border: string; bg: string; text: string }> = {
  blue:   { border: 'border-blue-400',   bg: 'bg-blue-100',   text: 'text-blue-700'   },
  orange: { border: 'border-orange-400', bg: 'bg-orange-100', text: 'text-orange-700' },
  purple: { border: 'border-purple-400', bg: 'bg-purple-100', text: 'text-purple-700' },
  teal:   { border: 'border-teal-400',   bg: 'bg-teal-100',   text: 'text-teal-700'   },
  indigo: { border: 'border-indigo-400', bg: 'bg-indigo-100', text: 'text-indigo-700' },
}

const SectionHeader = ({ icon, title, count, color }: {
  icon: ReactNode; title: string; count?: string | number; color: SectionColor
}) => {
  const c = SECTION_COLORS[color]
  return (
    <div className={`flex items-center gap-3 mb-5 pb-3 border-b-4 ${c.border}`}>
      <div className={`p-2 ${c.bg} rounded-xl ${c.text}`}>{icon}</div>
      <h2 className="text-2xl font-extrabold text-gray-800">{title}</h2>
      {count !== undefined && (
        <span className={`ml-auto text-sm font-bold ${c.text} ${c.bg} px-3 py-1 rounded-full`}>
          {count}
        </span>
      )}
    </div>
  )
}

const PaginationControls = ({
  page,
  pages,
  onChange,
}: {
  page: number
  pages: number
  onChange: (page: number) => void
}) => {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-end gap-3 mt-5">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="px-5 py-2.5 rounded-xl border border-gray-300 text-base font-bold text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors"
      >
        ← Anterior
      </button>
      <span className="text-base font-semibold text-gray-600 px-2">
        Página {page} de {pages}
      </span>
      <button
        onClick={() => onChange(Math.min(pages, page + 1))}
        disabled={page >= pages}
        className="px-5 py-2.5 rounded-xl border border-gray-300 text-base font-bold text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors"
      >
        Siguiente →
      </button>
    </div>
  )
}

// ─── Indicador de días para vencer ───────────────────────────────────────────

const PillDias = ({ dias }: { dias: number }) => {
  const cls =
    dias <= 5  ? 'bg-red-100 text-red-900 font-extrabold border border-red-400' :
    dias <= 10 ? 'bg-orange-100 text-orange-900 font-bold border border-orange-300' :
    dias <= 15 ? 'bg-yellow-100 text-yellow-900 font-semibold border border-yellow-300' :
                 'bg-gray-100 text-gray-700 border border-gray-300'
  return <span className={`px-3 py-1 rounded-full text-sm ${cls}`}>{dias}d</span>
}

// ─── Búsqueda helper ─────────────────────────────────────────────────────────

const BuscarInput = ({ value, onChange, placeholder = 'Buscar por nombre o NIT...' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) => (
  <div className="relative mb-4 max-w-lg">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
    />
    {value && (
      <button
        onClick={() => onChange('')}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xl leading-none font-bold"
      >×</button>
    )}
  </div>
)

const filtrarPorBusqueda = <T extends { cliente_nit?: string; cliente_nombre?: string; nombre?: string; nit?: string }>(
  items: T[], q: string
): T[] => {
  if (!q.trim()) return items
  const lq = q.toLowerCase()
  return items.filter(x =>
    (x.cliente_nombre ?? x.nombre ?? '').toLowerCase().includes(lq) ||
    (x.cliente_nit   ?? x.nit   ?? '').toLowerCase().includes(lq)
  )
}

// ─── Colores y helpers para Grupos Empresariales ─────────────────────────────

const GRUPO_COLOR: Record<string, string> = {
  'Grupo Zentria':    '#272364',
  'Grupo SURA':       '#1d4ed8',
  'Grupo Quirónsalud':'#247777',
  'Grupo AUNA':       '#6b8e23',
  'Otros':            '#94a3b8',
}
const grupoColor = (g: string) => GRUPO_COLOR[g] ?? '#64748b'

// Tooltip Pareto grupos
const GrupoParetoTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as GrupoAgregado & { nombre_corto: string }
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm min-w-[230px]">
      <p className="font-extrabold text-gray-900 mb-2">{d.grupo}</p>
      <p className="text-slate-700">Cartera: <strong>{fmtCOP(d.total_deuda)}</strong></p>
      {d.ventas_anio > 0 && <p className="text-emerald-700">Ventas: <strong>{fmtCOP(d.ventas_anio)}</strong></p>}
      {d.dias_cartera != null && <p className="text-indigo-600">Días cartera: <strong>{d.dias_cartera}d</strong></p>}
      <p className="text-blue-600 mt-1">% del total: <strong>{d.porcentaje}%</strong></p>
      <p className="text-purple-700">Acumulado: <strong>{d.porcentaje_acumulado}%</strong></p>
    </div>
  )
}

// Tooltip Pareto clientes (micro)
const ClienteParetoTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as ParetoClienteItem & { nombre_corto: string }
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm min-w-[240px]">
      <p className="font-extrabold text-gray-900 mb-1 break-words whitespace-normal">{d.cliente_nombre}</p>
      <p className="text-xs text-gray-500 mb-2">{d.grupo} · {d.ciudad || '—'}</p>
      <p className="text-slate-700">Cartera: <strong>{fmtCOP(d.total_deuda)}</strong></p>
      {d.ventas_anio > 0 && <p className="text-emerald-700">Ventas: <strong>{fmtCOP(d.ventas_anio)}</strong></p>}
      {d.dias_cartera != null && <p className="text-indigo-600">Días cartera: <strong>{d.dias_cartera}d</strong></p>}
      <p className="text-purple-700 mt-1">% acumulado: <strong>{d.porcentaje_acumulado}%</strong></p>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export const CarteraInforme = () => {
  const [hastaInput, setHastaInput] = useState(hoy())
  const [filtro, setFiltro] = useState<FiltroFecha>({})

  const [expClientes,        setExpClientes]        = useState<Set<string>>(new Set())
  const [expRegiones,        setExpRegiones]        = useState<Set<string>>(new Set())
  const [expRegionesCiudades,setExpRegionesCiudades]= useState<Set<string>>(new Set())
  const [pagesCiudad,        setPagesCiudad]        = useState<Record<string, number>>({})
  const [expGrupos,          setExpGrupos]          = useState<Set<string>>(new Set())
  const [expAsesores,        setExpAsesores]        = useState<Set<string>>(new Set())

  const [tabGrupos,          setTabGrupos]          = useState<'pareto' | 'detalle' | 'edades'>('pareto')
  const [vistaPareto,        setVistaPareto]        = useState<'macro' | 'micro'>('macro')
  const [pageMicro,          setPageMicro]          = useState(1)
  const [filtroRiesgo,       setFiltroRiesgo]       = useState<string>('todos')
  const [pageCarteraEdades,  setPageCarteraEdades]  = useState(1)
  const [pageProximos,       setPageProximos]       = useState(1)
  const [pageRegiones,       setPageRegiones]       = useState(1)
  const [pageSaldo,          setPageSaldo]          = useState(1)
  const [pageAsesores,       setPageAsesores]       = useState(1)
  const [pagesAsesorCli,     setPagesAsesorCli]     = useState<Record<string, number>>({})
  const [showSinInfo,        setShowSinInfo]        = useState(false)

  // Búsqueda por sección
  const [busEdades,      setBusEdades]      = useState('')
  const [busRegiones,    setBusRegiones]    = useState('')
  const [busSaldo,       setBusSaldo]       = useState('')
  const [busAsesores,    setBusAsesores]    = useState('')

  // Orden
  const [ordenEdades,   setOrdenEdades]   = useState<'az' | 'deuda'>('az')

  // Estado botón envío de reporte
  const [enviando,       setEnviando]       = useState(false)
  const [enviado,        setEnviado]        = useState(false)
  const [errorEnvio,     setErrorEnvio]     = useState<string | null>(null)

  // Dropdown "Configurar"
  const [showConfigMenu, setShowConfigMenu] = useState(false)
  const configMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showConfigMenu) return
    const handler = (e: MouseEvent) => {
      if (configMenuRef.current && !configMenuRef.current.contains(e.target as Node)) {
        setShowConfigMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showConfigMenu])

  // Estado modal grupos empresariales
  const [showGrupos,        setShowGrupos]        = useState(false)
  const [nuevoGrupo,        setNuevoGrupo]        = useState('')
  const [nuevoPeso,         setNuevoPeso]         = useState<number>(99)
  const [addingGrupo,       setAddingGrupo]       = useState(false)
  const [errorGrupos,       setErrorGrupos]       = useState<string | null>(null)
  const [expandedGrupo,     setExpandedGrupo]     = useState<string | null>(null)
  const [nuevoMiembro,      setNuevoMiembro]      = useState('')
  const [addingMiembro,     setAddingMiembro]     = useState<string | null>(null)
  const [deletingGrupoId,   setDeletingGrupoId]   = useState<string | null>(null)
  const [deletingMiembroId, setDeletingMiembroId] = useState<string | null>(null)

  // Estado modal destinatarios
  const [showDest,       setShowDest]       = useState(false)
  const [nuevoEmail,     setNuevoEmail]     = useState('')
  const [nuevoRol,       setNuevoRol]       = useState('')
  const [addingDest,     setAddingDest]     = useState(false)
  const [errorDest,      setErrorDest]      = useState<string | null>(null)
  const [togglingId,     setTogglingId]     = useState<string | null>(null)
  const [deletingId,     setDeletingId]     = useState<string | null>(null)

  const queryClient = useQueryClient()

  const gruposAdminQ = useQuery({
    queryKey: ['grupos-empresariales'],
    queryFn:  getGruposEmpresariales,
    enabled:  showGrupos,
  })

  const handleAddGrupo = async () => {
    const nombre = nuevoGrupo.trim()
    if (!nombre) { setErrorGrupos('Ingrese un nombre.'); return }
    setAddingGrupo(true); setErrorGrupos(null)
    try {
      await crearGrupoEmpresarial({ nombre, peso: nuevoPeso })
      setNuevoGrupo(''); setNuevoPeso(99)
      queryClient.invalidateQueries({ queryKey: ['grupos-empresariales'] })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErrorGrupos(msg ?? 'No se pudo crear.')
    } finally {
      setAddingGrupo(false)
    }
  }

  const handleDeleteGrupo = async (g: GrupoEmpresarialAPI) => {
    if (!confirm(`¿Eliminar grupo "${g.nombre}" y todos sus miembros?`)) return
    setDeletingGrupoId(g.id)
    try {
      await eliminarGrupoEmpresarial(g.id)
      queryClient.invalidateQueries({ queryKey: ['grupos-empresariales'] })
      queryClient.invalidateQueries({ queryKey: ['cartera-grupos'] })
    } finally {
      setDeletingGrupoId(null)
    }
  }

  const handleToggleGrupoActivo = async (g: GrupoEmpresarialAPI) => {
    try {
      await actualizarGrupoEmpresarial(g.id, { activo: !g.activo })
      queryClient.invalidateQueries({ queryKey: ['grupos-empresariales'] })
    } catch { /* silencioso */ }
  }

  const handleAddMiembro = async (grupoId: string) => {
    const nombre = nuevoMiembro.trim()
    if (!nombre) return
    setAddingMiembro(grupoId)
    try {
      await agregarMiembroGrupo(grupoId, nombre)
      setNuevoMiembro('')
      queryClient.invalidateQueries({ queryKey: ['grupos-empresariales'] })
      queryClient.invalidateQueries({ queryKey: ['cartera-grupos'] })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErrorGrupos(msg ?? 'No se pudo agregar miembro.')
    } finally {
      setAddingMiembro(null)
    }
  }

  const handleDeleteMiembro = async (grupoId: string, miembroId: string, nombre: string) => {
    if (!confirm(`¿Quitar "${nombre}" del grupo?`)) return
    setDeletingMiembroId(miembroId)
    try {
      await eliminarMiembroGrupo(grupoId, miembroId)
      queryClient.invalidateQueries({ queryKey: ['grupos-empresariales'] })
      queryClient.invalidateQueries({ queryKey: ['cartera-grupos'] })
    } finally {
      setDeletingMiembroId(null)
    }
  }

  const destinatariosQ = useQuery({
    queryKey: ['destinatarios-cartera'],
    queryFn:  getDestinatariosCartera,
    enabled:  showDest,
  })

  const handleAddDest = async () => {
    const email = nuevoEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) { setErrorDest('Ingrese un correo válido.'); return }
    setAddingDest(true); setErrorDest(null)
    try {
      await crearDestinatarioCartera({ destinatario: email, rol: nuevoRol.trim() || undefined })
      setNuevoEmail(''); setNuevoRol('')
      queryClient.invalidateQueries({ queryKey: ['destinatarios-cartera'] })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErrorDest(msg ?? 'No se pudo agregar.')
    } finally {
      setAddingDest(false)
    }
  }

  const handleToggleDest = async (d: Destinatario) => {
    setTogglingId(d.id)
    try {
      await toggleDestinatarioCartera(d.id)
      queryClient.invalidateQueries({ queryKey: ['destinatarios-cartera'] })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDeleteDest = async (d: Destinatario) => {
    if (!confirm(`¿Eliminar a ${d.destinatario}?`)) return
    setDeletingId(d.id)
    try {
      await eliminarDestinatarioCartera(d.id)
      queryClient.invalidateQueries({ queryKey: ['destinatarios-cartera'] })
    } finally {
      setDeletingId(null)
    }
  }

  const handleEnviarReporte = async () => {
    setEnviando(true); setEnviado(false); setErrorEnvio(null)
    try {
      await enviarReporteCartera()
      setEnviado(true)
      setTimeout(() => setEnviado(false), 5000)
    } catch {
      setErrorEnvio('No se pudo enviar. Intente de nuevo.')
      setTimeout(() => setErrorEnvio(null), 5000)
    } finally {
      setEnviando(false)
    }
  }

  const carteraQ    = useQuery({ queryKey: ['cartera', filtro],     queryFn: () => getCartera(filtro) })
  const proximosQ   = useQuery({ queryKey: ['proximos'],             queryFn: getProximosVencimientos })
  const regionesQ   = useQuery({ queryKey: ['regiones', filtro],    queryFn: () => getCarteraRegiones(filtro) })
  const anioVentasParam = filtro.fecha_hasta
    ? parseInt(filtro.fecha_hasta.slice(0, 4), 10)
    : new Date().getFullYear()
  const gruposQ = useQuery({
    queryKey: ['grupos', filtro, anioVentasParam],
    queryFn:  () => getCarteraGrupos({ ...filtro, anio_ventas: anioVentasParam }),
  })

  const saldoFavorQ = useQuery({
    queryKey: ['saldo-favor', filtro],
    queryFn:  () => getSaldoFavor(filtro),
    staleTime: 5 * 60 * 1000,
  })

  const asesoresQ = useQuery({
    queryKey: ['asesores', filtro],
    queryFn:  () => getCarteraAsesores(filtro),
    staleTime: 5 * 60 * 1000,
  })

  const toggleSet = (set: Set<string>, key: string) => {
    const s = new Set(set)
    s.has(key) ? s.delete(key) : s.add(key)
    return s
  }

  const aplicarFiltro = () => {
    const f: FiltroFecha = {}
    if (hastaInput) f.fecha_hasta = hastaInput
    setFiltro(f)
    setExpClientes(new Set())
    setExpRegiones(new Set())
    setExpRegionesCiudades(new Set())
    setExpGrupos(new Set())
    setPageCarteraEdades(1)
    setPageProximos(1)
    setPageRegiones(1)
    setBusEdades(''); setBusRegiones(''); setBusLineas(''); setBusSaldo(''); setBusAsesores('')
    setPageLineas(1)
    setPageSaldo(1)
    setExpLineas(new Set())
    setOrdenEdades('az')
    setFiltroRiesgo('todos')
  }

  // Solo datos reales
  const cartera    = carteraQ.data ?? []
  const proximos   = proximosQ.data?.proximos_vencimientos ?? []
  const regiones   = regionesQ.data?.regiones ?? []
  const gruposData      = gruposQ.data
  const grupos          = gruposData?.grupos ?? []             // ordenados por deuda desc (Pareto)
  const gruposPorPeso   = [...grupos].sort((a, b) => a.peso - b.peso)  // para tabla/cards
  const paretoClientes  = gruposData?.pareto_clientes ?? []
  const totalVentas     = gruposData?.total_ventas ?? 0
  const anioVentas      = gruposData?.anio_ventas ?? anioVentasParam


  const saldoFavorClientes: SaldoFavorItem[] = saldoFavorQ.data?.clientes ?? []
  const totalSaldoFavor = saldoFavorQ.data?.total_saldo_favor ?? 0
  const saldoByNit = useMemo(
    () => Object.fromEntries(saldoFavorClientes.map(s => [s.cliente_nit, Number(s.total_saldo_favor)])),
    [saldoFavorClientes]
  )

  // KPIs
  const totalCartera = useMemo(() => cartera.reduce((s, c) => s + c.total_deuda, 0), [cartera])
  const totalVencida = useMemo(() => cartera.reduce((s, c) => s + c.dias_1_30 + c.dias_31_60 + c.dias_61_90 + c.dias_91_180 + c.mas_180_dias, 0), [cartera])
  const criticos90   = useMemo(() => cartera.reduce((s, c) => s + c.dias_91_180 + c.mas_180_dias, 0), [cartera])
  const nCriticos    = useMemo(() => cartera.filter(c => c.dias_91_180 + c.mas_180_dias > 0).length, [cartera])
  const fechaCorte = cartera[0]?.fecha_corte ?? null
  const carteraByNit = useMemo(
    () => Object.fromEntries(cartera.map(c => [c.cliente_nit, c.total_deuda])),
    [cartera]
  )

  // Cartera por edades — con búsqueda, filtro riesgo y orden
  const carteraFiltradaRiesgo = cartera.filter(c => filtroRiesgo === 'todos' || tieneEnBucket(c, filtroRiesgo))
  const carteraFiltradaBus = filtrarPorBusqueda(carteraFiltradaRiesgo, busEdades)
  const carteraFiltrada = ordenEdades === 'az'
    ? [...carteraFiltradaBus].sort((a, b) => (a.cliente_nombre ?? '').localeCompare(b.cliente_nombre ?? '', 'es'))
    : [...carteraFiltradaBus].sort((a, b) => b.total_deuda - a.total_deuda)
  const carteraEdadesPages = totalPages(carteraFiltrada.length)
  const carteraEdadesPageItems = paginate(carteraFiltrada, Math.min(pageCarteraEdades, carteraEdadesPages))

  // Proximos
  const proximosPages = totalPages(proximos.length)
  const proximosPageItems = paginate(proximos, Math.min(pageProximos, proximosPages))

  // Regiones — búsqueda por departamento, ciudad o institución
  const regionesFiltradas = (() => {
    const q = busRegiones.trim().toLowerCase()
    if (!q) return regiones
    return regiones.filter(reg =>
      reg.departamento.toLowerCase().includes(q) ||
      reg.ciudades?.some(c =>
        c.ciudad.toLowerCase().includes(q) ||
        c.clientes?.some(cl =>
          cl.cliente_nombre.toLowerCase().includes(q) ||
          cl.cliente_nit.toLowerCase().includes(q)
        )
      )
    )
  })()
  const regionesPages = totalPages(regionesFiltradas.length)
  const regionesPageItems = paginate(regionesFiltradas, Math.min(pageRegiones, regionesPages))

  const cargando = carteraQ.isLoading || proximosQ.isLoading || regionesQ.isLoading || gruposQ.isLoading
  const actualizandoFiltros = carteraQ.isFetching || proximosQ.isFetching || regionesQ.isFetching || gruposQ.isFetching
  const dataError =
    (carteraQ.error as AxiosError<{ message?: string; error?: string }>) ||
    (proximosQ.error as AxiosError<{ message?: string; error?: string }>) ||
    (regionesQ.error as AxiosError<{ message?: string; error?: string }>) ||
    (gruposQ.error as AxiosError<{ message?: string; error?: string }>)
  const errorMsg =
    dataError?.response?.data?.message ||
    dataError?.response?.data?.error ||
    (dataError ? 'No se pudo consultar la data real de Saint.' : null)

  return (
    <div className="min-h-screen bg-[#f4f6fa]">

      {/* ── HEADER PEGAJOSO ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-primary-950 text-white shadow-lg border-b border-primary-800">
        <div className="px-6 lg:px-10 py-4 flex flex-wrap items-center justify-between gap-3">

          {/* Título */}
          <div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
              INFORME DE CARTERA — GRUPO RP
            </h1>
            {fechaCorte && (
              <span className="text-xs text-white/60 mt-0.5 block">
                Corte: {fechaCorte}
              </span>
            )}
          </div>

          {/* Controles derecha */}
          <div className="flex flex-wrap items-center gap-3">

            {/* Filtro fecha */}
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-2 rounded-xl">
              <Calendar className="h-4 w-4 opacity-60 shrink-0" />
              <label className="text-sm opacity-80 whitespace-nowrap">Fecha de corte</label>
              <input
                type="date" value={hastaInput}
                onChange={e => setHastaInput(e.target.value)}
                className="bg-white/15 text-white text-sm px-2.5 py-1.5 rounded-lg border border-white/25 focus:outline-none focus:ring-1 focus:ring-white/40 w-36"
              />
              <button
                onClick={aplicarFiltro}
                disabled={actualizandoFiltros}
                className="flex items-center gap-1.5 bg-white text-slate-800 font-bold px-4 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {actualizandoFiltros ? <Spinner className="h-4 w-4 text-slate-700" /> : <Search className="h-4 w-4" />}
                {actualizandoFiltros ? 'Actualizando…' : 'Buscar'}
              </button>
            </div>

            {/* Botón enviar reporte + gestionar destinatarios */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1">
                <button
                  onClick={handleEnviarReporte}
                  disabled={enviando}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all shadow-sm whitespace-nowrap ${
                    enviado
                      ? 'bg-emerald-400 text-white shadow-emerald-900/30'
                      : errorEnvio
                        ? 'bg-red-400 text-white'
                        : 'bg-white text-gray-800 hover:bg-gray-100'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {enviando
                    ? <Spinner className="h-4 w-4" />
                    : enviado
                      ? <CheckCircle className="h-4 w-4" />
                      : <Mail className="h-4 w-4" />}
                  {enviando ? 'Enviando…' : enviado ? '¡Enviado!' : 'Enviar reporte'}
                </button>
                {/* Dropdown Configurar */}
                <div className="relative" ref={configMenuRef}>
                  <button
                    onClick={() => setShowConfigMenu(v => !v)}
                    title="Configurar"
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                      showConfigMenu
                        ? 'bg-white/20 border-white/50 text-white'
                        : 'bg-white/10 border-white/40 text-white hover:bg-white/20'
                    }`}
                  >
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Configurar</span>
                  </button>
                  {showConfigMenu && (
                    <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50">
                      <button
                        onClick={() => { setShowDest(true); setShowConfigMenu(false) }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Mail className="h-4 w-4 text-slate-500 shrink-0" />
                        <div className="text-left">
                          <p className="font-semibold">Destinatarios</p>
                          <p className="text-xs text-gray-400">Quién recibe el reporte</p>
                        </div>
                      </button>
                      <button
                        onClick={() => { setShowGrupos(true); setShowConfigMenu(false) }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Building2 className="h-4 w-4 text-slate-500 shrink-0" />
                        <div className="text-left">
                          <p className="font-semibold">Grupos empresariales</p>
                          <p className="text-xs text-gray-400">Agrupación de instituciones</p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {errorEnvio && (
                <span className="text-xs text-red-300 whitespace-nowrap">{errorEnvio}</span>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Modal destinatarios ──────────────────────────────────────────── */}
      {showDest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowDest(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-slate-700" />
                <h2 className="font-bold text-slate-800 text-base">Destinatarios del reporte</h2>
              </div>
              <button onClick={() => setShowDest(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Lista */}
            <div className="px-6 py-4 max-h-72 overflow-y-auto">
              {destinatariosQ.isLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-4 justify-center">
                  <Spinner className="h-4 w-4" /> Cargando…
                </div>
              )}
              {destinatariosQ.isError && (
                <p className="text-sm text-red-600 py-2">Error cargando destinatarios.</p>
              )}
              {destinatariosQ.data && destinatariosQ.data.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">Sin destinatarios registrados.</p>
              )}
              {destinatariosQ.data && destinatariosQ.data.map(d => (
                <div key={d.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${d.activo ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                      {d.destinatario}
                    </p>
                    {d.rol && <p className="text-xs text-gray-400">{d.rol}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <button
                      onClick={() => handleToggleDest(d)}
                      disabled={togglingId === d.id}
                      title={d.activo ? 'Desactivar' : 'Activar'}
                      className="text-gray-400 hover:text-slate-700 transition-colors disabled:opacity-40"
                    >
                      {togglingId === d.id
                        ? <Spinner className="h-5 w-5" />
                        : d.activo
                          ? <ToggleRight className="h-5 w-5 text-emerald-500" />
                          : <ToggleLeft className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={() => handleDeleteDest(d)}
                      disabled={deletingId === d.id}
                      title="Eliminar"
                      className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                    >
                      {deletingId === d.id
                        ? <Spinner className="h-4 w-4" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Agregar */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Agregar destinatario</p>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={nuevoEmail}
                    onChange={e => { setNuevoEmail(e.target.value); setErrorDest(null) }}
                    onKeyDown={e => e.key === 'Enter' && handleAddDest()}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 mb-2"
                  />
                  <input
                    type="text"
                    placeholder="Rol (opcional)"
                    value={nuevoRol}
                    onChange={e => setNuevoRol(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddDest()}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                <button
                  onClick={handleAddDest}
                  disabled={addingDest}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 self-start"
                >
                  {addingDest ? <Spinner className="h-4 w-4 text-white" /> : <UserPlus className="h-4 w-4" />}
                  Agregar
                </button>
              </div>
              {errorDest && <p className="text-xs text-red-600 mt-2">{errorDest}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal grupos empresariales ──────────────────────────────────── */}
      {showGrupos && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowGrupos(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-slate-600" />
                <h2 className="text-base font-semibold text-gray-900">Grupos empresariales</h2>
              </div>
              <button onClick={() => setShowGrupos(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
              {gruposAdminQ.isPending && <p className="text-sm text-gray-500 text-center py-4">Cargando…</p>}
              {gruposAdminQ.isError && <p className="text-sm text-red-600 text-center py-4">Error al cargar grupos.</p>}
              {gruposAdminQ.data?.map(g => (
                <div key={g.id} className={`border rounded-xl overflow-hidden ${g.activo ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
                  {/* Grupo header row */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-50">
                    <button
                      onClick={() => setExpandedGrupo(expandedGrupo === g.id ? null : g.id)}
                      className="flex-1 flex items-center gap-2 text-left"
                    >
                      {expandedGrupo === g.id
                        ? <ChevronUp className="h-4 w-4 text-gray-400" />
                        : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      <span className="font-medium text-sm text-gray-800">{g.nombre}</span>
                      <span className="text-xs text-gray-400 ml-1">({g.miembros.length} miembros)</span>
                    </button>
                    <button
                      onClick={() => handleToggleGrupoActivo(g)}
                      title={g.activo ? 'Desactivar' : 'Activar'}
                      className="text-gray-400 hover:text-slate-600"
                    >
                      {g.activo
                        ? <ToggleRight className="h-5 w-5 text-green-500" />
                        : <ToggleLeft className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={() => handleDeleteGrupo(g)}
                      disabled={deletingGrupoId === g.id}
                      className="text-gray-400 hover:text-red-500 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Miembros expandibles */}
                  {expandedGrupo === g.id && (
                    <div className="px-4 pb-3 pt-2 space-y-1">
                      {g.miembros.map(m => (
                        <div key={m.id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                          <span className="flex-1 text-xs text-gray-700">{m.nombre_cliente}</span>
                          <button
                            onClick={() => handleDeleteMiembro(g.id, m.id, m.nombre_cliente)}
                            disabled={deletingMiembroId === m.id}
                            className="text-gray-300 hover:text-red-400 disabled:opacity-40"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {g.miembros.length === 0 && (
                        <p className="text-xs text-gray-400 py-1">Sin miembros.</p>
                      )}
                      {/* Agregar miembro */}
                      <div className="flex gap-2 pt-2">
                        <input
                          type="text"
                          placeholder="Nombre en Saint (exacto)"
                          value={expandedGrupo === g.id ? nuevoMiembro : ''}
                          onChange={e => setNuevoMiembro(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddMiembro(g.id)}
                          className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                        />
                        <button
                          onClick={() => handleAddMiembro(g.id)}
                          disabled={addingMiembro === g.id}
                          className="text-xs bg-slate-700 text-white px-3 py-1 rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1"
                        >
                          {addingMiembro === g.id ? <Spinner className="h-3 w-3 text-white" /> : <UserPlus className="h-3 w-3" />}
                          Agregar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {errorGrupos && <p className="text-xs text-red-600 mt-1">{errorGrupos}</p>}
            </div>

            {/* Footer: nuevo grupo */}
            <div className="border-t border-gray-100 px-6 py-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Nuevo grupo</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nombre del grupo"
                  value={nuevoGrupo}
                  onChange={e => { setNuevoGrupo(e.target.value); setErrorGrupos(null) }}
                  onKeyDown={e => e.key === 'Enter' && handleAddGrupo()}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                <input
                  type="number"
                  min={1}
                  max={99}
                  placeholder="Orden"
                  value={nuevoPeso}
                  onChange={e => setNuevoPeso(Number(e.target.value))}
                  className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                <button
                  onClick={handleAddGrupo}
                  disabled={addingGrupo}
                  className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {addingGrupo ? <Spinner className="h-4 w-4 text-white" /> : <Building2 className="h-4 w-4" />}
                  Crear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cargando && (
        <div className="px-6 lg:px-10 pt-6">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 flex items-center gap-2">
            <Spinner className="h-4 w-4" /> Consultando datos...
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="px-6 lg:px-10 pt-6">
          <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 text-sm text-red-800">
            <p className="font-bold">Error consultando cartera</p>
            <p className="mt-1">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 px-6 lg:px-10 py-6">
        <KPICard label="Total Cartera"
          value={fmt(totalCartera)}
          sub={totalSaldoFavor > 0
            ? (<>
                <p>Valor Anticipos: {fmt(totalSaldoFavor)}</p>
                <p>Total Cartera - Anticipos: {fmt(totalCartera - totalSaldoFavor)}</p>
              </>)
            : `${cartera.length} clientes activos`}
          gradient="from-indigo-600 to-indigo-800"
          icon={<Wallet className="h-20 w-20" />} />
        <KPICard label="Cartera Vencida"
          value={fmt(totalVencida)}
          sub={`${totalCartera > 0 ? fmtPct((totalVencida/totalCartera)*100) : '0%'} del Total Cartera`}
          gradient="from-red-700 to-red-900"
          icon={<AlertTriangle className="h-20 w-20" />} />
        <KPICard label="Mora +90 Días"
          value={fmt(criticos90)}
          sub={`${nCriticos} cliente${nCriticos !== 1 ? 's' : ''} en mora crítica`}
          gradient="from-rose-800 to-rose-950"
          icon={<ShieldAlert className="h-20 w-20" />} />
      </div>



      {/* Alerta crítica — oculta por ahora */}

      {cartera.length > 0 && (
        <div className="space-y-10 px-6 lg:px-10 pb-16">

          {/* ══════════════════════════════════════════════════════════════
              SECCIÓN — GRUPOS EMPRESARIALES
          ══════════════════════════════════════════════════════════════ */}
          {(grupos.length > 0 || gruposQ.isLoading) && (
          <section id="sec-grupos" className="bg-white rounded-2xl shadow-sm p-7">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <SectionHeader
                icon={<UserCheck className="h-7 w-7" />}
                title="CARTERA POR GRUPO"
                color="indigo"
              />
              {totalVentas > 0 && (
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-500 font-medium">Ventas {anioVentas}</p>
                  <p className="text-lg font-extrabold text-emerald-700">{fmtM(totalVentas)}</p>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-gray-200">
              {([
                { key: 'pareto',  label: 'PARETO' },
                { key: 'detalle', label: 'DETALLE POR GRUPO' },
                { key: 'edades',  label: 'EDADES DE CARTERA' },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setTabGrupos(t.key)}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                    tabGrupos === t.key
                      ? 'border-indigo-600 text-indigo-700 bg-indigo-50'
                      : 'border-transparent text-gray-900 hover:text-gray-700'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {gruposQ.isLoading && (
              <div className="flex justify-center py-8"><Spinner className="h-10 w-10" /></div>
            )}

            {/* ─── TAB: PARETO & RENTABILIDAD ─────────────────────────── */}
            {tabGrupos === 'pareto' && grupos.length > 0 && (() => {
              // Datos macro: grupos ya vienen ordenados por deuda desc (Pareto)
              const macroData = grupos.map(g => ({
                ...g,
                nombre_corto: g.grupo.replace('Grupo ', ''),
              }))
              // Datos micro: top 30 clientes
              const microData = paretoClientes.slice(0, 30).map(c => ({
                ...c,
                nombre_corto: (() => {
                  const words = (c.cliente_nombre || '').split(' ')
                  const short = words.slice(0, 2).join(' ')
                  return short.length > 16 ? short.slice(0, 15) + '…' : short
                })(),
              }))
              const clientesEn80 = paretoClientes.filter(c => c.porcentaje_acumulado <= 80).length + 1
              return (
                <div>
                  {/* KPIs */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                    <div className="bg-indigo-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-900 font-bold uppercase tracking-wide">Total Cartera Grupos</p>
                      <p className="text-sm font-extrabold text-gray-900 tabular-nums">
                        {fmt(totalCartera)}
                      </p>
                    </div>
                    {totalVentas > 0 && (
                      <div className="bg-emerald-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-500 font-medium">Ventas {anioVentas}</p>
                        <p className="text-sm font-extrabold text-emerald-700 tabular-nums">{fmt(totalVentas)}</p>
                      </div>
                    )}
                    <div className="bg-red-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-900 font-bold uppercase tracking-wide leading-tight">GRUPOS<br />MORA + 90 DÍAS</p>
                      <p className="text-sm font-extrabold text-gray-900 tabular-nums">
                        {fmt(grupos.reduce((s, g) => s + g.mora_90, 0))}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Macro / Micro */}
                  <div className="flex gap-2 mb-5">
                    {([
                      { key: 'macro', label: 'VISTA POR GRUPO' },
                      { key: 'micro', label: 'VISTA POR CLIENTE' },
                    ] as const).map(v => (
                      <button key={v.key} onClick={() => { setVistaPareto(v.key); setPageMicro(1) }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                          vistaPareto === v.key
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-900 border-gray-300 hover:border-indigo-400'
                        }`}>
                        {v.label}
                      </button>
                    ))}
                  </div>

                  {/* ── Macro ── */}
                  {vistaPareto === 'macro' && (
                    <div>
                      <div className="mb-1 text-xs text-gray-400 text-right">
                        Barras = cartera · Línea = % acumulado · Referencia = 80%
                      </div>
                      <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart data={macroData} margin={{ top: 10, right: 55, left: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="nombre_corto" tick={{ fontSize: 13, fontWeight: 700 }} />
                          <YAxis yAxisId="left" tickFormatter={v => fmtM(Number(v))} tick={{ fontSize: 12 }} width={82} />
                          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} width={50} />
                          <RTooltip content={<GrupoParetoTooltip />} />
                          <ReferenceLine yAxisId="right" y={80} stroke="#1a1a2e" strokeDasharray="6 3" strokeWidth={2}
                            label={{ value: '80%', position: 'insideRight', fontSize: 12, fill: '#1a1a2e', fontWeight: 700 }} />
                          <Bar yAxisId="left" dataKey="total_deuda" radius={[5, 5, 0, 0]} maxBarSize={72} name="Cartera">
                            {macroData.map((g, i) => <Cell key={i} fill={grupoColor(g.grupo)} />)}
                          </Bar>
                          <Line yAxisId="right" type="monotone" dataKey="porcentaje_acumulado"
                            stroke="#1a1a2e" strokeWidth={3}
                            dot={{ r: 5, fill: '#1a1a2e', strokeWidth: 0 }} activeDot={{ r: 7 }}
                            name="% Acumulado" />
                        </ComposedChart>
                      </ResponsiveContainer>

                      {/* Leyenda de colores */}
                      <div className="flex flex-wrap gap-3 mt-2 mb-5 text-xs font-semibold">
                        {gruposPorPeso.map(g => (
                          <span key={g.grupo} className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: grupoColor(g.grupo) }} />
                            {g.grupo}
                          </span>
                        ))}
                      </div>

                      {/* Tabla rentabilidad macro */}
                      <div className="overflow-x-auto rounded-xl border border-indigo-200">
                        <table className="w-full text-sm">
                          <thead className="bg-[#1a1a2e] text-white text-xs">
                            <tr>
                              <th className="px-4 py-2.5 text-left">Grupo</th>
                              <th className="px-4 py-2.5 text-right">Cartera</th>
                              {totalVentas > 0 && <th className="px-4 py-2.5 text-right">Ventas {anioVentas}</th>}
                              {totalVentas > 0 && <th className="px-4 py-2.5 text-right" title="Días promedio de cobranza (DSO)">Días cob.</th>}
                              <th className="px-4 py-2.5 text-right">% total</th>
                              <th className="px-4 py-2.5 text-right">% Acum.</th>
                              <th className="px-4 py-2.5 text-right">Mora +90d</th>
                              <th className="px-4 py-2.5 text-center">Clientes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {gruposPorPeso.map(g => {
                              const esOtros = g.grupo === 'Otros'
                              return (
                                <tr key={g.grupo} className={`border-t border-gray-100 ${esOtros ? 'bg-slate-50 text-gray-400' : 'hover:bg-indigo-50'}`}>
                                  <td className="px-4 py-2.5">
                                    <span className="inline-flex items-center gap-2 font-semibold">
                                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: grupoColor(g.grupo) }} />
                                      {g.grupo}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-extrabold text-[#0f3460]">{fmtM(g.total_deuda)}</td>
                                  {totalVentas > 0 && <td className="px-4 py-2.5 text-right text-emerald-700 font-semibold">{g.ventas_anio > 0 ? fmtM(g.ventas_anio) : <span className="text-gray-300">—</span>}</td>}
                                  {totalVentas > 0 && <td className="px-4 py-2.5 text-right">
                                    {g.dias_cartera != null
                                      ? <span className={`font-bold ${g.dias_cartera > 180 ? 'text-red-700' : g.dias_cartera > 90 ? 'text-orange-600' : 'text-green-700'}`}>{g.dias_cartera}d</span>
                                      : <span className="text-gray-300">—</span>}
                                  </td>}
                                  <td className="px-4 py-2.5 text-right font-bold text-gray-700">{g.porcentaje}%</td>
                                  <td className="px-4 py-2.5 text-right font-bold text-purple-700">{g.porcentaje_acumulado}%</td>
                                  <td className="px-4 py-2.5 text-right font-bold text-red-700">{g.mora_90 > 0 ? fmtM(g.mora_90) : <span className="text-green-600 text-xs">Al día</span>}</td>
                                  <td className="px-4 py-2.5 text-center text-gray-500">{g.clientes_count}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot className="bg-gray-100 border-t-2 border-gray-300 text-xs font-bold">
                            <tr>
                              <td className="px-4 py-2.5 text-gray-700">TOTAL</td>
                              <td className="px-4 py-2.5 text-right text-slate-800">{fmtM(grupos.reduce((s, g) => s + g.total_deuda, 0))}</td>
                              {totalVentas > 0 && <td className="px-4 py-2.5 text-right text-emerald-700">{fmtM(totalVentas)}</td>}
                              {totalVentas > 0 && <td colSpan={2} />}
                              <td className="px-4 py-2.5 text-center text-gray-600">100%</td>
                              <td />
                              <td className="px-4 py-2.5 text-right text-red-900">{fmtM(grupos.reduce((s, g) => s + g.mora_90, 0))}</td>
                              <td className="px-4 py-2.5 text-center text-gray-600">{grupos.reduce((s, g) => s + g.clientes_count, 0)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ── Micro ── */}
                  {vistaPareto === 'micro' && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">Top {microData.length} clientes por cartera — coloreados por grupo</span>
                        <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          {clientesEn80} clientes concentran el 80% de la deuda
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={320}>
                        <ComposedChart data={microData} margin={{ top: 10, right: 55, left: 10, bottom: 70 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="nombre_corto" tick={{ fontSize: 11, fontWeight: 600 }}
                            angle={-40} textAnchor="end" height={80} interval={0} />
                          <YAxis yAxisId="left" tickFormatter={v => fmtM(Number(v))} tick={{ fontSize: 11 }} width={82} />
                          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} width={50} />
                          <RTooltip content={<ClienteParetoTooltip />} />
                          <ReferenceLine yAxisId="right" y={80} stroke="#1a1a2e" strokeDasharray="6 3" strokeWidth={2}
                            label={{ value: '80%', position: 'insideRight', fontSize: 12, fill: '#1a1a2e', fontWeight: 700 }} />
                          <Bar yAxisId="left" dataKey="total_deuda" radius={[4, 4, 0, 0]} maxBarSize={32} name="Cartera">
                            {microData.map((c, i) => <Cell key={i} fill={grupoColor(c.grupo)} />)}
                          </Bar>
                          <Line yAxisId="right" type="monotone" dataKey="porcentaje_acumulado"
                            stroke="#1a1a2e" strokeWidth={2.5}
                            dot={{ r: 3, fill: '#1a1a2e', strokeWidth: 0 }} activeDot={{ r: 5 }}
                            name="% Acumulado" />
                        </ComposedChart>
                      </ResponsiveContainer>

                      {/* Tabla micro */}
                      {(() => {
                        const microPages = totalPages(paretoClientes.length)
                        const microItems = paginate(paretoClientes, pageMicro)
                        const microOffset = (pageMicro - 1) * PAGE_SIZE
                        return (
                          <div className="rounded-xl border border-indigo-200 mt-4 overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-[#1a1a2e] text-white text-xs">
                                  <tr>
                                    <th className="px-3 py-2.5 text-right w-8">#</th>
                                    <th className="px-4 py-2.5 text-left">Cliente</th>
                                    <th className="px-4 py-2.5 text-left">Grupo</th>
                                    <th className="px-4 py-2.5 text-left">Ciudad</th>
                                    <th className="px-4 py-2.5 text-right">Cartera</th>
                                    <th className="px-4 py-2.5 text-right">Anticipo</th>
                                    {totalVentas > 0 && <th className="px-4 py-2.5 text-right">Ventas</th>}
                                    {totalVentas > 0 && <th className="px-4 py-2.5 text-right" title="Días de cobranza">Días cob.</th>}
                                    <th className="px-4 py-2.5 text-right">Mora +90d</th>
                                    <th className="px-4 py-2.5 text-right">%</th>
                                    <th className="px-4 py-2.5 text-right">% Acum.</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {microItems.map((c, i) => {
                                    const globalIdx = microOffset + i
                                    return (
                                      <tr key={`${c.cliente_nit}-${globalIdx}`}
                                        className="border-t border-gray-100 hover:bg-indigo-50 transition-colors">
                                        <td className="px-3 py-2 text-right text-gray-400 font-mono text-xs">{globalIdx + 1}</td>
                                        <td className="px-4 py-2 font-semibold text-gray-900 max-w-[200px] truncate">{c.cliente_nombre}</td>
                                        <td className="px-4 py-2">
                                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: grupoColor(c.grupo) }}>
                                            <span className="w-2 h-2 rounded-full" style={{ background: grupoColor(c.grupo) }} />
                                            {c.grupo.replace('Grupo ', '')}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2 text-gray-500 text-xs">{c.ciudad || '—'}</td>
                                        <td className="px-4 py-2 text-right font-extrabold text-[#0f3460]">{fmtM(c.total_deuda)}</td>
                                        <td className="px-4 py-2 text-right text-emerald-700 font-semibold">
                                          {(saldoByNit[c.cliente_nit] ?? 0) > 0 ? fmtM(saldoByNit[c.cliente_nit]) : <span className="text-gray-300">—</span>}
                                        </td>
                                        {totalVentas > 0 && <td className="px-4 py-2 text-right text-emerald-700">{c.ventas_anio > 0 ? fmtM(c.ventas_anio) : <span className="text-gray-300">—</span>}</td>}
                                        {totalVentas > 0 && <td className="px-4 py-2 text-right">
                                          {c.dias_cartera != null
                                            ? <span className={`font-bold text-xs ${c.dias_cartera > 180 ? 'text-red-700' : c.dias_cartera > 90 ? 'text-orange-600' : 'text-green-700'}`}>{c.dias_cartera}d</span>
                                            : <span className="text-gray-300">—</span>}
                                        </td>}
                                        <td className="px-4 py-2 text-right font-bold text-red-700">{c.mora_90 > 0 ? fmtM(c.mora_90) : <span className="text-green-600 text-xs">—</span>}</td>
                                        <td className="px-4 py-2 text-right text-gray-600 text-xs">{c.porcentaje}%</td>
                                        <td className="px-4 py-2 text-right font-bold text-purple-700">{c.porcentaje_acumulado}%</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                            {microPages > 1 && (
                              <div className="px-5 py-2 bg-indigo-50 border-t border-indigo-100">
                                <PaginationControls
                                  page={pageMicro}
                                  pages={microPages}
                                  onChange={setPageMicro}
                                />
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* ─── TAB: DETALLE POR GRUPO ──────────────────────────────── */}
            {tabGrupos === 'detalle' && (
              <div className="space-y-4">
                {gruposPorPeso.map((g: GrupoAgregado) => {
                  const isOpen = expGrupos.has(g.grupo)
                  const esOtros = g.grupo === 'Otros'
                  const pctVenc = g.total_deuda > 0 ? (g.total_vencida / g.total_deuda) * 100 : 0
                  const badgeVenc = pctVenc > 60 ? 'bg-red-100 text-red-800' : pctVenc > 30 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                  const headerBg = esOtros ? 'bg-slate-50' : 'bg-indigo-50'
                  const borderColor = esOtros ? 'border-slate-200' : 'border-indigo-200'

                  return (
                    <div key={g.grupo} className={`border ${borderColor} rounded-2xl overflow-hidden shadow-sm`}>
                      <button onClick={() => setExpGrupos(prev => toggleSet(prev, g.grupo))} className="w-full text-left">
                        <div className={`flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-3 px-5 py-4 ${headerBg} hover:opacity-90 transition-colors`}>
                          {isOpen
                            ? <ChevronDown className="h-5 w-5 shrink-0" style={{ color: grupoColor(g.grupo) }} />
                            : <ChevronRight className="h-5 w-5 shrink-0" style={{ color: grupoColor(g.grupo) }} />}
                          <div className="flex-1 min-w-0">
                            <p className="text-lg sm:text-xl font-extrabold text-gray-900 flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: grupoColor(g.grupo) }} />
                              {g.grupo}
                            </p>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {g.clientes_count} {g.clientes_count === 1 ? 'cliente' : 'clientes'}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full sm:w-auto sm:min-w-[440px]">
                            <div className="text-right bg-white rounded-lg px-2 py-1.5">
                              <p className="text-xs text-gray-500 font-medium">Total cartera</p>
                              <p className="text-xl font-extrabold text-[#0f3460]">{fmtM(g.total_deuda)}</p>
                            </div>
                            <div className="text-right bg-white rounded-lg px-2 py-1.5">
                              <p className="text-xs text-gray-500 font-medium">Mora +90d</p>
                              <p className={`text-lg font-bold ${g.mora_90 > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                {g.mora_90 > 0 ? fmtM(g.mora_90) : 'Al día'}
                              </p>
                            </div>
                            <div className="text-right bg-white rounded-lg px-2 py-1.5">
                              <p className="text-xs text-gray-500 font-medium">% Vencida</p>
                              <span className={`px-2.5 py-1 rounded-full text-sm font-bold ${badgeVenc}`}>
                                {pctVenc.toFixed(1)}%
                              </span>
                            </div>
                            <div className="text-right bg-white rounded-lg px-2 py-1.5">
                              <p className="text-xs text-gray-500 font-medium">% del total</p>
                              <p className="text-base font-bold text-gray-700">{g.porcentaje}%</p>
                            </div>
                          </div>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-indigo-200 bg-white">
                          <div className="px-5 py-3 bg-indigo-100 flex items-center justify-between">
                            <span className="text-sm font-bold text-indigo-800 uppercase tracking-wide">
                              CLIENTES — {g.grupo.toUpperCase()}
                            </span>
                            <span className="text-xs text-indigo-600 font-semibold">Mayor a menor deuda</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-indigo-200 text-indigo-900">
                                <tr>
                                  <th className="px-5 py-2 text-left w-8">#</th>
                                  <th className="px-4 py-2 text-left">Cliente</th>
                                  <th className="px-4 py-2 text-left">NIT</th>
                                  <th className="px-4 py-2 text-left">Ciudad</th>
                                  <th className="px-4 py-2 text-right">Cartera</th>
                                  <th className="px-4 py-2 text-right">Vigente</th>
                                  <th className="px-4 py-2 text-right">Vencida</th>
                                  <th className="px-4 py-2 text-right">+90d</th>
                                  {totalVentas > 0 && <th className="px-4 py-2 text-right">Ventas</th>}
                                  {totalVentas > 0 && <th className="px-4 py-2 text-right" title="Días de cobranza">Días cob.</th>}
                                  <th className="px-4 py-2 text-center">Mora máx.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(g.clientes ?? []).map((cl, ci) => (
                                  <tr key={cl.cliente_nit} className="border-t border-indigo-100 hover:bg-indigo-50 transition-colors">
                                    <td className="px-5 py-3 text-gray-400 font-mono text-xs">{ci + 1}</td>
                                    <td className="px-4 py-3 font-semibold text-gray-900">{cl.cliente_nombre}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{cl.cliente_nit}</td>
                                    <td className="px-4 py-3 text-gray-600">{cl.ciudad || '—'}</td>
                                    <td className="px-4 py-3 text-right font-extrabold text-[#0f3460]">{fmtM(cl.total_deuda)}</td>
                                    <td className="px-4 py-3 text-right text-green-700 font-semibold">{fmtM(cl.vigente)}</td>
                                    <td className="px-4 py-3 text-right text-orange-600 font-semibold">{fmtM(cl.total_vencida)}</td>
                                    <td className="px-4 py-3 text-right text-red-900 font-bold">{fmtM(cl.mora_90)}</td>
                                    {totalVentas > 0 && <td className="px-4 py-3 text-right text-emerald-700">{cl.ventas_anio > 0 ? fmtM(cl.ventas_anio) : <span className="text-gray-300 text-xs">—</span>}</td>}
                                    {totalVentas > 0 && <td className="px-4 py-3 text-right">
                                      {cl.dias_cartera != null
                                        ? <span className={`font-bold text-xs ${cl.dias_cartera > 180 ? 'text-red-700' : cl.dias_cartera > 90 ? 'text-orange-600' : 'text-green-700'}`}>{cl.dias_cartera}d</span>
                                        : <span className="text-gray-300 text-xs">—</span>}
                                    </td>}
                                    <td className="px-4 py-3 text-center">
                                      {cl.dias_mora_max > 0
                                        ? <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold">{cl.dias_mora_max}d</span>
                                        : <span className="text-green-600 text-xs font-semibold">Al día</span>
                                      }
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-indigo-200 border-t-2 border-indigo-300">
                                <tr>
                                  <td colSpan={4} className="px-5 py-2 font-bold text-indigo-900 text-xs uppercase">
                                    Total {g.grupo} · {g.clientes_count} clientes
                                  </td>
                                  <td className="px-4 py-2 text-right font-extrabold text-[#0f3460]">{fmtM(g.total_deuda)}</td>
                                  <td className="px-4 py-2 text-right text-green-800 font-bold">{fmtM(g.vigente)}</td>
                                  <td className="px-4 py-2 text-right text-orange-700 font-bold">{fmtM(g.total_vencida)}</td>
                                  <td className="px-4 py-2 text-right text-red-900 font-bold">{fmtM(g.mora_90)}</td>
                                  {totalVentas > 0 && <td className="px-4 py-2 text-right text-emerald-700 font-bold">{g.ventas_anio > 0 ? fmtM(g.ventas_anio) : ''}</td>}
                                  {totalVentas > 0 && <td />}
                                  <td />
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ─── TAB: EDADES DE CARTERA ──────────────────────────────── */}
            {tabGrupos === 'edades' && (
              <div className="border border-indigo-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#1a1a2e] text-white text-xs">
                      <tr>
                        <th className="px-4 py-2.5 text-left">Grupo</th>
                        <th className="px-4 py-2.5 text-right">Total</th>
                        <th className="px-4 py-2.5 text-right">Vigente</th>
                        <th className="px-4 py-2.5 text-right">1–30d</th>
                        <th className="px-4 py-2.5 text-right">31–60d</th>
                        <th className="px-4 py-2.5 text-right">61–90d</th>
                        <th className="px-4 py-2.5 text-right">+90d</th>
                        <th className="px-4 py-2.5 text-center">% total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gruposPorPeso.map((g: GrupoAgregado) => (
                        <tr key={g.grupo} className={`border-t border-gray-100 ${g.grupo === 'Otros' ? 'bg-slate-50 text-gray-500' : 'hover:bg-indigo-50'}`}>
                          <td className="px-4 py-2.5 font-semibold flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: grupoColor(g.grupo) }} />
                            {g.grupo}
                          </td>
                          <td className="px-4 py-2.5 text-right font-extrabold text-[#0f3460]">{fmtM(g.total_deuda)}</td>
                          <td className="px-4 py-2.5 text-right text-green-700 font-semibold">{fmtM(g.vigente)}</td>
                          <td className="px-4 py-2.5 text-right text-blue-600">{fmtM(g.dias_1_30)}</td>
                          <td className="px-4 py-2.5 text-right text-yellow-700">{fmtM(g.dias_31_60)}</td>
                          <td className="px-4 py-2.5 text-right text-orange-600">{fmtM(g.dias_61_90)}</td>
                          <td className="px-4 py-2.5 text-right text-red-800 font-bold">{fmtM(g.dias_91_mas)}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-gray-700">{g.porcentaje}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100 border-t-2 border-gray-300 text-xs font-bold">
                      <tr>
                        <td className="px-4 py-2.5 text-gray-700">TOTAL GENERAL</td>
                        <td className="px-4 py-2.5 text-right text-slate-800">{fmtM(grupos.reduce((s, g) => s + g.total_deuda, 0))}</td>
                        <td className="px-4 py-2.5 text-right text-green-800">{fmtM(grupos.reduce((s, g) => s + g.vigente, 0))}</td>
                        <td className="px-4 py-2.5 text-right text-blue-700">{fmtM(grupos.reduce((s, g) => s + g.dias_1_30, 0))}</td>
                        <td className="px-4 py-2.5 text-right text-yellow-800">{fmtM(grupos.reduce((s, g) => s + g.dias_31_60, 0))}</td>
                        <td className="px-4 py-2.5 text-right text-orange-700">{fmtM(grupos.reduce((s, g) => s + g.dias_61_90, 0))}</td>
                        <td className="px-4 py-2.5 text-right text-red-900">{fmtM(grupos.reduce((s, g) => s + g.dias_91_mas, 0))}</td>
                        <td className="px-4 py-2.5 text-center text-gray-700">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </section>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SECCIÓN 1 — CARTERA POR EDADES
          ══════════════════════════════════════════════════════════════ */}
          <section id="sec-edades" className="bg-white rounded-2xl shadow-sm p-7">
            <SectionHeader
              icon={<Wallet className="h-7 w-7" />}
              title="CARTERA POR EDADES"
              count={`${cartera.length} clientes`}
              color="blue"
            />

            <BuscarInput value={busEdades} onChange={v => { setBusEdades(v); setPageCarteraEdades(1) }} />

            {/* Pills de filtro rápido */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { key: 'todos',   label: 'Todos',    cls: 'bg-slate-700 text-white',          act: 'bg-slate-700 text-white ring-2 ring-slate-400' },
                { key: 'critico', label: 'Críticos', cls: 'bg-red-100 text-red-800 border border-red-300',        act: 'bg-red-600 text-white ring-2 ring-red-400' },
                { key: 'alto',    label: 'Altos',    cls: 'bg-orange-100 text-orange-800 border border-orange-300',act: 'bg-orange-500 text-white ring-2 ring-orange-400' },
                { key: 'medio',   label: 'Medios',   cls: 'bg-yellow-100 text-yellow-800 border border-yellow-300',act: 'bg-yellow-500 text-white ring-2 ring-yellow-400' },
                { key: 'leve',    label: '1–30d',    cls: 'bg-blue-100 text-blue-800 border border-blue-300',     act: 'bg-blue-600 text-white ring-2 ring-blue-400' },
                { key: 'ok',      label: 'Sin mora', cls: 'bg-green-100 text-green-800 border border-green-300',  act: 'bg-green-600 text-white ring-2 ring-green-400' },
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => { setFiltroRiesgo(p.key); setPageCarteraEdades(1) }}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${filtroRiesgo === p.key ? p.act : p.cls + ' hover:opacity-80'}`}
                >
                  {p.label}
                  {p.key !== 'todos' && (
                    <span className="ml-1.5 opacity-75">
                      ({cartera.filter(c => tieneEnBucket(c, p.key)).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Orden */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-600 font-semibold">Ordenar:</span>
              {(['az', 'deuda'] as const).map(o => (
                <button
                  key={o}
                  onClick={() => { setOrdenEdades(o); setPageCarteraEdades(1) }}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${ordenEdades === o ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                >
                  {o === 'az' ? 'A–Z' : 'Mayor deuda'}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-base table-fixed">
                <thead className="bg-[#1a1a2e] text-white text-sm">
                  <tr>
                    <th className="px-3 py-3 text-left w-10">#</th>
                    <th className="px-3 py-3 text-left w-[22%]">Cliente</th>
                    <th className="px-3 py-3 text-left w-[10%]">Ciudad</th>
                    <th className="px-3 py-3 text-right w-[11%]">Anticipo</th>
                    <th className="px-3 py-3 text-right w-[12%]">Total cartera</th>
                    <th className="px-3 py-3 text-right w-[12%]">Neto</th>
                    {filtroRiesgo !== 'ok' && <th className="px-3 py-3 text-right w-[11%]">Vencida</th>}
                    {filtroRiesgo !== 'ok' && <th className="px-3 py-3 text-right w-[10%]">+90d</th>}
                    <th className="px-3 py-3 text-center w-[12%]">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {carteraEdadesPageItems.map((c, idx) => {
                    const nivel  = nivelRiesgo(c)
                    const isOpen = expClientes.has(c.cliente_nit)
                    const mas90  = c.dias_91_180 + c.mas_180_dias
                    const vencida = c.dias_1_30 + c.dias_31_60 + c.dias_61_90 + mas90
                    return (
                      <Fragment key={c.id}>
                        <tr
                          onClick={() => setExpClientes(prev => toggleSet(prev, c.cliente_nit))}
                          className={`${rowBgCls(nivel)} hover:bg-blue-50 cursor-pointer border-b border-gray-100 transition-colors`}
                        >
                           <td className="px-3 py-4 text-gray-400 font-mono text-sm">{(Math.min(pageCarteraEdades, carteraEdadesPages) - 1) * PAGE_SIZE + idx + 1}</td>
                          <td className="px-3 py-4 font-semibold align-top">
                            <div className="flex items-center gap-2">
                              {isOpen
                                ? <ChevronDown className="h-5 w-5 text-[#0f3460] shrink-0" />
                                : <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />}
                              <span className="text-sm font-bold leading-snug" title={c.cliente_nombre}>
                                {c.cliente_nombre}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500 mt-1 ml-7 font-mono tracking-wide"><span className="font-bold text-gray-400 not-italic mr-1">NIT</span>{c.cliente_nit}</div>
                          </td>
                          <td className="px-3 py-4 text-gray-600 align-top">{c.ciudad || '—'}</td>
                          <td className="px-3 py-4 text-right whitespace-nowrap align-top">
                            {saldoByNit[c.cliente_nit]
                              ? <span className="font-bold text-emerald-600">{fmtM(saldoByNit[c.cliente_nit])}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-4 text-right whitespace-nowrap align-top">
                            <span className="font-extrabold text-[#0f3460]">
                              {filtroRiesgo === 'ok' ? fmtM(c.vigente) : fmtM(c.total_deuda)}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-right whitespace-nowrap align-top">
                            {(() => {
                              const anticipo = saldoByNit[c.cliente_nit] ?? 0
                              const base = filtroRiesgo === 'ok' ? c.vigente : c.total_deuda
                              const neto = base - anticipo
                              return neto < 0
                                ? <span className="font-bold text-green-600">{fmtM(neto)}</span>
                                : <span className="font-bold text-gray-800">{fmtM(neto)}</span>
                            })()}
                          </td>
                          {filtroRiesgo !== 'ok' && (
                            <td className="px-3 py-4 text-right whitespace-nowrap align-top">
                              <TooltipVencida b={c} vencida={vencida} />
                            </td>
                          )}
                          {filtroRiesgo !== 'ok' && (
                            <td className="px-3 py-4 text-right text-red-900 font-bold whitespace-nowrap align-top">
                              {fmtM(mas90)}
                            </td>
                          )}
                          <td className="px-3 py-4 text-center align-top">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeCls(nivel)}`}>
                              {nivel.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                        {isOpen && <FilaFacturas nit={c.cliente_nit} cols={filtroRiesgo === 'ok' ? 7 : 9} filtro={filtro} soloVigente={filtroRiesgo === 'ok'} />}
                      </Fragment>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                   {(() => {
                     const fil = carteraFiltrada
                     return (
                      <tr>
                        <td colSpan={3} className="px-3 py-3 font-bold text-gray-700">
                          TOTALES {filtroRiesgo !== 'todos' && `(${fil.length} clientes filtrados)`}
                        </td>
                        <td className="px-3 py-3 text-right font-extrabold text-emerald-600">
                          {fmtM(fil.reduce((s,c)=>s+(saldoByNit[c.cliente_nit]??0),0))}
                        </td>
                        <td className="px-3 py-3 text-right font-extrabold text-slate-800">
                          {fmtM(filtroRiesgo === 'ok'
                            ? fil.reduce((s,c)=>s+c.vigente,0)
                            : fil.reduce((s,c)=>s+c.total_deuda,0))}
                        </td>
                        <td className="px-3 py-3 text-right font-extrabold text-gray-800">
                          {fmtM(fil.reduce((s,c)=>{
                            const base = filtroRiesgo === 'ok' ? c.vigente : c.total_deuda
                            return s + base - (saldoByNit[c.cliente_nit] ?? 0)
                          }, 0))}
                        </td>
                        {filtroRiesgo !== 'ok' && (() => {
                          const tb: VBuckets = {
                            dias_1_30:    fil.reduce((s,c)=>s+c.dias_1_30,0),
                            dias_31_60:   fil.reduce((s,c)=>s+c.dias_31_60,0),
                            dias_61_90:   fil.reduce((s,c)=>s+c.dias_61_90,0),
                            dias_91_180:  fil.reduce((s,c)=>s+c.dias_91_180,0),
                            mas_180_dias: fil.reduce((s,c)=>s+c.mas_180_dias,0),
                          }
                          return <>
                            <td className="px-3 py-3 text-right font-bold">
                              <TooltipVencida b={tb} vencida={tb.dias_1_30+tb.dias_31_60+tb.dias_61_90+tb.dias_91_180+tb.mas_180_dias} />
                            </td>
                            <td className="px-3 py-3 text-right font-bold text-red-900">
                              {fmtM(tb.dias_91_180+tb.mas_180_dias)}
                            </td>
                          </>
                        })()}
                        <td colSpan={1} />
                      </tr>
                    )
                  })()}
                </tfoot>
              </table>
            </div>
            <PaginationControls
              page={Math.min(pageCarteraEdades, carteraEdadesPages)}
              pages={carteraEdadesPages}
              onChange={setPageCarteraEdades}
            />
          </section>

          {/* ══════════════════════════════════════════════════════════════
              SECCIÓN 2 — FACTURAS PRÓXIMAS A VENCER
          ══════════════════════════════════════════════════════════════ */}
          <section id="sec-vencimientos" className="bg-white rounded-2xl shadow-sm p-7">
            <SectionHeader
              icon={<Clock className="h-7 w-7" />}
              title="FACTURAS PRÓXIMAS A VENCER"
              count={`${proximos.length} facturas · días para su vencimiento ≤ 20 días`}
              color="orange"
            />
            {proximosQ.isLoading && (
              <div className="flex justify-center py-8"><Spinner className="h-10 w-10" /></div>
            )}
            {!proximosQ.isLoading && proximos.length === 0 && (
              <div className="flex items-center justify-center gap-3 text-green-600 py-8">
                <CheckCircle className="h-8 w-8" />
                <p className="text-lg font-semibold">No hay facturas próximas a vencer en los próximos 20 días</p>
              </div>
            )}
            {proximos.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-base">
                  <thead className="bg-[#e67e22] text-white text-sm">
                    <tr>
                      <th className="px-4 py-3 text-left w-8">#</th>
                      <th className="px-4 py-3 text-left">Cliente</th>
                      <th className="px-4 py-3 text-left">Documento</th>
                      <th className="px-4 py-3 text-left">Vencimiento</th>
                      <th className="px-4 py-3 text-center">Días</th>
                      <th className="px-4 py-3 text-left">Línea</th>
                      <th className="px-4 py-3 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proximosPageItems.map((pv: ProximoVencimiento, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-orange-50 transition-colors">
                        <td className="px-4 py-4 text-gray-400 font-mono text-sm">{(Math.min(pageProximos, proximosPages) - 1) * PAGE_SIZE + i + 1}</td>
                        <td className="px-4 py-4 font-semibold">{pv.cliente}</td>
                        <td className="px-4 py-4 text-gray-500 font-mono text-sm">{pv.num_doc || '—'}</td>
                        <td className="px-4 py-4 text-gray-700">{pv.fecha_vencimiento}</td>
                        <td className="px-4 py-4 text-center"><PillDias dias={pv.dias_para_vencer} /></td>
                        <td className="px-4 py-4 text-gray-500">{pv.vendedor}</td>
                        <td className="px-4 py-4 text-right font-extrabold text-[#0f3460]">{fmt(pv.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-orange-50 border-t-2 border-orange-200">
                    <tr>
                      <td colSpan={6} className="px-4 py-3 font-bold text-orange-800">
                        Total por vencer ({proximos.length} facturas)
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-orange-900">
                        {fmt(proximos.reduce((s,p)=>s+p.saldo,0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <PaginationControls
              page={Math.min(pageProximos, proximosPages)}
              pages={proximosPages}
              onChange={setPageProximos}
            />
          </section>

          {/* ══════════════════════════════════════════════════════════════
              SECCIÓN 3 — CARTERA POR REGIÓN
          ══════════════════════════════════════════════════════════════ */}
          <section id="sec-region" className="bg-white rounded-2xl shadow-sm p-7">
            <SectionHeader
              icon={<MapPin className="h-7 w-7" />}
              title="CARTERA POR REGIÓN"
              count={`${regiones.length} departamentos`}
              color="purple"
            />

            <BuscarInput value={busRegiones} onChange={v => { setBusRegiones(v); setPageRegiones(1) }} placeholder="Buscar por departamento, ciudad o institución..." />

            {regionesQ.isLoading && (
              <div className="flex justify-center py-8"><Spinner className="h-10 w-10" /></div>
            )}
            {regionesQ.error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
                <p className="font-bold mb-1">Error al consultar regiones</p>
                <p className="font-mono text-xs">{(regionesQ.error as any)?.response?.data?.message || (regionesQ.error as any)?.response?.data?.error || (regionesQ.error as any)?.message || 'Sin respuesta del servidor'}</p>
                <p className="text-xs mt-1 text-red-500">URL: /api/cartera/regiones/ · HTTP {(regionesQ.error as any)?.response?.status ?? 'N/A'}</p>
              </div>
            )}
            {!regionesQ.isLoading && !regionesQ.error && regiones.length === 0 && (
              <p className="text-gray-400 text-lg py-6 text-center">Sin datos de regiones para la fecha seleccionada</p>
            )}
            {regionesFiltradas.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-base">
                  <thead className="bg-[#1a1a2e] text-white text-sm">
                    <tr>
                      <th className="px-4 py-3 text-center w-14">Pos.</th>
                      <th className="px-4 py-3 text-left">Departamento</th>
                      <th className="px-4 py-3 text-center">Clientes</th>
                      <th className="px-4 py-3 text-center">Ciudades</th>
                      <th className="px-4 py-3 text-right">Total Cartera</th>
                      <th className="px-4 py-3 text-right">Vencida</th>
                      <th className="px-4 py-3 text-right">Mora +90d</th>
                      <th className="px-4 py-3 text-center">% Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regionesPageItems.map((reg: RegionAgregada, idx) => {
                      const regKey = reg.departamento
                      const isOpen = expRegiones.has(regKey)
                      const rankColors = [
                        'bg-yellow-400 text-yellow-900',   // 1st — gold
                        'bg-slate-300 text-slate-800',     // 2nd — silver
                        'bg-amber-600 text-amber-100',     // 3rd — bronze
                      ]
                      const rankCls = reg.ranking <= 3
                        ? rankColors[reg.ranking - 1]
                        : 'bg-gray-100 text-gray-600'
                      return (
                        <Fragment key={regKey}>
                          <tr
                            onClick={() => setExpRegiones(prev => toggleSet(prev, regKey))}
                            className="bg-white hover:bg-purple-50 cursor-pointer border-b border-gray-100 transition-colors"
                          >
                            <td className="px-4 py-4 text-center">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-extrabold ${rankCls}`}>
                                {(Math.min(pageRegiones, regionesPages) - 1) * PAGE_SIZE + idx + 1}
                              </span>
                            </td>
                            <td className="px-4 py-4 font-bold text-lg">
                              <div className="flex items-center gap-2">
                                {isOpen
                                  ? <ChevronDown className="h-5 w-5 text-purple-600 shrink-0" />
                                  : <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />}
                                {reg.departamento}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="bg-purple-100 text-purple-800 font-bold px-3 py-1 rounded-full text-sm">
                                {reg.clientes_count}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center text-gray-500 font-semibold text-sm">
                              {reg.ciudades_count} {reg.ciudades_count === 1 ? 'ciudad' : 'ciudades'}
                            </td>
                            <td className="px-4 py-4 text-right font-extrabold text-[#0f3460]">{fmtM(reg.total_deuda)}</td>
                            <td className="px-4 py-4 text-right font-semibold text-red-600">{fmtM(reg.total_vencida)}</td>
                            <td className="px-4 py-4 text-right font-bold text-red-800">
                              {reg.mora_90 > 0 ? fmtM(reg.mora_90) : <span className="text-green-600 text-sm font-semibold">Al día</span>}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="font-extrabold text-gray-800">{reg.porcentaje}%</span>
                            </td>
                          </tr>

                          {/* Detalle: ciudades en la región */}
                          {isOpen && (
                            <tr>
                              <td colSpan={8} className="px-4 py-2">
                                <div className="bg-purple-50 border border-purple-200 rounded-xl mx-4 mb-3 overflow-hidden">
                                  <div className="px-5 py-3 bg-purple-100 font-bold text-purple-800 text-sm uppercase tracking-wide flex items-center justify-between">
                                    <span>CIUDADES EN {reg.departamento.toUpperCase()}</span>
                                    <span className="text-xs font-semibold text-purple-600">{reg.ciudades.length} {reg.ciudades.length === 1 ? 'ciudad' : 'ciudades'}</span>
                                  </div>
                                  {reg.ciudades.map((ciu: CiudadAgregada) => {
                                    const ciuKey = `${regKey}::${ciu.ciudad}`
                                    const ciuOpen = expRegionesCiudades.has(ciuKey)
                                    return (
                                      <div key={ciu.ciudad} className="border-t border-purple-200">
                                        {/* Ciudad header */}
                                        <button
                                          onClick={e => { e.stopPropagation(); setExpRegionesCiudades(prev => toggleSet(prev, ciuKey)); setPagesCiudad(prev => ({ ...prev, [ciuKey]: 1 })) }}
                                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-purple-100 transition-colors text-left"
                                        >
                                          {ciuOpen
                                            ? <ChevronDown className="h-4 w-4 text-purple-500 shrink-0" />
                                            : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                                          <span className="font-bold text-purple-900">{ciu.ciudad}</span>
                                          <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full font-semibold ml-1">
                                            {ciu.clientes_count} cliente{ciu.clientes_count !== 1 ? 's' : ''}
                                          </span>
                                          <span className="ml-auto font-extrabold text-[#0f3460] text-sm">{fmtM(ciu.total_deuda)}</span>
                                          <span className="text-xs text-gray-500 font-semibold w-10 text-right">{ciu.porcentaje}%</span>
                                        </button>
                                        {/* Clients inside city */}
                                        {ciuOpen && (
                                          <>
                                            <table className="w-full text-sm border-t border-purple-100">
                                              <thead className="bg-purple-200 text-purple-900">
                                                <tr>
                                                  <th className="px-6 py-2 text-left w-8">#</th>
                                                  <th className="px-4 py-2 text-left">Cliente</th>
                                                  <th className="px-4 py-2 text-left">NIT</th>
                                                  <th className="px-4 py-2 text-right">Total</th>
                                                  <th className="px-4 py-2 text-right">Anticipo</th>
                                                  <th className="px-4 py-2 text-right">Vigente</th>
                                                  <th className="px-4 py-2 text-right">+90d</th>
                                                  <th className="px-4 py-2 text-center">Mora máx.</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {paginate(ciu.clientes, pagesCiudad[ciuKey] ?? 1).map((cl, cli) => (
                                                  <tr key={cl.cliente_nit} className="border-t border-purple-100 hover:bg-purple-50">
                                                    <td className="px-6 py-2 text-gray-400">{((pagesCiudad[ciuKey] ?? 1) - 1) * PAGE_SIZE + cli + 1}</td>
                                                    <td className="px-4 py-2 font-semibold text-gray-900">{cl.cliente_nombre}</td>
                                                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{cl.cliente_nit}</td>
                                                    <td className="px-4 py-2 text-right font-bold text-[#0f3460]">{fmtM(cl.total_deuda)}</td>
                                                    <td className="px-4 py-2 text-right text-emerald-700 font-semibold">
                                                      {(saldoByNit[cl.cliente_nit] ?? 0) > 0 ? fmtM(saldoByNit[cl.cliente_nit]) : <span className="text-gray-300">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-green-700">{fmtM(cl.vigente)}</td>
                                                    <td className="px-4 py-2 text-right text-red-900 font-bold">{fmtM(cl.dias_91_180 + cl.mas_180_dias)}</td>
                                                    <td className="px-4 py-2 text-center">
                                                      {cl.dias_mora_max > 0
                                                        ? <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold">{cl.dias_mora_max}d</span>
                                                        : <span className="text-green-600 text-xs">Al día</span>
                                                      }
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                              <tfoot className="bg-purple-100 border-t border-purple-200">
                                                <tr>
                                                  <td colSpan={3} className="px-6 py-1.5 font-bold text-purple-800 text-xs uppercase">
                                                    Total {ciu.ciudad}
                                                  </td>
                                                  <td className="px-4 py-1.5 text-right font-bold text-[#0f3460] text-sm">{fmtM(ciu.total_deuda)}</td>
                                                  <td className="px-4 py-1.5 text-right text-emerald-700 font-bold text-sm">
                                                    {fmtM(ciu.clientes?.reduce((s: number, cl: { cliente_nit: string }) => s + (saldoByNit[cl.cliente_nit] ?? 0), 0) ?? 0)}
                                                  </td>
                                                  <td className="px-4 py-1.5 text-right text-green-700 font-bold text-sm">{fmtM(ciu.vigente)}</td>
                                                  <td className="px-4 py-1.5 text-right text-red-900 font-bold text-sm">{fmtM(ciu.dias_91_mas)}</td>
                                                  <td />
                                                </tr>
                                              </tfoot>
                                            </table>
                                            {totalPages(ciu.clientes.length) > 1 && (
                                              <div className="px-5 py-2 bg-purple-50 border-t border-purple-100">
                                                <PaginationControls
                                                  page={pagesCiudad[ciuKey] ?? 1}
                                                  pages={totalPages(ciu.clientes.length)}
                                                  onChange={p => setPagesCiudad(prev => ({ ...prev, [ciuKey]: p }))}
                                                />
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    )
                                  })}
                                  {/* Region footer */}
                                  <div className="bg-purple-200 border-t-2 border-purple-300 px-5 py-2 flex items-center justify-between text-sm font-bold text-purple-900">
                                    <span>TOTAL {reg.departamento.toUpperCase()} · {reg.clientes_count} clientes</span>
                                    <div className="flex gap-6">
                                      <span>Total: {fmtM(reg.total_deuda)}</span>
                                      <span className="text-red-700">Vencida: {fmtM(reg.total_vencida)}</span>
                                      {reg.mora_90 > 0 && <span className="text-red-900">+90d: {fmtM(reg.mora_90)}</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 font-bold text-gray-700">
                        TOTALES ({regionesFiltradas.length} departamentos)
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-800">
                        {fmtM(regionesFiltradas.reduce((s, r) => s + r.total_deuda, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">
                        {fmtM(regionesFiltradas.reduce((s, r) => s + r.total_vencida, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-800">
                        {fmtM(regionesFiltradas.reduce((s, r) => s + r.mora_90, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <PaginationControls
              page={Math.min(pageRegiones, regionesPages)}
              pages={regionesPages}
              onChange={setPageRegiones}
            />
          </section>


          {/* ══════════════════════════════════════════════════════════════
              SECCIÓN — CLIENTES CON ANTICIPO
          ══════════════════════════════════════════════════════════════ */}
          {(() => {
            const SALDO_PAGE = 10
            const filtrados = saldoFavorClientes.filter(s =>
              !busSaldo ||
              s.cliente_nombre.toLowerCase().includes(busSaldo.toLowerCase()) ||
              s.cliente_nit.includes(busSaldo)
            )
            const pages = Math.max(1, Math.ceil(filtrados.length / SALDO_PAGE))
            const pg    = Math.min(pageSaldo, pages)
            const items = filtrados.slice((pg - 1) * SALDO_PAGE, pg * SALDO_PAGE)

            const carteraNeta = totalCartera - totalSaldoFavor

            return (
              <section id="sec-anticipos" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-xl">
                      <Wallet size={20} className="text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 tracking-tight">CLIENTES CON ANTICIPO</h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {saldoFavorClientes.length} cliente{saldoFavorClientes.length !== 1 ? 's' : ''} con anticipo
                        {saldoFavorQ.data?.fecha_corte ? ` · corte ${saldoFavorQ.data.fecha_corte}` : ''}
                      </p>
                    </div>
                  </div>
                  {saldoFavorQ.isFetching && <Spinner />}
                </div>

                {/* KPI banda */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wide mb-1">Anticipos</p>
                    <p className="text-2xl font-extrabold text-emerald-800">{fmtM(totalSaldoFavor)}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">{saldoFavorClientes.length} clientes con anticipo</p>
                  </div>
                  <div className={`border rounded-xl p-4 ${carteraNeta < 0 ? 'bg-green-50 border-green-200' : 'bg-indigo-50 border-indigo-200'}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${carteraNeta < 0 ? 'text-green-700' : 'text-indigo-700'}`}>Sin anticipo</p>
                    <p className={`text-2xl font-extrabold ${carteraNeta < 0 ? 'text-green-800' : 'text-indigo-800'}`}>{fmtM(carteraNeta)}</p>
                    <p className={`text-xs mt-0.5 ${carteraNeta < 0 ? 'text-green-600' : 'text-indigo-600'}`}>cartera descontando anticipos</p>
                  </div>
                </div>

                {/* Búsqueda — solo cuando hay datos */}
                {saldoFavorClientes.length > 0 && (
                  <div className="relative mb-4">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={busSaldo}
                      onChange={e => { setBusSaldo(e.target.value); setPageSaldo(1) }}
                      placeholder="Buscar por nombre o NIT..."
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                  </div>
                )}

                {saldoFavorQ.isLoading ? (
                  <div className="flex justify-center py-12"><Spinner /></div>
                ) : filtrados.length === 0 && saldoFavorClientes.length > 0 ? (
                  <p className="text-center text-gray-400 py-8">Sin resultados para «{busSaldo}».</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                            <th className="px-4 py-3 text-left font-semibold">#</th>
                            <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                            <th className="px-4 py-3 text-right font-semibold">Anticipos</th>
                            <th className="px-4 py-3 text-right font-semibold">Cartera</th>
                            <th className="px-4 py-3 text-right font-semibold">Neto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {items.map((s, i) => {
                            const tsf  = Number(s.total_saldo_favor)
                            const sn   = s.saldo_neto != null ? Number(s.saldo_neto) : null
                            const rawDeuda = sn != null
                              ? sn + tsf
                              : (carteraByNit[s.cliente_nit] ?? null)
                            // Descartar valores absurdos (>1T) por datos corruptos en SnapCartera
                            const MAX = 1_000_000_000_000
                            const deuda = rawDeuda != null && Math.abs(rawDeuda) < MAX ? rawDeuda : null
                            const neto  = sn != null
                              ? sn
                              : deuda != null ? deuda - tsf : null
                            const netoNegativo = neto != null && neto < 0

                            return (
                              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-gray-400 text-xs">{(pg - 1) * SALDO_PAGE + i + 1}</td>
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-gray-900 leading-tight">{s.cliente_nombre || '—'}</p>
                                  <p className="text-xs text-gray-400">{s.cliente_nit}</p>
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmt(s.total_saldo_favor)}</td>
                                <td className="px-4 py-3 text-right text-gray-600">
                                  {deuda != null ? fmt(deuda) : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {neto != null ? (
                                    <span className={`font-bold ${netoNegativo ? 'text-green-600' : 'text-gray-900'}`}>
                                      {fmt(neto)}
                                      {netoNegativo && (
                                        <span className="ml-1.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">crédito</span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <PaginationControls page={pg} pages={pages} onChange={setPageSaldo} />
                  </>
                )}
              </section>
            )
          })()}

          {/* ══════════════════════════════════════════════════════════════
              SECCIÓN — TABLERO POR COMERCIAL
          ══════════════════════════════════════════════════════════════ */}
          <section id="sec-comercial" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-100 rounded-xl">
                  <Users size={20} className="text-sky-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight">TABLERO POR COMERCIAL</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {asesoresQ.data
                      ? `${asesoresQ.data.asesores.filter(a => a.asesor !== 'Sin asesor asignado').length} asesores · ${fmtM(asesoresQ.data.total_general)} total`
                      : 'Cargando…'}
                  </p>
                </div>
              </div>
              {asesoresQ.isFetching && <Spinner />}
            </div>

            {/* Búsqueda */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={busAsesores}
                onChange={e => { setBusAsesores(e.target.value); setPageAsesores(1) }}
                placeholder="Buscar asesor o cliente..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>

            {asesoresQ.isLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : !asesoresQ.data?.asesores.length ? (
              <div className="text-center py-12 text-gray-400">
                <p className="font-semibold mb-1">Sin datos de asesores</p>
                <p className="text-sm">Ejecuta <code className="bg-gray-100 px-1 rounded">python manage.py etl_asesor</code> con VPN activa.</p>
              </div>
            ) : (() => {
              const q = busAsesores.toLowerCase()
              const todosAsesor = (asesoresQ.data?.asesores ?? []).filter((a: AsesorItem) =>
                !q ||
                a.asesor.toLowerCase().includes(q) ||
                a.clientes.some((c: AsesorCliente) =>
                  c.cliente_nombre.toLowerCase().includes(q) || c.cliente_nit.includes(q)
                )
              )
              const isSinInfoItem = (a: AsesorItem) =>
                a.asesor === 'Sin asesor asignado' || a.lineas.length === 0
              const filtrados  = todosAsesor.filter((a: AsesorItem) => !isSinInfoItem(a))
              const sinInfoAll = todosAsesor.filter((a: AsesorItem) =>  isSinInfoItem(a))

              const asesorPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
              const asesorPg    = Math.min(pageAsesores, asesorPages)
              const asesorItems = filtrados.slice((asesorPg - 1) * PAGE_SIZE, asesorPg * PAGE_SIZE)

              return (
                <div className="space-y-3">
                  {asesorItems.map((a: AsesorItem) => {
                    const isSinAsesor = a.asesor === 'Sin asesor asignado'
                    const isOpen = expAsesores.has(a.asesor)
                    const pctVenc = a.total_deuda > 0 ? (a.total_vencida / a.total_deuda) * 100 : 0
                    const badgeVenc = pctVenc > 60 ? 'bg-red-100 text-red-700' : pctVenc > 30 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'

                    return (
                      <div key={a.asesor} className={`border rounded-2xl overflow-hidden shadow-sm ${isSinAsesor ? 'border-gray-200' : 'border-sky-200'}`}>
                        <button
                          onClick={() => setExpAsesores(prev => toggleSet(prev, a.asesor))}
                          className={`w-full text-left flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-3 px-5 py-4 ${isSinAsesor ? 'bg-slate-50 hover:bg-slate-100' : 'bg-sky-50 hover:bg-sky-100'} transition-colors`}
                        >
                          {isOpen
                            ? <ChevronDown className="h-5 w-5 text-sky-500 shrink-0 mt-0.5" />
                            : <ChevronRight className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />}
                          <div className="flex-1 min-w-0">
                            <p className={`text-base font-extrabold truncate ${isSinAsesor ? 'text-gray-400' : 'text-sky-900'}`}>
                              {a.asesor}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {a.clientes_count} cliente{a.clientes_count !== 1 ? 's' : ''}
                              {a.lineas.length > 0 && ` · ${a.lineas.join(', ')}`}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto sm:min-w-[420px]">
                            <div className="text-right bg-white rounded-lg px-2 py-1.5">
                              <p className="text-xs text-gray-400 font-medium">Cartera</p>
                              <p className="text-base font-extrabold text-[#0f3460]">{fmtM(a.total_deuda)}</p>
                            </div>
                            <div className="text-right bg-white rounded-lg px-2 py-1.5">
                              <p className="text-xs text-gray-400 font-medium">Mora +90d</p>
                              <p className={`text-base font-bold ${a.mora_90 > 0 ? 'text-red-700' : 'text-green-600'}`}>
                                {a.mora_90 > 0 ? fmtM(a.mora_90) : 'Al día'}
                              </p>
                            </div>
                            <div className="text-right bg-white rounded-lg px-2 py-1.5">
                              <p className="text-xs text-gray-400 font-medium">% Vencida</p>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeVenc}`}>
                                {pctVenc.toFixed(1)}%
                              </span>
                            </div>
                            <div className="text-right bg-white rounded-lg px-2 py-1.5">
                              <p className="text-xs text-gray-400 font-medium">% Total</p>
                              <p className="text-sm font-bold text-gray-700">{a.porcentaje}%</p>
                            </div>
                          </div>
                        </button>

                        {isOpen && (() => {
                          const cliPg = pagesAsesorCli[a.asesor] ?? 1
                          const cliPages = totalPages(a.clientes.length)
                          const cliItems = paginate(a.clientes, cliPg)
                          const offset   = (cliPg - 1) * PAGE_SIZE
                          return (
                            <>
                              <div className="border-t border-sky-200 overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-sky-100 text-sky-900 text-xs uppercase">
                                    <tr>
                                      <th className="px-5 py-2 text-left w-8">#</th>
                                      <th className="px-4 py-2 text-left">Cliente</th>
                                      <th className="px-4 py-2 text-left">NIT</th>
                                      <th className="px-4 py-2 text-left">Ciudad</th>
                                      <th className="px-4 py-2 text-right">Cartera</th>
                                      <th className="px-4 py-2 text-right">Vigente</th>
                                      <th className="px-4 py-2 text-right">Mora +90d</th>
                                      <th className="px-4 py-2 text-center">Mora máx.</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {cliItems.map((cl: AsesorCliente, ci: number) => {
                                      const mora90 = cl.dias_91_180 + cl.mas_180_dias
                                      return (
                                        <tr key={cl.cliente_nit} className="border-t border-sky-100 hover:bg-sky-50 transition-colors">
                                          <td className="px-5 py-2.5 text-gray-400 text-xs">{offset + ci + 1}</td>
                                          <td className="px-4 py-2.5 font-semibold text-gray-900">{cl.cliente_nombre}</td>
                                          <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{cl.cliente_nit}</td>
                                          <td className="px-4 py-2.5 text-gray-500 text-xs">{cl.ciudad || '—'}</td>
                                          <td className="px-4 py-2.5 text-right font-extrabold text-[#0f3460]">{fmtM(cl.total_deuda)}</td>
                                          <td className="px-4 py-2.5 text-right text-green-700 font-semibold">{fmtM(cl.vigente)}</td>
                                          <td className="px-4 py-2.5 text-right font-bold text-red-700">{mora90 > 0 ? fmtM(mora90) : <span className="text-green-600 text-xs font-semibold">Al día</span>}</td>
                                          <td className="px-4 py-2.5 text-center">
                                            {cl.dias_mora_max > 0
                                              ? <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold">{cl.dias_mora_max}d</span>
                                              : <span className="text-green-600 text-xs font-semibold">Al día</span>}
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                  <tfoot className="bg-sky-100 border-t-2 border-sky-200">
                                    <tr>
                                      <td colSpan={4} className="px-5 py-1.5 font-bold text-sky-900 text-xs uppercase">
                                        Total {a.asesor} · {a.clientes_count} clientes
                                      </td>
                                      <td className="px-4 py-1.5 text-right font-extrabold text-[#0f3460] text-sm">{fmtM(a.total_deuda)}</td>
                                      <td className="px-4 py-1.5 text-right text-green-700 font-bold text-sm">{fmtM(a.vigente)}</td>
                                      <td className="px-4 py-1.5 text-right text-red-700 font-bold text-sm">{a.mora_90 > 0 ? fmtM(a.mora_90) : '—'}</td>
                                      <td />
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                              {cliPages > 1 && (
                                <div className="px-5 py-2 bg-sky-50 border-t border-sky-100">
                                  <PaginationControls
                                    page={cliPg}
                                    pages={cliPages}
                                    onChange={p => setPagesAsesorCli(prev => ({ ...prev, [a.asesor]: p }))}
                                  />
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    )
                  })}

                  {filtrados.length === 0 && sinInfoAll.length === 0 && (
                    <p className="text-center text-gray-400 py-8">Sin resultados para «{busAsesores}».</p>
                  )}
                  {asesorPages > 1 && (
                    <PaginationControls page={asesorPg} pages={asesorPages} onChange={setPageAsesores} />
                  )}

                  {sinInfoAll.length > 0 && (
                    <div className="mt-4 border border-dashed border-gray-300 rounded-2xl overflow-hidden">
                      <button
                        onClick={() => setShowSinInfo(v => !v)}
                        className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm text-gray-500"
                      >
                        <span className="flex items-center gap-2">
                          {showSinInfo ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <span className="font-semibold">Sin asesor / sin línea asignada</span>
                          <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full font-bold">
                            {sinInfoAll.reduce((acc, a) => acc + a.clientes_count, 0)} clientes
                          </span>
                        </span>
                        <span className="font-bold text-gray-600 tabular-nums">
                          {fmtM(sinInfoAll.reduce((acc, a) => acc + a.total_deuda, 0))}
                        </span>
                      </button>
                      {showSinInfo && (
                        <div className="divide-y divide-gray-100">
                          {sinInfoAll.map((a: AsesorItem) => {
                            const isOpen = expAsesores.has(a.asesor)
                            const pctVenc = a.total_deuda > 0 ? (a.total_vencida / a.total_deuda) * 100 : 0
                            const badgeVenc = pctVenc > 60 ? 'bg-red-100 text-red-700' : pctVenc > 30 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                            return (
                              <div key={a.asesor}>
                                <button
                                  onClick={() => setExpAsesores(prev => toggleSet(prev, a.asesor))}
                                  className="w-full text-left flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-3 px-5 py-3 bg-white hover:bg-gray-50 transition-colors"
                                >
                                  {isOpen
                                    ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                                    : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-400 truncate">{a.asesor}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      {a.clientes_count} cliente{a.clientes_count !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto sm:min-w-[420px]">
                                    <div className="text-right bg-gray-50 rounded-lg px-2 py-1.5">
                                      <p className="text-xs text-gray-400 font-medium">Cartera</p>
                                      <p className="text-sm font-bold text-gray-600">{fmtM(a.total_deuda)}</p>
                                    </div>
                                    <div className="text-right bg-gray-50 rounded-lg px-2 py-1.5">
                                      <p className="text-xs text-gray-400 font-medium">Mora +90d</p>
                                      <p className={`text-sm font-bold ${a.mora_90 > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {a.mora_90 > 0 ? fmtM(a.mora_90) : 'Al día'}
                                      </p>
                                    </div>
                                    <div className="text-right bg-gray-50 rounded-lg px-2 py-1.5">
                                      <p className="text-xs text-gray-400 font-medium">% Vencida</p>
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeVenc}`}>{pctVenc.toFixed(1)}%</span>
                                    </div>
                                    <div className="text-right bg-gray-50 rounded-lg px-2 py-1.5">
                                      <p className="text-xs text-gray-400 font-medium">% Total</p>
                                      <p className="text-xs font-bold text-gray-500">{a.porcentaje}%</p>
                                    </div>
                                  </div>
                                </button>
                                {isOpen && (() => {
                                  const cliPg2 = pagesAsesorCli[a.asesor] ?? 1
                                  const cliPages2 = totalPages(a.clientes.length)
                                  const cliItems2 = paginate(a.clientes, cliPg2)
                                  const offset2   = (cliPg2 - 1) * PAGE_SIZE
                                  return (
                                    <>
                                      <div className="border-t border-gray-100 overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
                                            <tr>
                                              <th className="px-5 py-2 text-left w-8">#</th>
                                              <th className="px-4 py-2 text-left">Cliente</th>
                                              <th className="px-4 py-2 text-left">NIT</th>
                                              <th className="px-4 py-2 text-left">Ciudad</th>
                                              <th className="px-4 py-2 text-right">Cartera</th>
                                              <th className="px-4 py-2 text-right">Vigente</th>
                                              <th className="px-4 py-2 text-right">Mora +90d</th>
                                              <th className="px-4 py-2 text-center">Mora máx.</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {cliItems2.map((cl: AsesorCliente, ci: number) => {
                                              const mora90 = cl.dias_91_180 + cl.mas_180_dias
                                              return (
                                                <tr key={cl.cliente_nit} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                                                  <td className="px-5 py-2.5 text-gray-400 text-xs">{offset2 + ci + 1}</td>
                                                  <td className="px-4 py-2.5 font-semibold text-gray-700">{cl.cliente_nombre}</td>
                                                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{cl.cliente_nit}</td>
                                                  <td className="px-4 py-2.5 text-gray-500 text-xs">{cl.ciudad || '—'}</td>
                                                  <td className="px-4 py-2.5 text-right font-bold text-gray-700">{fmtM(cl.total_deuda)}</td>
                                                  <td className="px-4 py-2.5 text-right text-green-700 font-semibold">{fmtM(cl.vigente)}</td>
                                                  <td className="px-4 py-2.5 text-right font-bold text-red-600">{mora90 > 0 ? fmtM(mora90) : <span className="text-green-600 text-xs font-semibold">Al día</span>}</td>
                                                  <td className="px-4 py-2.5 text-center">
                                                    {cl.dias_mora_max > 0
                                                      ? <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold">{cl.dias_mora_max}d</span>
                                                      : <span className="text-green-600 text-xs font-semibold">Al día</span>}
                                                  </td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                      {cliPages2 > 1 && (
                                        <div className="px-5 py-2 bg-gray-50 border-t border-gray-100">
                                          <PaginationControls
                                            page={cliPg2}
                                            pages={cliPages2}
                                            onChange={p => setPagesAsesorCli(prev => ({ ...prev, [a.asesor]: p }))}
                                          />
                                        </div>
                                      )}
                                    </>
                                  )
                                })()}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
          </section>

        </div>
      )}
    </div>
  )
}
