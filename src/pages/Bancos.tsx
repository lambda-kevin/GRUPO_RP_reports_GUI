import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  TrendingUp,
  TrendingDown,
  CreditCard,
  BarChart3,
  Download,
  Activity,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

import { StatCard } from '../components/dashboard/StatCard'
import { Card } from '../components/ui/Card'
import { PageLoader } from '../components/ui/Spinner'
import { fmtCOP } from '../utils/fmt'
import { getConsolidacionReciente, getConsolidaciones, descargarExcelConsolidacion } from '../api/dashboard'

// ── Colores bancarios (coinciden con el Excel de BANCOS-RP) ──────────────────

const BANCO_COLORS: Record<string, string> = {
  'Banco de Bogota': '#C00000',
  'Bco Bta Miami':   '#C00000',
  'Davivienda cte':  '#E00000',
  'Davivienda ah':   '#E07070',
  'Bco Agrario':     '#538135',
  'Bancolombia CTE': '#FFC000',
  'Bancolombia Ah':  '#FFD966',
  'Fiducia':         '#F4B942',
  'Banco Pichincha': '#1F618D',
  'Bco Occid':       '#7030A0',
  'BBVA':            '#004481',
  'Bancoomeva':      '#2E75B6',
  'AV Villas':       '#70AD47',
  'Itau CTE':        '#FF6600',
  'Itau Ah':         '#FF9944',
  'Colpatria':       '#FF0000',
  'Bco de Bta ah':   '#A93226',
}

const FALLBACK_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1',
]

function getBancoColor(banco: string, index: number): string {
  if (BANCO_COLORS[banco]) return BANCO_COLORS[banco]
  const key = Object.keys(BANCO_COLORS).find(
    k => banco.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(banco.toLowerCase())
  )
  return key ? BANCO_COLORS[key] : FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

function getBancoInitials(banco: string): string {
  return banco
    .split(/\s+/)
    .filter(w => w.length > 1)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join('')
}

// ── Helpers de fecha ─────────────────────────────────────────────────────────

const MESES_LARGO = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

function parseDateParts(iso: string | null): { day: number; month: number; year: number } | null {
  if (!iso) return null
  const dateStr = iso.split('T')[0]
  const parts = dateStr.split('-').map(Number)
  if (parts.length < 3 || isNaN(parts[0])) return null
  return { year: parts[0], month: parts[1], day: parts[2] }
}

function formatFechaLarga(iso: string | null): string {
  const p = parseDateParts(iso)
  if (!p) return '—'
  return `${p.day} de ${MESES_LARGO[p.month - 1]} de ${p.year}`
}

function formatFechaCorta(iso: string | null): string {
  const p = parseDateParts(iso)
  if (!p) return '—'
  return `${p.day} ${MESES_CORTO[p.month - 1]}`
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function Bancos() {
  const {
    data: reciente,
    isLoading: loadingReciente,
    error: errorReciente,
  } = useQuery({
    queryKey: ['bancos-reciente'],
    queryFn: getConsolidacionReciente,
    refetchInterval: 5 * 60 * 1000,
  })

  const { data: consolidaciones } = useQuery({
    queryKey: ['bancos-consolidaciones'],
    queryFn: getConsolidaciones,
    refetchInterval: 10 * 60 * 1000,
  })

  // ── Agregaciones ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!reciente?.transacciones) return null

    const creditos = reciente.transacciones.filter(t => t.es_credito)
    const totalIngresado = creditos.reduce((sum, t) => sum + (t.credito ?? 0), 0)
    const totalMovimientos = creditos.length

    const byBanco: Record<string, { credito: number; count: number }> = {}
    for (const t of creditos) {
      if (!byBanco[t.banco]) byBanco[t.banco] = { credito: 0, count: 0 }
      byBanco[t.banco].credito += t.credito ?? 0
      byBanco[t.banco].count  += 1
    }

    const bancoList = Object.entries(byBanco)
      .map(([banco, v]) => ({ banco, ...v }))
      .sort((a, b) => b.credito - a.credito)

    return { totalIngresado, totalMovimientos, bancoList, bancoLider: bancoList[0] ?? null }
  }, [reciente])

  // ── Cobros: sin_cobrar vs cobrado ─────────────────────────────────────────

  const cobros = useMemo(() => {
    if (!reciente?.transacciones) return null

    const todas = reciente.transacciones
    const totalSinCobrar = todas.reduce((sum, t) => sum + (t.sin_cobrar ?? 0), 0)
    const totalCobrado   = todas.reduce((sum, t) => sum + (t.cobrado   ?? 0), 0)

    const detalle = todas.filter(
      t => (t.sin_cobrar !== null && t.sin_cobrar !== 0) ||
           (t.cobrado   !== null && t.cobrado   !== 0)
    )

    return { detalle, totalSinCobrar, totalCobrado }
  }, [reciente])

  // ── Variación vs. consolidación anterior ─────────────────────────────────

  const variacion = useMemo<number | null>(() => {
    if (!consolidaciones || consolidaciones.length < 2) return null
    const curr = consolidaciones[0].total_transacciones
    const prev = consolidaciones[1].total_transacciones
    if (!prev) return null
    return ((curr - prev) / prev) * 100
  }, [consolidaciones])

  // ── Tendencia (últimas 8 consolidaciones) ────────────────────────────────

  const tendencia = useMemo(() => {
    if (!consolidaciones) return []
    return [...consolidaciones]
      .slice(0, 8)
      .reverse()
      .map(c => ({
        fecha:       formatFechaCorta(c.fecha_reporte),
        movimientos: c.total_transacciones,
        bancos:      c.total_bancos,
      }))
  }, [consolidaciones])

  // ── Guards ────────────────────────────────────────────────────────────────

  if (loadingReciente) return <PageLoader label="Cargando consolidación bancaria..." />

  if (errorReciente || !reciente) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Building2 className="h-12 w-12 text-slate-300" />
        <p className="text-slate-500 text-sm">No hay consolidaciones disponibles.</p>
      </div>
    )
  }

  const transaccionesCredito = (reciente.transacciones ?? []).filter(t => t.es_credito)
  const maxCredito = stats?.bancoList?.[0]?.credito ?? 1

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-10 space-y-10">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-1 rounded-full bg-primary-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Consolidación Bancaria
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap ml-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 border border-primary-200 px-3 py-1 text-xs font-medium text-primary-700">
              <Building2 className="h-3.5 w-3.5" />
              {formatFechaLarga(reciente.fecha_reporte ?? reciente.fecha_descarga)}
            </span>
            {reciente.fue_modificado && (
              <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Modificado manualmente
              </span>
            )}
            <span className="text-xs text-slate-400">
              {reciente.total_bancos} banco{reciente.total_bancos !== 1 ? 's' : ''} · {reciente.total_transacciones} movimientos totales
            </span>
          </div>
        </div>

        <button
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!reciente.archivo_excel}
          onClick={() => descargarExcelConsolidacion(reciente.id)}
        >
          <Download className="h-4 w-4" />
          Exportar Excel
        </button>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Ingresado"
          value={stats ? fmtCOP(stats.totalIngresado) : '—'}
          subtitle={`${formatFechaCorta(reciente.fecha_reporte)} · ${reciente.total_bancos} bancos`}
          icon={CreditCard}
          color="green"
        />
        <StatCard
          title="Movimientos"
          value={stats ? String(stats.totalMovimientos) : '—'}
          subtitle="transferencias y depósitos"
          icon={BarChart3}
          color="blue"
        />
        <StatCard
          title="Banco Líder"
          value={stats?.bancoLider?.banco ?? '—'}
          subtitle={stats?.bancoLider ? `${fmtCOP(stats.bancoLider.credito)} · ${stats.bancoLider.count} mov.` : undefined}
          icon={Building2}
          color="yellow"
        />

        {/* Variación — color condicional */}
        <div className="card p-5 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Vs. Anterior</p>
              <p className={`text-3xl font-semibold mb-1 ${
                variacion === null ? 'text-gray-400'
                : variacion >= 0   ? 'text-green-600'
                : 'text-red-600'
              }`}>
                {variacion === null
                  ? '—'
                  : `${variacion >= 0 ? '+' : ''}${variacion.toFixed(1)}%`}
              </p>
              <p className="text-sm text-gray-500">
                {consolidaciones && consolidaciones.length > 1
                  ? `vs ${formatFechaCorta(consolidaciones[1].fecha_reporte)}`
                  : 'sin datos anteriores'}
              </p>
            </div>
            <div className={`p-3 rounded-xl ${
              variacion === null ? 'bg-gray-50'
              : variacion >= 0   ? 'bg-green-50'
              : 'bg-red-50'
            }`}>
              {variacion === null
                ? <Activity     className="h-6 w-6 text-gray-400"  />
                : variacion >= 0
                ? <TrendingUp   className="h-6 w-6 text-green-600" />
                : <TrendingDown className="h-6 w-6 text-red-600"   />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sección: Estado de Cobros ────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-6 w-1 rounded-full bg-amber-500" />
          <h2 className="text-base font-bold text-slate-800 tracking-tight">Estado de Cobros</h2>
          <span className="text-xs text-slate-400 font-normal">· identificados vs. pendientes por cobrar</span>
        </div>

        {/* Tarjetas resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">

          <div className="card p-5 border-l-4 border-l-green-500 hover:shadow transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Cobrado</p>
                <p className="text-2xl font-bold text-green-700 tabular-nums">
                  {cobros ? fmtCOP(cobros.totalCobrado) : '—'}
                </p>
                <p className="text-sm text-gray-500 mt-1">Pagos identificados y aplicados</p>
              </div>
              <div className="p-3 rounded-xl bg-green-50">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="card p-5 border-l-4 border-l-amber-500 hover:shadow transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Sin Cobrar</p>
                <p className="text-2xl font-bold text-amber-700 tabular-nums">
                  {cobros ? fmtCOP(cobros.totalSinCobrar) : '—'}
                </p>
                <p className="text-sm text-gray-500 mt-1">Pagos pendientes de identificar</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50">
                <Clock className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabla de cobros */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-700 mb-5">
            Detalle de Cobros
            <span className="ml-2 text-slate-400 font-normal text-xs">· transacciones con estado de cobro registrado</span>
          </h3>

          {!cobros?.detalle.length ? (
            <div className="flex items-center justify-center h-28 text-slate-400 text-sm">
              No hay transacciones con estado de cobro registrado
            </div>
          ) : (
            <div className="overflow-auto max-h-[32rem]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left text-xs font-semibold text-slate-600 py-3 px-3">Descripción</th>
                    <th className="text-left text-xs font-semibold text-slate-600 py-3 px-3">Banco</th>
                    <th className="text-left text-xs font-semibold text-slate-600 py-3 px-3">Fecha</th>
                    <th className="text-right text-xs font-semibold text-green-700 py-3 px-3">
                      <span className="inline-flex items-center gap-1 justify-end">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Cobrado
                      </span>
                    </th>
                    <th className="text-right text-xs font-semibold text-amber-700 py-3 px-3">
                      <span className="inline-flex items-center gap-1 justify-end">
                        <Clock className="h-3.5 w-3.5" />
                        Sin Cobrar
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cobros.detalle.map((tx, idx) => {
                    const color    = getBancoColor(tx.banco, idx)
                    const initials = getBancoInitials(tx.banco)
                    const label    = tx.detalle || tx.concepto || '—'
                    const rowBg    = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'

                    return (
                      <tr
                        key={tx.id}
                        className={`${rowBg} hover:bg-amber-50/30 transition-colors border-b border-slate-100`}
                      >
                        <td className="py-3 px-3">
                          <p className="text-slate-800 font-medium leading-tight line-clamp-1">{label}</p>
                          {tx.documento && (
                            <p className="text-xs text-slate-400 mt-0.5">Ref. {tx.documento}</p>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="flex-shrink-0 inline-flex items-center justify-center h-6 w-6 rounded text-white text-xs font-bold"
                              style={{ backgroundColor: color }}
                              title={tx.banco}
                            >
                              {initials}
                            </span>
                            <span className="text-xs text-slate-500 truncate max-w-[7rem]">{tx.banco}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">
                          {tx.fecha ? formatFechaCorta(tx.fecha) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          {tx.cobrado != null && tx.cobrado !== 0
                            ? <span className="font-semibold text-green-700">{fmtCOP(tx.cobrado)}</span>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          {tx.sin_cobrar != null && tx.sin_cobrar !== 0
                            ? <span className="font-semibold text-amber-700">{fmtCOP(tx.sin_cobrar)}</span>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300">
                    <td colSpan={3} className="py-3 px-3 text-xs font-bold text-slate-600 uppercase tracking-wide">
                      Total General
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      <span className="font-bold text-green-700 text-sm">{fmtCOP(cobros.totalCobrado)}</span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      <span className="font-bold text-amber-700 text-sm">{fmtCOP(cobros.totalSinCobrar)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* ── Sección: Movimientos de Crédito ─────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-6 w-1 rounded-full bg-blue-500" />
          <h2 className="text-base font-bold text-slate-800 tracking-tight">Movimientos de Crédito</h2>
          <span className="text-xs text-slate-400 font-normal">· ingresos registrados en el período</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Ingresos por banco */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-5">
              Ingresos por Banco
              {reciente.fecha_reporte && (
                <span className="ml-2 text-slate-400 font-normal text-xs">
                  · {formatFechaCorta(reciente.fecha_reporte)}
                </span>
              )}
            </h3>

            {!stats?.bancoList?.length ? (
              <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                Sin movimientos de crédito registrados
              </div>
            ) : (
              <ul className="space-y-4">
                {stats.bancoList.map((item, idx) => {
                  const color    = getBancoColor(item.banco, idx)
                  const initials = getBancoInitials(item.banco)
                  const pct      = maxCredito > 0 ? (item.credito / maxCredito) * 100 : 0

                  return (
                    <li key={item.banco}>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                          style={{ backgroundColor: color }}
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-sm font-semibold text-slate-700 truncate">{item.banco}</span>
                            <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color }}>
                              {fmtCOP(item.credito)}
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, backgroundColor: color }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {item.count} movimiento{item.count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {/* Detalle de movimientos */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-5">
              Detalle de Movimientos
              <span className="ml-2 text-slate-400 font-normal text-xs">· solo créditos</span>
            </h3>

            {!transaccionesCredito.length ? (
              <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                Sin movimientos registrados
              </div>
            ) : (
              <div className="overflow-auto max-h-[28rem]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left text-xs font-semibold text-slate-600 py-2.5 pl-2 pr-3">Descripción</th>
                      <th className="text-left text-xs font-semibold text-slate-600 py-2.5 pr-3">Banco</th>
                      <th className="text-right text-xs font-semibold text-slate-600 py-2.5 pr-2">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transaccionesCredito.map((tx, idx) => {
                      const color    = getBancoColor(tx.banco, 0)
                      const initials = getBancoInitials(tx.banco)
                      const label    = tx.detalle || tx.concepto || '—'
                      const rowBg    = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'

                      return (
                        <tr
                          key={tx.id}
                          className={`${rowBg} hover:bg-blue-50/40 transition-colors border-b border-slate-100`}
                        >
                          <td className="py-3 pl-2 pr-3">
                            <p className="text-slate-700 font-medium leading-tight line-clamp-1">{label}</p>
                            {tx.documento && (
                              <p className="text-xs text-slate-400">Ref. {tx.documento}</p>
                            )}
                          </td>
                          <td className="py-3 pr-3">
                            <span
                              className="inline-flex items-center justify-center h-6 w-6 rounded text-white text-xs font-bold"
                              style={{ backgroundColor: color }}
                              title={tx.banco}
                            >
                              {initials}
                            </span>
                          </td>
                          <td className="py-3 pr-2 text-right tabular-nums font-semibold text-slate-800">
                            {fmtCOP(tx.credito ?? 0)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {stats && transaccionesCredito.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-slate-300">
                        <td colSpan={2} className="py-3 pl-2 text-xs font-bold text-slate-600 uppercase tracking-wide">
                          Total del Día
                        </td>
                        <td className="py-3 pr-2 text-right tabular-nums font-bold text-primary-700">
                          {fmtCOP(stats.totalIngresado)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* ── Tendencia de consolidaciones ─────────────────────────────────── */}
      {tendencia.length > 1 && (
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-6 w-1 rounded-full bg-slate-400" />
            <h2 className="text-base font-bold text-slate-800 tracking-tight">Tendencia Histórica</h2>
            <span className="text-xs text-slate-400 font-normal">
              · últimas {tendencia.length} consolidaciones
            </span>
          </div>

          <Card>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={tendencia} barGap={4} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="fecha"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
                  }}
                  formatter={(value: number, name: string) => [
                    value,
                    name === 'movimientos' ? 'Movimientos' : 'Bancos activos',
                  ]}
                />
                <Bar dataKey="movimientos" fill="#3B82F6" radius={[5, 5, 0, 0]} maxBarSize={40} />
                <Bar dataKey="bancos"      fill="#10B981" radius={[5, 5, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-3 flex items-center gap-5 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />
                Movimientos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                Bancos activos
              </span>
            </div>
          </Card>
        </section>
      )}
    </div>
  )
}
