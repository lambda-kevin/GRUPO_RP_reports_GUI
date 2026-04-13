import { useState, Fragment, type ReactNode } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip as RTooltip, ReferenceLine, Cell,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import {
  Wallet,
  AlertTriangle, Clock, DollarSign, ChevronDown, ChevronRight,
  Calendar, MapPin, UserCheck, Search, ShieldAlert, CheckCircle,
} from 'lucide-react'
import {
  getCartera, getProximosVencimientos,
  getCarteraLineas, getCarteraRegiones, getFacturas, getCarteraGrupos,
  type FiltroFecha,
} from '../api/dashboard'
import { Spinner } from '../components/ui/Spinner'
import { fmtCOP, fmtCOPShort, fmtPct } from '../utils/fmt'
import type {
  SnapCartera, Factura, ProximoVencimiento,
  CiudadAgregada, LineaAgregada, RegionAgregada, GrupoAgregado, ParetoClienteItem,
} from '../types'

// Aliases locales para uso conciso en este módulo
const fmt   = fmtCOP       // formato completo: $1.234.567
const fmtM  = fmtCOPShort  // abreviado: $1,2M / $234K

const PAGE_SIZE = 6
const totalPages = (items: number) => Math.max(1, Math.ceil(items / PAGE_SIZE))
const paginate = <T,>(items: T[], page: number) =>
  items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

const hoy = () => new Date().toISOString().slice(0, 10)

// ─── Riesgo ────────────────────────────────────────────────────────────────────

const nivelRiesgo = (c: Pick<SnapCartera, 'dias_91_180' | 'mas_180_dias' | 'dias_61_90' | 'dias_31_60' | 'dias_1_30'>) => {
  if (c.dias_91_180 + c.mas_180_dias > 0) return 'critico'
  if (c.dias_61_90 > 0)                   return 'alto'
  if (c.dias_31_60 > 0)                   return 'medio'
  if (c.dias_1_30  > 0)                   return 'leve'
  return 'ok'
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

// ─── Facturas expandidas de un cliente ────────────────────────────────────────

const FilaFacturas = ({ nit, cols, filtro }: { nit: string; cols: number; filtro?: FiltroFecha }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['facturas', nit, filtro],
    queryFn: () => getFacturas(nit, filtro),
    staleTime: 5 * 60 * 1000,
  })
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
          {data?.facturas.length === 0 && (
            <p className="px-5 py-4 text-base text-gray-400">Sin facturas en el período consultado.</p>
          )}
          {data && data.facturas.length > 0 && (
            <>
            <div className="px-5 py-3 bg-slate-100 font-bold text-slate-700 text-base border-b border-slate-200">
              FACTURAS PENDIENTES — DE LA MÁS ANTIGUA A LA MÁS RECIENTE
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
                {data.facturas.map((f: Factura, i: number) => {
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
                    {data.facturas.length} facturas
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-slate-700">
                    {fmt(data.facturas.reduce((s, f) => s + f.saldo, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
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
}: { label: string; value: string; sub: string; gradient: string; icon: ReactNode }) => (
  <div className={`bg-gradient-to-br ${gradient} text-white rounded-2xl p-6 shadow-lg`}>
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-base font-medium opacity-90 mb-2 uppercase tracking-wide">{label}</p>
        <p className="text-4xl font-extrabold mb-1 leading-tight">{value}</p>
        <p className="text-sm opacity-80">{sub}</p>
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
  'Grupo Zentria':    '#0f3460',
  'Grupo SURA':       '#1d4ed8',
  'Grupo Quirónsalud':'#7c3aed',
  'Grupo AUNA':       '#0891b2',
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
      <p className="text-slate-700">Cartera: <strong>{fmtCOPShort(d.total_deuda)}</strong></p>
      {d.ventas_anio > 0 && <p className="text-emerald-700">Ventas: <strong>{fmtCOPShort(d.ventas_anio)}</strong></p>}
      {d.ratio_cartera_ventas != null && <p className="text-orange-600">Ratio C/V: <strong>{d.ratio_cartera_ventas}%</strong></p>}
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
      <p className="text-slate-700">Cartera: <strong>{fmtCOPShort(d.total_deuda)}</strong></p>
      {d.ventas_anio > 0 && <p className="text-emerald-700">Ventas: <strong>{fmtCOPShort(d.ventas_anio)}</strong></p>}
      {d.ratio_cartera_ventas != null && <p className="text-orange-600">Ratio C/V: <strong>{d.ratio_cartera_ventas}%</strong></p>}
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
  const [expComerciales,     setExpComerciales]     = useState<Set<string>>(new Set())
  const [expGrupos,          setExpGrupos]          = useState<Set<string>>(new Set())
  const [tabGrupos,          setTabGrupos]          = useState<'pareto' | 'detalle' | 'edades'>('pareto')
  const [vistaPareto,        setVistaPareto]        = useState<'macro' | 'micro'>('macro')
  const [filtroRiesgo,       setFiltroRiesgo]       = useState<string>('todos')
  const [pageCarteraEdades,  setPageCarteraEdades]  = useState(1)
  const [pageProximos,       setPageProximos]       = useState(1)
  const [pageRegiones,       setPageRegiones]       = useState(1)
  const [pageComerciales,    setPageComerciales]    = useState(1)
  // Búsqueda por sección
  const [busEdades,      setBusEdades]      = useState('')
  const [busRegiones,    setBusRegiones]    = useState('')
  const [busComerciales, setBusComerciales] = useState('')
  // Orden
  const [ordenEdades,   setOrdenEdades]   = useState<'az' | 'deuda'>('az')
  const [ordenLineas,   setOrdenLineas]   = useState<'az' | 'deuda'>('az')

  const carteraQ  = useQuery({ queryKey: ['cartera', filtro],     queryFn: () => getCartera(filtro) })
  const proximosQ = useQuery({ queryKey: ['proximos'],             queryFn: getProximosVencimientos })
  const regionesQ = useQuery({ queryKey: ['regiones', filtro],    queryFn: () => getCarteraRegiones(filtro) })
  const comercQ   = useQuery({ queryKey: ['comerciales', filtro], queryFn: () => getCarteraLineas(filtro) })
  const anioVentasParam = filtro.fecha_hasta
    ? parseInt(filtro.fecha_hasta.slice(0, 4), 10)
    : new Date().getFullYear()
  const gruposQ = useQuery({
    queryKey: ['grupos', filtro, anioVentasParam],
    queryFn:  () => getCarteraGrupos({ ...filtro, anio_ventas: anioVentasParam }),
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
    setExpComerciales(new Set())
    setExpGrupos(new Set())
    setPageCarteraEdades(1)
    setPageProximos(1)
    setPageRegiones(1)
    setPageComerciales(1)
    setBusEdades(''); setBusRegiones(''); setBusComerciales('')
    setOrdenEdades('az'); setOrdenLineas('az')
  }

  // Solo datos reales
  const cartera    = carteraQ.data ?? []
  const proximos   = proximosQ.data?.proximos_vencimientos ?? []
  const regiones   = regionesQ.data?.regiones ?? []
  const comerciales= comercQ.data?.lineas ?? comercQ.data?.comerciales ?? []
  const gruposData      = gruposQ.data
  const grupos          = gruposData?.grupos ?? []             // ordenados por deuda desc (Pareto)
  const gruposPorPeso   = [...grupos].sort((a, b) => a.peso - b.peso)  // para tabla/cards
  const paretoClientes  = gruposData?.pareto_clientes ?? []
  const totalVentas     = gruposData?.total_ventas ?? 0
  const anioVentas      = gruposData?.anio_ventas ?? anioVentasParam

  // KPIs
  const totalCartera = cartera.reduce((s, c) => s + c.total_deuda, 0)
  const totalVencida = cartera.reduce((s, c) => s + c.dias_1_30 + c.dias_31_60 + c.dias_61_90 + c.dias_91_180 + c.mas_180_dias, 0)
  const totalVigente = cartera.reduce((s, c) => s + c.vigente, 0)
  const criticos90   = cartera.reduce((s, c) => s + c.dias_91_180 + c.mas_180_dias, 0)
  const nCriticos    = cartera.filter(c => c.dias_91_180 + c.mas_180_dias > 0).length
  const fechaCorte = cartera[0]?.fecha_corte ?? null

  // Cartera por edades — con búsqueda, filtro riesgo y orden
  const carteraFiltradaRiesgo = cartera.filter(c => filtroRiesgo === 'todos' || nivelRiesgo(c) === filtroRiesgo)
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

  // Comerciales — con búsqueda por nombre o cod_vend, y orden
  const comercialesFiltradosBus = busComerciales.trim()
    ? comerciales.filter(c =>
        c.vendedor.toLowerCase().includes(busComerciales.toLowerCase()) ||
        c.linea?.toLowerCase().includes(busComerciales.toLowerCase()) ||
        c.cod_vend?.toLowerCase().includes(busComerciales.toLowerCase())
      )
    : comerciales
  const comercialesFiltrados = ordenLineas === 'az'
    ? [...comercialesFiltradosBus].sort((a, b) => (a.linea ?? a.vendedor ?? '').localeCompare(b.linea ?? b.vendedor ?? '', 'es'))
    : [...comercialesFiltradosBus].sort((a, b) => b.total_deuda - a.total_deuda)
  const comercialesPages = totalPages(comercialesFiltrados.length)
  const comercialesPageItems = paginate(comercialesFiltrados, Math.min(pageComerciales, comercialesPages))

  const cargando = carteraQ.isLoading || proximosQ.isLoading || regionesQ.isLoading || comercQ.isLoading || gruposQ.isLoading
  const actualizandoFiltros = carteraQ.isFetching || proximosQ.isFetching || regionesQ.isFetching || comercQ.isFetching || gruposQ.isFetching
  const dataError =
    (carteraQ.error as AxiosError<{ message?: string; error?: string }>) ||
    (proximosQ.error as AxiosError<{ message?: string; error?: string }>) ||
    (regionesQ.error as AxiosError<{ message?: string; error?: string }>) ||
    (comercQ.error as AxiosError<{ message?: string; error?: string }>) ||
    (gruposQ.error as AxiosError<{ message?: string; error?: string }>)
  const errorMsg =
    dataError?.response?.data?.message ||
    dataError?.response?.data?.error ||
    (dataError ? 'No se pudo consultar la data real de Saint.' : null)

  return (
    <div className="min-h-screen bg-[#f4f6fa]">

      {/* ── HEADER PEGAJOSO ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-primary-950 text-white shadow-lg border-b border-primary-800">
        <div className="px-6 lg:px-10 py-4 flex flex-wrap items-center gap-4">

          {/* Título */}
          <div className="min-w-[200px]">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
              INFORME DE CARTERA — GRUPO RP
            </h1>
            {fechaCorte && (
                <span className="text-xs text-white/60 mt-0.5 block">
                  Corte: {fechaCorte}
                </span>
              )}
          </div>

          {/* Filtro de fecha de corte */}
          <div className="flex flex-wrap items-center gap-2 bg-white/8 border border-white/15 px-4 py-2 rounded-xl ml-auto">
            <Calendar className="h-4 w-4 opacity-60 shrink-0" />
            <label className="text-sm opacity-80">Fecha de corte</label>
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

          <div className="text-xs text-white/70 ml-2 flex items-center gap-2">
            {actualizandoFiltros && <Spinner className="h-3.5 w-3.5 text-white" />}
            {actualizandoFiltros ? 'Actualizando datos…' : 'Datos en línea'}
          </div>
        </div>
      </div>

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
        <KPICard label="Cartera Total"
          value={fmtM(totalCartera)}
          sub={`${cartera.length} clientes activos`}
          gradient="from-slate-700 to-slate-900"
          icon={<DollarSign className="h-20 w-20" />} />
        <KPICard label="Cartera Vencida"
          value={fmtM(totalVencida)}
          sub={`${totalCartera > 0 ? fmtPct((totalVencida/totalCartera)*100) : '0%'} del total`}
          gradient="from-red-700 to-red-900"
          icon={<AlertTriangle className="h-20 w-20" />} />
        <KPICard label="Mora +90 Días"
          value={fmtM(criticos90)}
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
          <section className="bg-white rounded-2xl shadow-sm p-7">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <SectionHeader
                icon={<UserCheck className="h-7 w-7" />}
                title="GRUPOS EMPRESARIALES"
                count={`${grupos.filter(g => g.grupo !== 'Otros').length} grupos prioritarios`}
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
                { key: 'pareto',  label: 'Pareto & Rentabilidad' },
                { key: 'detalle', label: 'Detalle por grupo' },
                { key: 'edades',  label: 'Edades de cartera' },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setTabGrupos(t.key)}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                    tabGrupos === t.key
                      ? 'border-indigo-600 text-indigo-700 bg-indigo-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
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
                      <p className="text-xs text-gray-500 font-medium">Cartera grupos prioritarios</p>
                      <p className="text-lg font-extrabold text-[#0f3460]">
                        {fmtM(grupos.filter(g => g.grupo !== 'Otros').reduce((s, g) => s + g.total_deuda, 0))}
                      </p>
                    </div>
                    {totalVentas > 0 && (
                      <div className="bg-emerald-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-500 font-medium">Ventas {anioVentas}</p>
                        <p className="text-lg font-extrabold text-emerald-700">{fmtM(totalVentas)}</p>
                      </div>
                    )}
                    <div className="bg-amber-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500 font-medium">Instituciones (80% cartera)</p>
                      <p className="text-lg font-extrabold text-amber-700">{clientesEn80}</p>
                      <p className="text-xs text-gray-400">de {paretoClientes.length} total</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500 font-medium">Mora +90d (grupos)</p>
                      <p className="text-lg font-extrabold text-red-700">
                        {fmtM(grupos.reduce((s, g) => s + g.mora_90, 0))}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Macro / Micro */}
                  <div className="flex gap-2 mb-5">
                    {([
                      { key: 'macro', label: 'Vista Macro — por grupo' },
                      { key: 'micro', label: 'Vista Micro — por institución' },
                    ] as const).map(v => (
                      <button key={v.key} onClick={() => setVistaPareto(v.key)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                          vistaPareto === v.key
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
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
                              {totalVentas > 0 && <th className="px-4 py-2.5 text-right" title="Cartera como % de ventas del año">Ratio C/V</th>}
                              {totalVentas > 0 && <th className="px-4 py-2.5 text-right" title="Días promedio de cobranza (DSO)">Días cob.</th>}
                              <th className="px-4 py-2.5 text-right">% total</th>
                              <th className="px-4 py-2.5 text-right">% Acum.</th>
                              <th className="px-4 py-2.5 text-right">Mora +90d</th>
                              <th className="px-4 py-2.5 text-center">Inst.</th>
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
                                    {g.ratio_cartera_ventas != null
                                      ? <span className={`font-bold ${g.ratio_cartera_ventas > 50 ? 'text-red-700' : g.ratio_cartera_ventas > 25 ? 'text-orange-600' : 'text-green-700'}`}>{g.ratio_cartera_ventas}%</span>
                                      : <span className="text-gray-300">—</span>}
                                  </td>}
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
                        <span className="text-xs text-gray-400">Top {microData.length} instituciones por cartera — coloreadas por grupo</span>
                        <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          {clientesEn80} inst. concentran el 80% de la deuda
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
                      <div className="overflow-x-auto rounded-xl border border-indigo-200 mt-4">
                        <table className="w-full text-sm">
                          <thead className="bg-[#1a1a2e] text-white text-xs">
                            <tr>
                              <th className="px-3 py-2.5 text-right w-8">#</th>
                              <th className="px-4 py-2.5 text-left">Institución</th>
                              <th className="px-4 py-2.5 text-left">Grupo</th>
                              <th className="px-4 py-2.5 text-left">Ciudad</th>
                              <th className="px-4 py-2.5 text-right">Cartera</th>
                              {totalVentas > 0 && <th className="px-4 py-2.5 text-right">Ventas</th>}
                              {totalVentas > 0 && <th className="px-4 py-2.5 text-right" title="Días de cobranza">Días cob.</th>}
                              <th className="px-4 py-2.5 text-right">Mora +90d</th>
                              <th className="px-4 py-2.5 text-right">%</th>
                              <th className="px-4 py-2.5 text-right">% Acum.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paretoClientes.map((c, i) => (
                              <tr key={`${c.cliente_nit}-${i}`}
                                className={`border-t border-gray-100 hover:bg-indigo-50 transition-colors ${c.porcentaje_acumulado > 80 ? 'opacity-50' : ''}`}>
                                <td className="px-3 py-2 text-right text-gray-400 font-mono text-xs">{i + 1}</td>
                                <td className="px-4 py-2 font-semibold text-gray-900 max-w-[200px] truncate">{c.cliente_nombre}</td>
                                <td className="px-4 py-2">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: grupoColor(c.grupo) }}>
                                    <span className="w-2 h-2 rounded-full" style={{ background: grupoColor(c.grupo) }} />
                                    {c.grupo.replace('Grupo ', '')}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-gray-500 text-xs">{c.ciudad || '—'}</td>
                                <td className="px-4 py-2 text-right font-extrabold text-[#0f3460]">{fmtM(c.total_deuda)}</td>
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
                            ))}
                          </tbody>
                        </table>
                      </div>
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
                              {g.clientes_count} {g.clientes_count === 1 ? 'institución' : 'instituciones'}
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
                              INSTITUCIONES — {g.grupo.toUpperCase()}
                            </span>
                            <span className="text-xs text-indigo-600 font-semibold">Mayor a menor deuda</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-indigo-200 text-indigo-900">
                                <tr>
                                  <th className="px-5 py-2 text-left w-8">#</th>
                                  <th className="px-4 py-2 text-left">Institución</th>
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
                                {g.clientes.map((cl, ci) => (
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
                                    Total {g.grupo} · {g.clientes_count} instituciones
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
          <section className="bg-white rounded-2xl shadow-sm p-7">
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
                  onClick={() => setFiltroRiesgo(p.key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${filtroRiesgo === p.key ? p.act : p.cls + ' hover:opacity-80'}`}
                >
                  {p.label}
                  {p.key !== 'todos' && (
                    <span className="ml-1.5 opacity-75">
                      ({cartera.filter(c => nivelRiesgo(c) === p.key).length})
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
                    <th className="px-3 py-3 text-left w-[20%]">Cliente</th>
                    <th className="px-3 py-3 text-left w-[11%]">Ciudad</th>
                    <th className="px-3 py-3 text-left w-[29%]">Línea(s)</th>
                    <th className="px-3 py-3 text-right w-[10%]">Total</th>
                    <th className="px-3 py-3 text-right w-[10%]">Vencida</th>
                    <th className="px-3 py-3 text-right w-[10%]">+90d</th>
                    <th className="px-3 py-3 text-center w-[10%]">Estado</th>
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
                              <span className="max-w-[220px] truncate text-base lg:text-lg font-bold" title={c.cliente_nombre}>
                                {c.cliente_nombre}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500 mt-1 ml-7 font-mono tracking-wide"><span className="font-bold text-gray-400 not-italic mr-1">NIT</span>{c.cliente_nit}</div>
                          </td>
                          <td className="px-3 py-4 text-gray-600 align-top">{c.ciudad || '—'}</td>
                          <td className="px-3 py-4 text-gray-600 text-sm break-words leading-5 align-top" title={c.vendedor || '—'}>
                            {c.vendedor || '—'}
                          </td>
                          <td className="px-3 py-4 text-right font-extrabold text-[#0f3460] whitespace-nowrap align-top">{fmtM(c.total_deuda)}</td>
                          <td className="px-3 py-4 text-right text-orange-600 font-semibold whitespace-nowrap align-top">{fmtM(vencida)}</td>
                          <td className="px-3 py-4 text-right text-red-900 font-bold whitespace-nowrap align-top">{fmtM(mas90)}</td>
                          <td className="px-3 py-4 text-center align-top">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeCls(nivel)}`}>
                              {nivel.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                        {isOpen && <FilaFacturas nit={c.cliente_nit} cols={8} filtro={filtro} />}
                      </Fragment>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                   {(() => {
                     const fil = carteraFiltradaRiesgo
                     return (
                      <tr>
                        <td colSpan={4} className="px-3 py-3 font-bold text-gray-700">
                          TOTALES {filtroRiesgo !== 'todos' && `(${fil.length} clientes filtrados)`}
                        </td>
                        <td className="px-3 py-3 text-right font-extrabold text-slate-800">{fmtM(fil.reduce((s,c)=>s+c.total_deuda,0))}</td>
                        <td className="px-3 py-3 text-right font-bold text-orange-600">{fmtM(fil.reduce((s,c)=>s+c.dias_1_30+c.dias_31_60+c.dias_61_90+c.dias_91_180+c.mas_180_dias,0))}</td>
                        <td className="px-3 py-3 text-right font-bold text-red-900">{fmtM(fil.reduce((s,c)=>s+c.dias_91_180+c.mas_180_dias,0))}</td>
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
          <section className="bg-white rounded-2xl shadow-sm p-7">
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
                        <td className="px-4 py-4 text-gray-500 font-mono text-sm">{pv.num_doc}</td>
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
          <section className="bg-white rounded-2xl shadow-sm p-7">
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
                                  {reg.ciudades.map((ciu: CiudadAgregada, ci) => {
                                    const ciuKey = `${regKey}::${ciu.ciudad}`
                                    const ciuOpen = expRegionesCiudades.has(ciuKey)
                                    return (
                                      <div key={ciu.ciudad} className="border-t border-purple-200">
                                        {/* Ciudad header */}
                                        <button
                                          onClick={e => { e.stopPropagation(); setExpRegionesCiudades(prev => toggleSet(prev, ciuKey)) }}
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
                                          <table className="w-full text-sm border-t border-purple-100">
                                            <thead className="bg-purple-200 text-purple-900">
                                              <tr>
                                                <th className="px-6 py-2 text-left w-8">#</th>
                                                <th className="px-4 py-2 text-left">Institución</th>
                                                <th className="px-4 py-2 text-left">NIT</th>
                                                <th className="px-4 py-2 text-right">Total</th>
                                                <th className="px-4 py-2 text-right">Vigente</th>
                                                <th className="px-4 py-2 text-right">+90d</th>
                                                <th className="px-4 py-2 text-center">Mora máx.</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {ciu.clientes.map((cl, cli) => (
                                                <tr key={cl.cliente_nit} className="border-t border-purple-100 hover:bg-purple-50">
                                                  <td className="px-6 py-2 text-gray-400">{cli + 1}</td>
                                                  <td className="px-4 py-2 font-semibold text-gray-900">{cl.cliente_nombre}</td>
                                                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{cl.cliente_nit}</td>
                                                  <td className="px-4 py-2 text-right font-bold text-[#0f3460]">{fmtM(cl.total_deuda)}</td>
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
                                                <td className="px-4 py-1.5 text-right text-green-700 font-bold text-sm">{fmtM(ciu.vigente)}</td>
                                                <td className="px-4 py-1.5 text-right text-red-900 font-bold text-sm">{fmtM(ciu.dias_91_mas)}</td>
                                                <td />
                                              </tr>
                                            </tfoot>
                                          </table>
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
              SECCIÓN 4 — CARTERA POR LÍNEA
          ══════════════════════════════════════════════════════════════ */}
          <section className="bg-white rounded-2xl shadow-sm p-7">
            <SectionHeader
              icon={<UserCheck className="h-7 w-7" />}
              title="CARTERA POR LÍNEA"
              count={`${comerciales.length} líneas`}
              color="teal"
            />
            <BuscarInput value={busComerciales} onChange={v => { setBusComerciales(v); setPageComerciales(1) }} placeholder="Buscar por línea o código..." />

            {/* Orden */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-600 font-semibold">Ordenar:</span>
              {(['az', 'deuda'] as const).map(o => (
                <button
                  key={o}
                  onClick={() => { setOrdenLineas(o); setPageComerciales(1) }}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${ordenLineas === o ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'}`}
                >
                  {o === 'az' ? 'A–Z' : 'Mayor deuda'}
                </button>
              ))}
            </div>

            {comercQ.isLoading && (
              <div className="flex justify-center py-8"><Spinner className="h-10 w-10" /></div>
            )}
            {!comercQ.isLoading && comerciales.length === 0 && (
              <p className="text-gray-400 text-lg py-6 text-center">Sin datos de líneas</p>
            )}
            {comercialesFiltrados.length > 0 && (
              <div className="space-y-3">
                {comercialesPageItems.map((com: LineaAgregada, idx) => {
                  const isOpen = expComerciales.has(com.vendedor)
                  const pctVencNum = com.total_deuda > 0
                    ? (com.total_vencida / com.total_deuda) * 100
                    : 0
                  const pctVencFmt = fmtPct(pctVencNum)
                  const badgeVenc = pctVencNum > 60 ? 'bg-red-100 text-red-800' : pctVencNum > 30 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                  return (
                    <div key={com.vendedor} className="border border-teal-200 rounded-2xl overflow-hidden shadow-sm">
                      {/* Cabecera — clic para expandir */}
                      <button
                        onClick={() => setExpComerciales(prev => toggleSet(prev, com.vendedor))}
                        className="w-full text-left"
                      >
                        <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-3 px-5 py-4 bg-white hover:bg-teal-50 transition-colors">
                          <span className="text-gray-400 font-mono text-sm w-6 shrink-0 text-right">
                            {(Math.min(pageComerciales, comercialesPages) - 1) * PAGE_SIZE + idx + 1}
                          </span>
                          {isOpen
                            ? <ChevronDown className="h-5 w-5 text-teal-600 shrink-0" />
                            : <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-lg sm:text-xl font-extrabold text-gray-900 break-words">{com.linea || com.vendedor}</span>
                              {com.cod_vend && (
                                <span className="bg-teal-100 text-teal-700 text-xs font-bold px-2 py-0.5 rounded-full border border-teal-200 shrink-0">
                                  Cód. {com.cod_vend}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {com.clientes_count} {com.clientes_count === 1 ? 'institución' : 'instituciones'}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full sm:w-auto sm:min-w-[420px]">
                            <div className="text-right bg-slate-50 rounded-lg px-2 py-1.5">
                              <p className="text-xs text-gray-500 font-medium">Total</p>
                              <p className="text-xl font-extrabold text-[#0f3460]">{fmtM(com.total_deuda)}</p>
                            </div>
                            <div className="text-right bg-slate-50 rounded-lg px-2 py-1.5">
                              <p className="text-xs text-gray-500 font-medium">Vencida</p>
                              <p className={`text-lg font-bold ${pctVencNum > 60 ? 'text-red-700' : pctVencNum > 30 ? 'text-orange-600' : 'text-green-700'}`}>
                                {fmtM(com.total_vencida)}
                              </p>
                            </div>
                            <div className="text-right bg-slate-50 rounded-lg px-2 py-1.5">
                              <p className="text-xs text-gray-500 font-medium">% Vencida</p>
                              <span className={`px-2.5 py-1 rounded-full text-sm font-bold ${badgeVenc}`}>{pctVencFmt}</span>
                            </div>
                            <div className="text-right bg-slate-50 rounded-lg px-2 py-1.5">
                              <p className="text-xs text-gray-500 font-medium">% Total</p>
                              <p className="text-base font-bold text-gray-700">{com.porcentaje}%</p>
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Detalle de instituciones */}
                      {isOpen && (
                        <div className="border-t border-teal-200 bg-teal-50">
                          <div className="px-5 py-3 bg-teal-100 flex items-center justify-between">
                            <span className="text-sm font-bold text-teal-800 uppercase tracking-wide">
                              INSTITUCIONES — {(com.linea || com.vendedor).toUpperCase()}
                            </span>
                            <span className="text-xs text-teal-600 font-semibold">Mayor a menor deuda</span>
                          </div>
                          <div className="divide-y divide-teal-100">
                            {com.clientes.map((cl, ci) => (
                              <div key={cl.cliente_nit} className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-3.5 hover:bg-teal-100 transition-colors">
                                <span className="text-gray-400 font-mono text-sm w-6 text-right shrink-0">{ci + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-gray-900 text-base">{cl.cliente_nombre}</p>
                                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                                    NIT {cl.cliente_nit}{cl.ciudad ? ` · ${cl.ciudad}` : ''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-5 shrink-0 text-right">
                                  <div>
                                    <p className="text-xs text-gray-500">Total</p>
                                    <p className="font-extrabold text-[#0f3460] text-base">{fmtM(cl.total_deuda)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Vigente</p>
                                    <p className="font-semibold text-green-700 text-sm">{fmtM(cl.vigente)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">+90d mora</p>
                                    <p className="font-bold text-red-900 text-sm">{fmtM(cl.dias_91_180 + cl.mas_180_dias)}</p>
                                  </div>
                                  <div className="w-20 text-center">
                                    {cl.dias_mora_max > 0
                                      ? <span className="bg-red-100 text-red-800 px-2.5 py-1 rounded-full text-sm font-bold">{cl.dias_mora_max}d</span>
                                      : <span className="text-green-600 text-sm font-semibold">Al día</span>
                                    }
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <PaginationControls
              page={Math.min(pageComerciales, comercialesPages)}
              pages={comercialesPages}
              onChange={setPageComerciales}
            />
          </section>



        </div>
      )}
    </div>
  )
}
