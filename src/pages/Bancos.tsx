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
import { fmtCOP, fmtCOPShort } from '../utils/fmt'
import { getConsolidacionReciente, getConsolidaciones } from '../api/dashboard'

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

const MESES_LARGO  = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MESES_CORTO  = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

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

  // ── Agregaciones sobre las transacciones de la consolidación reciente ──────

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

    return {
      totalIngresado,
      totalMovimientos,
      bancoList,
      bancoLider: bancoList[0] ?? null,
    }
  }, [reciente])

  // ── Variación de actividad vs. consolidación anterior (en % de movimientos) ─

  const variacion = useMemo<number | null>(() => {
    if (!consolidaciones || consolidaciones.length < 2) return null
    const curr = consolidaciones[0].total_transacciones
    const prev = consolidaciones[1].total_transacciones
    if (!prev) return null
    return ((curr - prev) / prev) * 100
  }, [consolidaciones])

  // ── Datos para el gráfico de tendencia (últimas 8 consolidaciones) ─────────

  const tendencia = useMemo(() => {
    if (!consolidaciones) return []
    return [...consolidaciones]
      .slice(0, 8)
      .reverse()
      .map(c => ({
        fecha:         formatFechaCorta(c.fecha_reporte),
        movimientos:   c.total_transacciones,
        bancos:        c.total_bancos,
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
    <div className="p-6 lg:p-10 space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 border border-primary-200 px-3 py-1 text-xs font-medium text-primary-700">
              <Building2 className="h-3.5 w-3.5" />
              {formatFechaLarga(reciente.fecha_reporte ?? reciente.fecha_descarga)}
            </span>
            {reciente.fue_modificado && (
              <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Modificado manualmente
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            Consolidación más reciente · {reciente.total_bancos} banco{reciente.total_bancos !== 1 ? 's' : ''} · {reciente.total_transacciones} movimientos totales
          </p>
        </div>

        <button
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!reciente.archivo_excel}
          onClick={() => {
            if (reciente.archivo_excel) window.open(reciente.archivo_excel, '_blank')
          }}
        >
          <Download className="h-4 w-4" />
          Exportar Excel
        </button>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total ingresado"
          value={stats ? fmtCOPShort(stats.totalIngresado) : '—'}
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
          title="Banco líder"
          value={stats?.bancoLider?.banco ?? '—'}
          subtitle={stats?.bancoLider ? `${fmtCOPShort(stats.bancoLider.credito)} · ${stats.bancoLider.count} mov.` : undefined}
          icon={Building2}
          color="yellow"
        />

        {/* Variación — card custom para texto con color condicional */}
        <div className="card p-5 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Vs. anterior</p>
              <p className={`text-3xl font-semibold mb-1 ${
                variacion === null
                  ? 'text-gray-400'
                  : variacion >= 0 ? 'text-green-600' : 'text-red-600'
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
                ? <Activity   className="h-6 w-6 text-gray-400" />
                : variacion >= 0
                ? <TrendingUp   className="h-6 w-6 text-green-600" />
                : <TrendingDown className="h-6 w-6 text-red-600"   />
              }
            </div>
          </div>
        </div>
      </div>

      {/* ── Desglose por banco + Detalle de movimientos ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Ingresos por banco */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Ingresos por banco
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
            <ul className="space-y-5">
              {stats.bancoList.map((item, idx) => {
                const color   = getBancoColor(item.banco, idx)
                const initials = getBancoInitials(item.banco)
                const pct     = maxCredito > 0 ? (item.credito / maxCredito) * 100 : 0

                return (
                  <li key={item.banco}>
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div
                        className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                        style={{ backgroundColor: color }}
                      >
                        {initials}
                      </div>

                      {/* Nombre + barra + monto */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-700 truncate">{item.banco}</span>
                          <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color }}>
                            {fmtCOPShort(item.credito)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">
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
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Detalle de movimientos
            <span className="ml-2 text-slate-400 font-normal text-xs">· solo créditos</span>
          </h3>

          {!transaccionesCredito.length ? (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
              Sin movimientos registrados
            </div>
          ) : (
            <div className="overflow-auto max-h-[28rem]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-semibold text-slate-500 pb-2 pr-3">Descripción</th>
                    <th className="text-left text-xs font-semibold text-slate-500 pb-2 pr-3">Banco</th>
                    <th className="text-right text-xs font-semibold text-slate-500 pb-2">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transaccionesCredito.map(tx => {
                    const color    = getBancoColor(tx.banco, 0)
                    const initials = getBancoInitials(tx.banco)
                    const label    = tx.detalle || tx.concepto || '—'

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 pr-3">
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
                        <td className="py-3 text-right tabular-nums font-medium text-slate-800">
                          {fmtCOP(tx.credito ?? 0)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {stats && transaccionesCredito.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200">
                      <td colSpan={2} className="pt-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Total del día
                      </td>
                      <td className="pt-2.5 text-right tabular-nums font-bold text-primary-700">
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

      {/* ── Tendencia de consolidaciones ─────────────────────────────────── */}
      {tendencia.length > 1 && (
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Tendencia de consolidaciones</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Últimas {tendencia.length} consolidaciones · movimientos y bancos activos por día
              </p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={240}>
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
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value: number, name: string) => [
                  value,
                  name === 'movimientos' ? 'Movimientos' : 'Bancos activos',
                ]}
              />
              <Bar dataKey="movimientos" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="bancos"      fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
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
      )}
    </div>
  )
}
