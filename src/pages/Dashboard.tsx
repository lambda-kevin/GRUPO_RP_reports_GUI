import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import {
  TrendingUp, DollarSign, Users,
  CheckCircle, Clock, Activity, Search,
  Calendar, ShieldAlert, Building2, RefreshCw,
} from 'lucide-react'
import { getDashboardResumen } from '../api/dashboard'
import { Spinner, PageLoader } from '../components/ui/Spinner'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { fmtCOP, fmtCOPShort, fmtPct } from '../utils/fmt'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { BancosResumen, CarteraResumen, GrupoCartDash } from '../types'

const hasBancos = (b: unknown): b is BancosResumen =>
  typeof b === 'object' && b !== null && 'fecha_corte' in b
const hasCartera = (c: unknown): c is CarteraResumen =>
  typeof c === 'object' && c !== null && 'total_cartera' in c

const hoy = () => new Date().toISOString().slice(0, 10)

const parseLocalDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const TRAMO_COLORS: Record<string, string> = {
  'Vigente':  '#16a34a',
  '1-30 d':   '#65a30d',
  '31-60 d':  '#ca8a04',
  '61-90 d':  '#ea580c',
  '91-180 d': '#dc2626',
  '+180 d':   '#7f1d1d',
}

const GRUPO_COLOR_DASH: Record<string, string> = {
  'Grupo Zentria':    '#0f3460',
  'Grupo SURA':       '#1d4ed8',
  'Grupo Quirónsalud':'#7c3aed',
  'Grupo AUNA':       '#0891b2',
  'Otros':            '#94a3b8',
}
const gColorDash = (g: string) => GRUPO_COLOR_DASH[g] ?? '#64748b'

interface KPIProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  color: 'green' | 'red' | 'orange' | 'gray' | 'blue'
  pct?: number
}

const KPI = ({ label, value, sub, icon, color, pct }: KPIProps) => {
  const bg = {
    green:  'bg-green-50 border-green-200',
    red:    'bg-red-50 border-red-200',
    orange: 'bg-orange-50 border-orange-200',
    gray:   'bg-gray-50 border-gray-200',
    blue:   'bg-blue-50 border-blue-200',
  }[color]
  const iconCls = {
    green:  'text-green-600',
    red:    'text-red-600',
    orange: 'text-orange-500',
    gray:   'text-gray-500',
    blue:   'text-blue-600',
  }[color]
  const valCls = {
    green:  'text-green-800',
    red:    'text-red-700',
    orange: 'text-orange-700',
    gray:   'text-gray-800',
    blue:   'text-blue-800',
  }[color]

  return (
    <div className={`rounded-2xl border p-5 ${bg} flex flex-col gap-2`}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-bold text-gray-600 uppercase tracking-wide leading-tight">{label}</p>
        <span className={`${iconCls} opacity-70`}>{icon}</span>
      </div>
      <p className={`text-2xl font-extrabold ${valCls} leading-snug break-all`}>{value}</p>
      {(sub || pct !== undefined) && (
        <p className="text-sm text-gray-500 mt-1">
          {pct !== undefined && <span className="font-semibold">{fmtPct(pct)} del total · </span>}
          {sub}
        </p>
      )}
    </div>
  )
}

export const Dashboard = () => {
  const [fechaInput, setFechaInput] = useState(hoy())
  const [fechaCorte, setFechaCorte] = useState<string | undefined>(undefined)

  const { data, isLoading, error, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-resumen', fechaCorte],
    queryFn: () => getDashboardResumen(fechaCorte),
    refetchInterval: 1000 * 60 * 5,
  })

  const aplicar = () => setFechaCorte(fechaInput || undefined)

  if (isLoading) return <PageLoader label="Cargando panel ejecutivo..." />

  if (error || !data) {
    return (
      <div className="p-6 text-center text-red-600 text-sm">
        Error cargando el panel. Intenta de nuevo.
      </div>
    )
  }

  const { bancos: bancosRaw, cartera: carteraRaw, pipelines } = data
  const bancos  = hasBancos(bancosRaw)   ? bancosRaw   : null
  const cartera = hasCartera(carteraRaw) ? carteraRaw  : null

  const ultimaActualizacion = dataUpdatedAt
    ? format(new Date(dataUpdatedAt), "d MMM yyyy · HH:mm", { locale: es })
    : null

  return (
    <div className="h-full overflow-y-auto bg-gray-50">

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 lg:px-10 py-4 flex flex-wrap items-center gap-4">
          <div className="min-w-[200px]">
            <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">PANEL EJECUTIVO</h1>
            <p className="text-xs text-gray-600 mt-0.5">GRUPO RP — Cartera en tiempo real</p>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 ml-auto">
            <Calendar className="h-4 w-4 text-gray-600 shrink-0" />
            <label className="text-sm font-semibold text-gray-700">Fecha de corte</label>
            <input
              type="date"
              value={fechaInput}
              onChange={e => setFechaInput(e.target.value)}
              className="text-base px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 w-40 min-h-touch"
            />
            <button
              onClick={aplicar}
              className="flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors min-h-touch"
            >
              <Search className="h-4 w-4" /> Consultar
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-600">
            {isFetching && <Spinner className="h-3.5 w-3.5" />}
            {ultimaActualizacion && <span>Act. {ultimaActualizacion}</span>}
            <button onClick={() => refetch()} title="Actualizar" className="p-1.5 rounded hover:text-green-700 hover:bg-gray-100 transition-colors min-h-touch min-w-touch flex items-center justify-center">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-10 space-y-8">

        {/* ── KPIs CARTERA ── */}
        {cartera ? (
          <>
            <div>
              <h2 className="text-base font-extrabold text-gray-700 uppercase tracking-widest mb-3">
                Cartera — Corte {format(parseLocalDate(cartera.fecha_corte), "d 'de' MMMM yyyy", { locale: es })}
              </h2>
              {/* Orden: Sin mora · Cartera total · Cartera vencida · Mora crítica */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPI
                  label="Sin mora (vigente)"
                  value={fmtCOP(cartera.frescas)}
                  sub="Cartera al corriente, sin vencimiento"
                  icon={<CheckCircle className="h-5 w-5" />}
                  color="gray"
                />
                <KPI
                  label="Cartera total"
                  value={fmtCOP(cartera.total_cartera)}
                  sub={`${cartera.clientes_count} clientes activos`}
                  icon={<DollarSign className="h-5 w-5" />}
                  color="green"
                />
                <KPI
                  label="Cartera vencida"
                  value={fmtCOP(cartera.total_vencida)}
                  sub="Facturas con días de mora"
                  pct={cartera.pct_vencida}
                  icon={<TrendingUp className="h-5 w-5" />}
                  color="orange"
                />
                <KPI
                  label="Mora crítica +90 días"
                  value={fmtCOP(cartera.mora_90)}
                  sub={`${cartera.clientes_criticos_count} clientes en mora crítica`}
                  pct={cartera.pct_mora_90}
                  icon={<ShieldAlert className="h-5 w-5" />}
                  color="red"
                />
              </div>
            </div>

            {/* ── DISTRIBUCIÓN + TOP CRÍTICOS ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* Distribución por tramo */}
              <Card className="shadow-sm lg:col-span-2">
                <div className="p-5">
                  <h3 className="text-base font-extrabold text-gray-700 uppercase tracking-wide mb-4">
                    DISTRIBUCIÓN POR TRAMO DE MORA
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={cartera.distribucion} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="tramo" tick={{ fontSize: 10, fill: '#111827' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#111827' }} tickFormatter={v => fmtCOPShort(v)} width={60} />
                      <Tooltip
                        formatter={(v: number) => fmtCOP(v as number)}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      />
                      <Bar dataKey="monto" name="Monto" radius={[4, 4, 0, 0]}>
                        {cartera.distribucion.map((d) => (
                          <Cell key={d.tramo} fill={TRAMO_COLORS[d.tramo] ?? '#94a3b8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Leyenda vertical con valores completos */}
                  <div className="flex flex-col gap-1 mt-3">
                    {cartera.distribucion.filter(d => d.monto > 0).map(d => (
                      <span key={d.tramo} className="flex items-center gap-2 text-xs text-gray-900">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ background: TRAMO_COLORS[d.tramo] ?? '#94a3b8' }} />
                        <span className="w-16 shrink-0">{d.tramo}</span>
                        <strong className="text-gray-900">{fmtCOP(d.monto)}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Top críticos */}
              <Card className="shadow-sm lg:col-span-3">
                <div className="p-5">
                  <h3 className="text-base font-extrabold text-gray-700 uppercase tracking-wide mb-4">
                    CLIENTES EN MORA CRÍTICA (+90 DÍAS)
                  </h3>
                  {cartera.top_criticos.length === 0 ? (
                    <div className="flex items-center gap-2 text-green-600 py-6">
                      <CheckCircle className="h-6 w-6" />
                      <p className="text-base font-semibold">Sin clientes en mora crítica</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cartera.top_criticos.map((c, i) => (
                        <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                          <span className="w-7 h-7 rounded-full bg-red-100 text-red-700 text-sm font-bold flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold text-gray-800 truncate">{c.nombre}</p>
                            <p className="text-sm text-gray-600 truncate">{c.ciudad}{c.vendedor ? ` · ${c.vendedor}` : ''}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base font-bold text-gray-900">{fmtCOP(c.mora_90)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>

          {/* ── GRUPOS EMPRESARIALES ── */}
          {!!cartera.grupos_cartera?.length && (
            <div>
              <h2 className="text-base font-extrabold text-gray-700 uppercase tracking-widest mb-3">
                Concentración por Grupo Empresarial
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {(cartera.grupos_cartera as GrupoCartDash[]).map(g => (
                  <div key={g.grupo}
                    className="rounded-xl border-l-4 bg-white border border-gray-100 shadow-sm p-3 flex flex-col gap-1"
                    style={{ borderLeftColor: gColorDash(g.grupo) }}>
                    <p className="text-xs font-bold text-gray-700 truncate">{g.grupo.replace('Grupo ', '')}</p>
                    <p className="text-base font-extrabold text-gray-900 break-all">
                      {fmtCOP(g.total_deuda)}
                    </p>
                    {g.mora_90 > 0 && (
                      <p className="text-xs font-semibold text-red-600">{fmtCOP(g.mora_90)} mora</p>
                    )}
                    <p className="text-xs text-gray-400">{g.clientes_count} inst.</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
        ) : (
          <Card>
            <div className="text-center py-10 text-gray-600">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Sin datos de cartera. Verifica la conexión con Saint.</p>
            </div>
          </Card>
        )}

        {/* ── BANCOS + PIPELINES ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {bancos && (
            <Card className="shadow-sm">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-extrabold text-gray-700 uppercase tracking-wide">
                    BANCOS — ÚLTIMO CORTE
                  </h3>
                  <span className="text-xs text-gray-600">
                    {format(parseLocalDate(bancos.fecha_corte), "d MMM yyyy", { locale: es })}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                    <p className="text-xs text-gray-500 font-semibold uppercase">Ingresos</p>
                    <p className="text-xl font-extrabold text-green-800">{fmtCOP(bancos.total_ingresos)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                    <p className="text-xs text-gray-500 font-semibold uppercase">Identificados</p>
                    <p className="text-xl font-extrabold text-blue-800">{fmtCOP(bancos.total_identificados)}</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                    <p className="text-xs text-gray-500 font-semibold uppercase">Sin identificar</p>
                    <p className="text-xl font-extrabold text-amber-700">{fmtCOP(bancos.total_no_identificados)}</p>
                  </div>
                  <div className={`rounded-xl p-3 border ${bancos.bancos_con_diferencia > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                    <p className="text-xs text-gray-500 font-semibold uppercase">Diferencias</p>
                    <p className={`text-xl font-extrabold ${bancos.bancos_con_diferencia > 0 ? 'text-red-700' : 'text-gray-600'}`}>
                      {bancos.bancos_con_diferencia > 0 ? `${bancos.bancos_con_diferencia} bancos` : 'Sin diferencias'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Building2 className="h-3.5 w-3.5" />
                  {bancos.total_transacciones.toLocaleString('es-CO')} transacciones procesadas
                </div>
                {!!bancos.top_regiones?.length && (
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                      Bancos · Top regiones
                    </p>
                    <div className="space-y-1.5">
                      {bancos.top_regiones.slice(0, 3).map((r) => (
                        <div key={r.departamento} className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-gray-700">{r.departamento}</span>
                          <span className="text-gray-600">
                            {fmtCOPShort(r.ventas)} / {fmtCOPShort(r.recaudo)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card className="shadow-sm">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-extrabold text-gray-700 uppercase tracking-wide">
                  ESTADO DE PIPELINES
                </h3>
                <Activity className="h-5 w-5 text-gray-600" />
              </div>
              <div className="space-y-2">
                {pipelines.map((p) => (
                  <div key={p.nombre} className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
                    <Badge nivel={p.nivel}>{p.estado}</Badge>
                    <span className="flex-1 text-base font-semibold text-gray-700">{p.nombre}</span>
                    <span className="text-sm text-gray-500 flex items-center gap-1 shrink-0">
                      <Clock className="h-4 w-4" />
                      {p.ultima_ejecucion
                        ? format(new Date(p.ultima_ejecucion), "d MMM · HH:mm", { locale: es })
                        : 'N/A'}
                    </span>
                  </div>
                ))}
                {pipelines.length === 0 && (
                  <p className="text-base text-gray-500 text-center py-6">Sin datos de pipelines</p>
                )}
              </div>
            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}
