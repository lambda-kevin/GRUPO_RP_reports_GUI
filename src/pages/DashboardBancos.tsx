import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getDashboardBancos } from '../api/dashboard'
import { Spinner } from '../components/ui/Spinner'
import { Card } from '../components/ui/Card'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)

const fmtShort = (n: number) => {
  if (n >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1)}M`
  } else if (n >= 1_000) {
    return `$${(n / 1_000).toFixed(0)}K`
  }
  return fmt(n)
}

export const DashboardBancos = () => {
  const [año, setAño] = useState<number>(new Date().getFullYear())
  const [mes, setMes] = useState<number | undefined>(undefined)
  const [ciudad, setCiudad] = useState<string | undefined>(undefined)
  const [vendedor, setVendedor] = useState<string | undefined>(undefined)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-bancos', { año, mes, ciudad, vendedor }],
    queryFn: () => getDashboardBancos({ año, mes, ciudad, vendedor }),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8 text-primary-600" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-gray-500">
        No hay datos disponibles
      </div>
    )
  }

  const kpis = data.kpis

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Ventas Netas vs Recaudo</h1>
            <p className="text-sm text-gray-600 mt-0.5">Año {data.año}</p>
          </div>
          <img 
            src="/assets/grupo-rp-noback.png" 
            alt="Grupo RP" 
            className="h-12 w-12 object-contain"
          />
        </div>

        {/* Filtros */}
        <div className="flex gap-3 mt-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Ciudad</label>
            <select
              value={ciudad ?? ''}
              onChange={(e) => setCiudad(e.target.value || undefined)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Todas</option>
              {data.opciones_filtros.ciudades.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Mes</label>
            <select
              value={mes ?? ''}
              onChange={(e) => setMes(e.target.value ? Number(e.target.value) : undefined)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Todos</option>
              {data.opciones_filtros.meses.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Año</label>
            <select
              value={año}
              onChange={(e) => setAño(Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              {data.opciones_filtros.años.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Vendedor</label>
            <select
              value={vendedor ?? ''}
              onChange={(e) => setVendedor(e.target.value || undefined)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Todos</option>
              {data.opciones_filtros.vendedores.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-l-4 border-primary-500">
            <div className="p-4">
              <div className="text-xs font-medium text-gray-600 mb-1">Ventas Netas</div>
              <div className="text-2xl font-semibold text-gray-900">{kpis.ventas_netas_fmt}</div>
              <div className="text-xs text-gray-500 mt-1">Total facturado</div>
            </div>
          </Card>

          <Card className="border-l-4 border-blue-600">
            <div className="p-4">
              <div className="text-xs font-medium text-gray-600 mb-1">Recaudo</div>
              <div className="text-2xl font-semibold text-gray-900">{kpis.recaudo_fmt}</div>
              <div className="text-xs text-gray-500 mt-1">Total recaudado</div>
            </div>
          </Card>

          <Card className="border-l-4 border-purple-600">
            <div className="p-4">
              <div className="text-xs font-medium text-gray-600 mb-1">Porcentaje de Recaudo</div>
              <div className="text-2xl font-semibold text-gray-900">
                {kpis.porcentaje_recaudo.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Efectividad de cobro</div>
            </div>
          </Card>
        </div>

        {/* Gráfico Principal - Ventas vs Recaudo Mensual */}
        <Card>
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-200">
              Ventas Netas vs Recaudo por Mes
            </h2>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data.ventas_por_mes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="mes" 
                  stroke="#6b7280" 
                  style={{ fontSize: '12px' }} 
                />
                <YAxis
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => fmtShort(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => fmt(value)}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="ventas_netas" name="Ventas Netas" fill="#56b781" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recaudo" name="Recaudo" fill="#1e40af" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Gráficos de Ciudad */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ventas por Ciudad */}
          <Card>
            <div className="p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-200">
                Ventas por Ciudad
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.ventas_por_ciudad} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    stroke="#6b7280"
                    style={{ fontSize: '11px' }}
                    tickFormatter={(value) => fmtShort(value)}
                  />
                  <YAxis 
                    dataKey="ciudad" 
                    type="category" 
                    stroke="#6b7280" 
                    style={{ fontSize: '11px' }} 
                    width={120} 
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => fmt(value)}
                  />
                  <Bar dataKey="ventas" name="Ventas" fill="#56b781" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Recaudo por Ciudad */}
          <Card>
            <div className="p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-200">
                Recaudo por Ciudad
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.ventas_por_ciudad} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    stroke="#6b7280"
                    style={{ fontSize: '11px' }}
                    tickFormatter={(value) => fmtShort(value)}
                  />
                  <YAxis 
                    dataKey="ciudad" 
                    type="category" 
                    stroke="#6b7280" 
                    style={{ fontSize: '11px' }} 
                    width={120} 
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => fmt(value)}
                  />
                  <Bar dataKey="recaudo" name="Recaudo" fill="#1e40af" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
