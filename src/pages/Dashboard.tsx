import { useQuery } from '@tanstack/react-query'
import { TrendingUp, AlertTriangle, DollarSign, Users, CheckCircle, XCircle, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { getDashboardResumen } from '../api/dashboard'
import { Header } from '../components/layout/Header'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/dashboard/StatCard'
import { AlertCard } from '../components/dashboard/AlertCard'
import { Spinner } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { BancosResumen, CarteraResumen } from '../types'

// Type guards para narrowing seguro
const hasBancos = (b: unknown): b is BancosResumen =>
  typeof b === 'object' && b !== null && 'fecha_corte' in b
const hasCartera = (c: unknown): c is CarteraResumen =>
  typeof c === 'object' && c !== null && 'fecha_corte' in c

const COLORS = ['#56b781', '#f59e0b', '#ef4444']

const fmt = (n: number) => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export const Dashboard = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-resumen'],
    queryFn: getDashboardResumen,
    refetchInterval: 1000 * 60 * 5,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8 text-primary-600" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center text-red-600 text-sm">
        Error cargando el dashboard. Intenta de nuevo.
      </div>
    )
  }

  const { bancos: bancosRaw, cartera: carteraRaw, pipelines, alertas } = data

  // Narrowing seguro con type guards
  const bancos = hasBancos(bancosRaw) ? bancosRaw : null
  const cartera = hasCartera(carteraRaw) ? carteraRaw : null

  const carteraChartData = cartera
    ? [
        { name: 'Al día', value: cartera.frescas, fmt: fmt(cartera.frescas) },
        { name: 'Atención', value: cartera.atencion, fmt: fmt(cartera.atencion) },
        { name: 'Riesgo', value: cartera.riesgo, fmt: fmt(cartera.riesgo) },
      ]
    : []

  const bancosChartData = bancos
    ? [
        { name: 'Identificados', value: bancos.total_identificados },
        { name: 'Sin ID', value: bancos.total_no_identificados },
      ]
    : []

  return (
    <div className="h-full overflow-y-auto bg-gray-100/60">
      <Header
        title="Panel Ejecutivo"
        subtitle={bancos ? `Corte: ${format(new Date(bancos.fecha_corte), 'PPP', { locale: es })}` : 'Sin corte reciente'}
      />

      <div className="p-7 space-y-7">
        {/* Alertas */}
        {alertas?.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {alertas.map((a, i) => (
              <AlertCard key={i} alert={a} />
            ))}
          </div>
        )}

        {/* Stats bancos */}
        {bancos && (
          <>
            <div>
              <h2 className="text-base font-semibold text-gray-600 uppercase tracking-wider mb-4">Bancos - Ultimo corte</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Ingresos totales" value={bancos.ingresos_fmt} icon={DollarSign} color="green" />
                <StatCard title="Identificados" value={bancos.identificados_fmt} icon={CheckCircle} color="blue" />
                <StatCard title="Sin identificar" value={bancos.no_identificados_fmt} icon={AlertTriangle} color="yellow" />
                <StatCard
                  title="Diferencias"
                  value={String(bancos.bancos_con_diferencia)}
                  subtitle="bancos con cuadre"
                  icon={bancos.bancos_con_diferencia > 0 ? XCircle : CheckCircle}
                  color={bancos.bancos_con_diferencia > 0 ? 'red' : 'green'}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <h3 className="text-base font-semibold text-gray-800 mb-4">Distribucion de ingresos</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={bancosChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {bancosChartData.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? '#56b781' : '#f59e0b'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 justify-center text-xs text-gray-600 mt-2">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-primary-500 inline-block" />Identificados</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />Sin identificar</span>
                </div>
              </Card>

              {/* Pipelines */}
              <Card className="shadow-sm">
                <h3 className="text-base font-semibold text-gray-800 mb-4">Estado de pipelines</h3>
                <div className="space-y-3">
                  {pipelines.map((p) => (
                    <div key={p.nombre} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                      <Badge nivel={p.nivel}>{p.estado}</Badge>
                      <span className="flex-1 text-base font-medium text-gray-700">{p.nombre}</span>
                      <span className="text-sm text-gray-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {p.ultima_ejecucion ? format(new Date(p.ultima_ejecucion), 'HH:mm') : 'N/A'}
                      </span>
                    </div>
                  ))}
                  {pipelines.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Sin datos de pipelines</p>
                  )}
                </div>
              </Card>
            </div>
          </>
        )}

        {/* Cartera */}
        {cartera && (
          <div>
            <h2 className="text-base font-semibold text-gray-600 uppercase tracking-wider mb-4">
              Cartera — {format(new Date(cartera.fecha_corte), 'PPP', { locale: es })}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              <StatCard title="Al dia (0-30 dias)" value={cartera.frescas_fmt} icon={CheckCircle} color="green" />
              <StatCard title="Atencion (31-60 dias)" value={cartera.atencion_fmt} icon={TrendingUp} color="yellow" />
              <StatCard title="Riesgo (+61 dias)" value={cartera.riesgo_fmt} icon={AlertTriangle} color="red" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <h3 className="text-base font-semibold text-gray-800 mb-4">Distribucion de cartera</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={carteraChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {carteraChartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="shadow-sm">
                <h3 className="text-base font-semibold text-gray-800 mb-4">Top clientes criticos</h3>
                <div className="space-y-2">
                  {cartera.top_criticos.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 py-2">
                      <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-gray-700 truncate">{c.nombre}</span>
                      <span className="text-sm font-semibold text-red-600">{fmt(c.deuda)}</span>
                    </div>
                  ))}
                  {cartera.top_criticos.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Sin clientes criticos</p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {!bancos && !cartera && (
          <Card>
            <div className="text-center py-12 text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay datos disponibles aun. Ejecuta los pipelines ETL para ver informacion.</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
