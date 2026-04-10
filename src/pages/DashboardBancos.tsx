import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { AxiosError } from 'axios'
import { getDashboardBancos } from '../api/dashboard'
import { PageLoader, Spinner } from '../components/ui/Spinner'
import { Card } from '../components/ui/Card'
import { fmtCOP, fmtCOPShort, fmtPct } from '../utils/fmt'

const PAGE_SIZE = 6
const totalPages = (items: number) => Math.max(1, Math.ceil(items / PAGE_SIZE))
const paginate = <T,>(items: T[], page: number) =>
  items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

const fmt      = fmtCOP
const fmtShort = fmtCOPShort

const pct = (numerador: number, denominador: number) =>
  denominador > 0 ? (numerador / denominador) * 100 : 0

const prioridad = (efectividad: number) => {
  if (efectividad < 55) return { label: 'Alta', className: 'bg-red-100 text-red-700' }
  if (efectividad < 75) return { label: 'Media', className: 'bg-amber-100 text-amber-700' }
  return { label: 'Controlada', className: 'bg-emerald-100 text-emerald-700' }
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

export const DashboardBancos = () => {
  const logoSources = ['/dist/assets/grupo-rp-noback.png', '/assets/grupo-rp-noback.png']
  const [logoIndex, setLogoIndex] = useState(0)
  const [año, setAño] = useState<number>(new Date().getFullYear())
  const [mes, setMes] = useState<number | undefined>(undefined)
  const [ciudad, setCiudad] = useState<string | undefined>(undefined)
  const [vendedor, setVendedor] = useState<string | undefined>(undefined)
  const [pageCiudades, setPageCiudades] = useState(1)
  const [pageMensual, setPageMensual] = useState(1)

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['dashboard-bancos', { año, mes, ciudad, vendedor }],
    queryFn: () => getDashboardBancos({ año, mes, ciudad, vendedor }),
  })

  useEffect(() => {
    if (!data) return
    if (data.ventas_por_mes.length > 0) return
    const primerAnioConDatos = data.opciones_filtros.años?.[0]
    if (primerAnioConDatos && primerAnioConDatos !== año) {
      setAño(primerAnioConDatos)
    }
  }, [data, año])

  if (isLoading) return <PageLoader label="Cargando datos de bancos..." />

  if (isError) {
    const errorData = (error as AxiosError<{ message?: string; error?: string }>)?.response?.data
    const message = errorData?.message || errorData?.error || 'No se pudo consultar datos reales en Saint.'
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">
          <p className="font-bold">Error cargando Bancos</p>
          <p className="text-sm mt-1">{message}</p>
        </div>
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
  const brechaGlobal = Math.max(0, kpis.ventas_netas - kpis.recaudo)
  const indiceCobranza = kpis.ventas_netas > 0 ? pct(kpis.recaudo, kpis.ventas_netas) : 0
  const ciudadesOrdenadas = [...data.ventas_por_ciudad].sort((a, b) => b.ventas - a.ventas)
  const regionesOrdenadas = [...(data.ventas_por_region ?? [])].sort((a, b) => b.ventas - a.ventas)
  const mesesOrdenados = [...data.ventas_por_mes].sort((a, b) => a.mes_num - b.mes_num)
  const ciudadesDetalle = ciudadesOrdenadas.map((c) => {
    const efectividad = pct(c.recaudo, c.ventas)
    return {
      ...c,
      efectividad,
      brecha: Math.max(0, c.ventas - c.recaudo),
      prioridad: prioridad(efectividad),
    }
  })
  const ciudadMayorRecaudo = [...ciudadesDetalle].sort((a, b) => b.recaudo - a.recaudo)[0]
  const tendenciaMensual = mesesOrdenados.map((m, i) => {
    const anterior = i > 0 ? mesesOrdenados[i - 1].recaudo : null
    const variacion = anterior && anterior > 0 ? ((m.recaudo - anterior) / anterior) * 100 : null
    return { ...m, efectividad: pct(m.recaudo, m.ventas_netas), variacion }
  })
  const ciudadesPages = totalPages(ciudadesDetalle.length)
  const ciudadesPageItems = paginate(ciudadesDetalle, Math.min(pageCiudades, ciudadesPages))
  const mensualPages = totalPages(tendenciaMensual.length)
  const mensualPageItems = paginate(tendenciaMensual, Math.min(pageMensual, mensualPages))

  return (
    <div className="h-full overflow-y-auto bg-gray-100/60">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur border-b border-gray-200 px-6 py-5 sticky top-0 z-20">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Facturación vs Cobranza</h1>
            <p className="text-base text-gray-600 mt-1">Año {data.año}</p>
          </div>
          <img
            src={logoSources[logoIndex]}
            alt="Grupo RP"
            className="h-12 w-12 object-contain"
            onError={() => {
              if (logoIndex < logoSources.length - 1) setLogoIndex(logoIndex + 1)
            }}
          />
        </div>

        {/* Filtros */}
        <div className="flex gap-4 mt-5 flex-wrap bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-base font-semibold text-gray-700">Ciudad</label>
            <select
              value={ciudad ?? ''}
              onChange={(e) => setCiudad(e.target.value || undefined)}
              className="px-4 py-2.5 text-base border border-gray-300 rounded-xl bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Todas</option>
              {data.opciones_filtros.ciudades.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-base font-semibold text-gray-700">Mes</label>
            <select
              value={mes ?? ''}
              onChange={(e) => setMes(e.target.value ? Number(e.target.value) : undefined)}
              className="px-4 py-2.5 text-base border border-gray-300 rounded-xl bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Todos</option>
              {data.opciones_filtros.meses.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-base font-semibold text-gray-700">Año</label>
            <select
              value={año}
              onChange={(e) => setAño(Number(e.target.value))}
              className="px-4 py-2.5 text-base border border-gray-300 rounded-xl bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              {data.opciones_filtros.años.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-base font-semibold text-gray-700">Línea de Producto</label>
            <select
              value={vendedor ?? ''}
              onChange={(e) => setVendedor(e.target.value || undefined)}
              className="px-4 py-2.5 text-base border border-gray-300 rounded-xl bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Todas</option>
              {data.opciones_filtros.vendedores.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>
        {isFetching && (
          <div className="mt-3 inline-flex items-center gap-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
            <Spinner className="h-4 w-4 text-gray-600" />
            <span>Actualizando filtros...</span>
          </div>
        )}
      </header>

      <div className="p-7 space-y-7">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Card className="border-l-4 border-green-600 shadow-sm">
            <div className="p-5">
              <div className="text-base font-semibold text-gray-500 mb-2 uppercase tracking-wide">Facturación neta</div>
              <div className="text-4xl font-extrabold text-gray-900">{fmtCOPShort(kpis.ventas_netas)}</div>
              <div className="text-sm text-gray-500 mt-2">Monto neto facturado en el período</div>
            </div>
          </Card>

          <Card className="border-l-4 border-blue-500 shadow-sm">
            <div className="p-5">
              <div className="text-base font-semibold text-gray-500 mb-2 uppercase tracking-wide">Cobranza</div>
              <div className="text-4xl font-extrabold text-gray-900">{fmtCOPShort(kpis.recaudo)}</div>
              <div className="text-sm text-gray-500 mt-2">Cobro efectivo registrado en el período</div>
            </div>
          </Card>

          <Card className="border-l-4 border-emerald-500 shadow-sm">
            <div className="p-5">
              <div className="text-base font-semibold text-gray-500 mb-2 uppercase tracking-wide">Índice de cobranza</div>
              <div className="text-4xl font-extrabold text-gray-900">
                {fmtPct(indiceCobranza, 1)}
              </div>
              <div className="text-sm text-gray-500 mt-2">Cobranza / facturación neta del período</div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="border-l-4 border-red-400 shadow-sm">
            <div className="p-5">
              <p className="text-base font-semibold text-gray-500 mb-2 uppercase tracking-wide">Saldo pendiente de recaudo</p>
              <p className="text-3xl font-extrabold text-red-600">{fmt(brechaGlobal)}</p>
              <p className="text-sm text-gray-500 mt-2">
                Diferencia del período entre facturación neta y cobranza.
              </p>
            </div>
          </Card>
          <Card className="border-l-4 border-green-500 shadow-sm">
            <div className="p-5">
              <p className="text-base font-semibold text-gray-500 mb-2 uppercase tracking-wide">Ciudad con mayor cobranza</p>
              <p className="text-3xl font-extrabold text-gray-900">
                {ciudadMayorRecaudo?.ciudad ?? 'Sin datos'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {ciudadMayorRecaudo ? `${fmtShort(ciudadMayorRecaudo.recaudo)} cobrados.` : 'N/A'}
              </p>
            </div>
          </Card>
        </div>

        {/* Vista macro por región (mismo concepto que Cartera por Región) */}
        <Card className="shadow-sm">
          <div className="p-6">
            <h2 className="text-xl font-extrabold text-gray-800 mb-5 pb-3 border-b-2 border-gray-200">
              VISTA MACRO · FACTURACIÓN Y COBRANZA POR REGIÓN
            </h2>
            {regionesOrdenadas.length === 0 ? (
              <p className="text-sm text-gray-500">Sin datos regionales para los filtros seleccionados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-lg">
                  <thead>
                    <tr className="border-b border-gray-200 text-base text-gray-600 uppercase tracking-wide">
                      <th className="text-left py-3 pr-3">Región</th>
                      <th className="text-right py-3 px-3">Ciudades</th>
                      <th className="text-right py-3 px-3">Ventas</th>
                      <th className="text-right py-3 px-3">Cobranza</th>
                      <th className="text-right py-3 px-3">% Ventas</th>
                      <th className="text-right py-3 pl-3">% Cobranza</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {regionesOrdenadas.map((r) => (
                      <tr key={r.departamento} className="hover:bg-gray-50 even:bg-gray-50/50">
                        <td className="py-3 pr-3 font-semibold text-gray-900">{r.departamento}</td>
                        <td className="py-3 px-3 text-right text-gray-900 font-semibold">{r.ciudades_count}</td>
                        <td className="py-3 px-3 text-right text-gray-900 font-semibold">{fmtShort(r.ventas)}</td>
                        <td className="py-3 px-3 text-right text-gray-900 font-semibold">{fmtShort(r.recaudo)}</td>
                        <td className="py-3 px-3 text-right text-gray-900 font-semibold">{fmtPct(r.porcentaje_ventas)}</td>
                        <td className="py-3 pl-3 text-right text-gray-900 font-semibold">{fmtPct(r.porcentaje_recaudo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        {/* Gráfico Principal - Facturación vs Cobranza Mensual */}
        <Card>
          <div className="p-4">
            <h2 className="text-lg font-extrabold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">
              FACTURACIÓN NETA VS COBRANZA POR MES
            </h2>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={mesesOrdenados}>
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
                <Bar dataKey="ventas_netas" name="Facturación neta" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="recaudo"
                  name="Cobranza"
                  stroke="#15803d"
                  strokeWidth={2.5}
                  dot={{ fill: '#15803d', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Gráficos de Ciudad */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ventas por Ciudad */}
          <Card className="shadow-sm">
            <div className="p-4">
              <h2 className="text-lg font-extrabold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">
                VENTAS POR CIUDAD
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ciudadesOrdenadas} layout="vertical">
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
                  <Bar dataKey="ventas" name="Ventas" fill="#16a34a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Cobranza por Ciudad */}
          <Card className="shadow-sm">
            <div className="p-4">
              <h2 className="text-lg font-extrabold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">
                COBRANZA POR CIUDAD
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ciudadesOrdenadas} layout="vertical">
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
                  <Bar dataKey="recaudo" name="Cobranza" fill="#15803d" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card className="shadow-sm">
            <div className="p-6">
              <h2 className="text-xl font-extrabold text-gray-800 mb-5 pb-3 border-b-2 border-gray-200">
                CIUDADES CON MAYOR IMPACTO
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-lg">
                  <thead>
                    <tr className="border-b border-gray-200 text-base text-gray-600 uppercase tracking-wide">
                      <th className="text-left py-3 pr-3">Ciudad</th>
                      <th className="text-right py-3 px-3">Ventas</th>
                      <th className="text-right py-3 px-3">Cobranza</th>
                      <th className="text-right py-3 px-3">% Cobranza</th>
                      <th className="text-right py-3 px-3">Brecha</th>
                      <th className="text-center py-3 pl-3">Prioridad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ciudadesPageItems.map((c) => (
                      <tr key={c.ciudad} className="hover:bg-gray-50 even:bg-gray-50/50">
                        <td className="py-3 pr-3 font-semibold text-gray-900">{c.ciudad}</td>
                        <td className="py-3 px-3 text-right text-gray-900 font-semibold">{fmtShort(c.ventas)}</td>
                        <td className="py-3 px-3 text-right text-gray-900 font-semibold">{fmtShort(c.recaudo)}</td>
                        <td className="py-3 px-3 text-right text-gray-900 font-semibold">{fmtPct(c.efectividad)}</td>
                        <td className="py-3 px-3 text-right text-gray-900 font-semibold">{fmtShort(c.brecha)}</td>
                        <td className="py-3 pl-3 text-center">
                          <span className={`px-3 py-1 rounded-full text-base font-semibold ${c.prioridad.className}`}>
                            {c.prioridad.label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={Math.min(pageCiudades, ciudadesPages)}
                pages={ciudadesPages}
                onChange={setPageCiudades}
              />
            </div>
          </Card>

          <Card className="shadow-sm">
            <div className="p-6">
              <h2 className="text-xl font-extrabold text-gray-800 mb-5 pb-3 border-b-2 border-gray-200">
                SEGUIMIENTO MENSUAL
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-lg">
                  <thead>
                    <tr className="border-b border-gray-200 text-base text-gray-600 uppercase tracking-wide">
                      <th className="text-left py-3 pr-3">Mes</th>
                      <th className="text-right py-3 px-3">Ventas</th>
                      <th className="text-right py-3 px-3">Cobranza</th>
                      <th className="text-right py-3 px-3">% Cobranza</th>
                      <th className="text-right py-3 pl-3">Variación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {mensualPageItems.map((m) => (
                      <tr key={`${m.mes}-${m.mes_num}`} className="hover:bg-gray-50 even:bg-gray-50/50">
                        <td className="py-3 pr-3 font-semibold text-gray-900">{m.mes}</td>
                        <td className="py-3 px-3 text-right text-gray-900 font-semibold">{fmtShort(m.ventas_netas)}</td>
                        <td className="py-3 px-3 text-right text-gray-900 font-semibold">{fmtShort(m.recaudo)}</td>
                        <td className="py-3 px-3 text-right text-gray-900 font-semibold">{fmtPct(m.efectividad)}</td>
                        <td
                          className={`py-3 pl-3 text-right text-lg font-bold ${
                            m.variacion === null
                              ? 'text-gray-500'
                              : m.variacion >= 0
                                ? 'text-emerald-600'
                                : 'text-red-600'
                          }`}
                        >
                          {m.variacion === null ? 'Base' : `${m.variacion >= 0 ? '+' : ''}${fmtPct(m.variacion)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={Math.min(pageMensual, mensualPages)}
                pages={mensualPages}
                onChange={setPageMensual}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
