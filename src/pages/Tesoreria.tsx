import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend,
} from 'recharts'
import { Calendar, Wallet, TrendingUp, TrendingDown, Receipt } from 'lucide-react'
import { getDashboardTesoreria } from '../api/dashboard'
import { Spinner, PageLoader } from '../components/ui/Spinner'
import { Card } from '../components/ui/Card'
import { fmtCOPShort } from '../utils/fmt'

const fmtM = fmtCOPShort

export const Tesoreria = () => {
  const [año, setAño] = useState<number>(new Date().getFullYear())
  const [mes, setMes] = useState<number | undefined>(undefined)
  const [tipoProveedor, setTipoProveedor] = useState<'todos' | 'bancario' | 'proveedores'>('todos')
  const [pagePagos, setPagePagos] = useState(1)
  const PAGE_PAGOS = 10

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['dashboard-tesoreria', { año, mes, tipoProveedor }],
    queryFn: () => getDashboardTesoreria({ año, mes, tipo_proveedor: tipoProveedor }),
  })

  useEffect(() => { setPagePagos(1) }, [año, mes, tipoProveedor])

  const totalPagos = data?.proximos_pagos.length ?? 0
  const totalPagesPagos = Math.max(1, Math.ceil(totalPagos / PAGE_PAGOS))
  const pagosPaginados = useMemo(() => {
    if (!data) return []
    const start = (pagePagos - 1) * PAGE_PAGOS
    return data.proximos_pagos.slice(start, start + PAGE_PAGOS)
  }, [data, pagePagos, PAGE_PAGOS])

  if (isLoading) return <PageLoader label="Cargando tesorería..." />
  if (isError || !data) return <div className="p-6 text-red-700">No fue posible cargar tesorería.</div>

  const k = data.kpis

  return (
    <div className="h-full overflow-y-auto bg-gray-100/60">
      <header className="bg-white/95 backdrop-blur border-b border-gray-200 px-6 py-5 sticky top-0 z-20">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">TESORERÍA</h1>
            <p className="text-base text-gray-600 mt-1">
              {tipoProveedor === 'bancario'
                ? 'Vista bancaria: cuotas y compromisos financieros'
                : tipoProveedor === 'proveedores'
                  ? 'Vista proveedores: pagos operativos y presión de caja '
                  : 'Cuentas por pagar y recaudo de facturas '}
            </p>
          </div>
          <div className="flex gap-4 flex-wrap items-end bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-base font-semibold text-gray-700">Tipo</label>
              <select
                value={tipoProveedor}
                onChange={(e) => setTipoProveedor(e.target.value as 'todos' | 'bancario' | 'proveedores')}
                className="px-4 py-2.5 text-base border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="todos">Todos</option>
                <option value="bancario">Bancario</option>
                <option value="proveedores">Proveedores</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-base font-semibold text-gray-700">Año</label>
              <select
                value={año}
                onChange={(e) => setAño(Number(e.target.value))}
                className="px-4 py-2.5 text-base border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {Array.from({ length: 6 }).map((_, i) => {
                  const y = new Date().getFullYear() - i
                  return <option key={y} value={y}>{y}</option>
                })}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-base font-semibold text-gray-700">Mes</label>
              <select
                value={mes ?? ''}
                onChange={(e) => setMes(e.target.value ? Number(e.target.value) : undefined)}
                className="px-4 py-2.5 text-base border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Todos</option>
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </div>
            <div className="text-base text-gray-600 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {isFetching ? <><Spinner className="h-5 w-5" /> Actualizando…</> : 'Datos en línea'}
            </div>
          </div>
        </div>
      </header>

      <div className="p-7 space-y-7">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <Card className="border-l-4 border-amber-500"><div className="p-5"><div className="text-base font-semibold text-gray-500 mb-1">{tipoProveedor === 'bancario' ? 'Deuda bancaria total' : tipoProveedor === 'proveedores' ? 'CxP proveedores total' : 'CxP TOTAL'}</div><div className="text-4xl font-extrabold text-gray-900">{k.cxp_total_fmt}</div></div></Card>
          <Card className="border-l-4 border-red-500"><div className="p-5"><div className="text-base font-semibold text-gray-500 mb-1">PRÓXIMOS 7 DÍAS</div><div className="text-4xl font-extrabold text-red-700">{k.pagos_7_dias_fmt}</div></div></Card>
          <Card className="border-l-4 border-orange-500"><div className="p-5"><div className="text-base font-semibold text-gray-500 mb-1">PRÓXIMOS 30 DÍAS</div><div className="text-4xl font-extrabold text-orange-700">{k.pagos_30_dias_fmt}</div></div></Card>
          <Card className="border-l-4 border-emerald-600"><div className="p-5"><div className="text-base font-semibold text-gray-500 mb-1 flex items-center gap-2"><Receipt className="h-5 w-5" /> RECAUDO DEL PERIODO</div><div className="text-4xl font-extrabold text-emerald-700">{k.ingresos_periodo_fmt}</div><div className="text-sm text-gray-400 mt-1">Pagos recibidos en facturas</div></div></Card>
          <Card className="border-l-4 border-slate-500"><div className="p-5"><div className="text-base font-semibold text-gray-500 mb-1 flex items-center gap-2"><Wallet className="h-5 w-5" /> POR PAGAR (CxP)</div><div className="text-4xl font-extrabold text-slate-700">{k.egresos_periodo_fmt}</div></div></Card>
          <Card className={`border-l-4 ${k.flujo_neto_periodo >= 0 ? 'border-green-600' : 'border-red-600'}`}>
            <div className="p-5">
              <div className="text-base font-semibold text-gray-500 mb-1 flex items-center gap-2">{k.flujo_neto_periodo >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />} FLUJO NETO</div>
              <div className={`text-4xl font-extrabold ${k.flujo_neto_periodo >= 0 ? 'text-green-700' : 'text-red-700'}`}>{k.flujo_neto_periodo_fmt}</div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <div className="p-4">
              <h2 className="text-xl font-extrabold text-gray-800 mb-4 pb-3 border-b-2 border-gray-200">CUENTAS POR PAGA POR EDAD</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.cxp_por_edad}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tramo" />
                  <YAxis tickFormatter={(v) => fmtM(Number(v))} />
                  <Tooltip formatter={(value: number) => fmtM(value)} />
                  <Bar dataKey="saldo" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <h2 className="text-xl font-extrabold text-gray-800 mb-1 pb-3 border-b-2 border-gray-200">FLUJO (RECAUDO VS EGRESOS CxP)</h2>
              <p className="text-sm text-gray-500 mb-3">Recaudo = pagos recibidos en facturas  · Egresos = cuentas por pagar </p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.flujo}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={(v) => fmtM(Number(v))} />
                  <Tooltip formatter={(value: number) => fmtM(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="ingresos" stroke="#16a34a" name="Recaudo (facturas)" strokeWidth={2.5} />
                  <Line type="monotone" dataKey="egresos" stroke="#ef4444" name="Egresos (CxP)" strokeWidth={2.5} />
                  <Line type="monotone" dataKey="flujo_neto" stroke="#1d4ed8" name="Flujo neto" strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-gray-200">
              <h2 className="text-xl font-extrabold text-gray-800">PRÓXIMOS PAGOS (60 DÍAS)</h2>
              <span className="text-base text-gray-500">{totalPagos} registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead className="bg-slate-100 text-slate-700 text-sm font-bold uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Proveedor</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-left">Documento</th>
                    <th className="px-4 py-3 text-left">Vence</th>
                    <th className="px-4 py-3 text-right">Días</th>
                    <th className="px-4 py-3 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {pagosPaginados.map((p, i) => {
                    const urgente = p.dias_para_vencer <= 7
                    const proximo = p.dias_para_vencer <= 30
                    return (
                      <tr key={`${p.proveedor}-${p.documento}-${i}`} className={`border-t border-gray-100 hover:bg-gray-50 ${urgente ? 'bg-red-50' : proximo ? 'bg-orange-50/50' : ''}`}>
                        <td className="px-4 py-3 font-semibold text-gray-900">{p.proveedor}</td>
                        <td className="px-4 py-3">
                          {p.tipo_proveedor === 'bancario'
                            ? <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full text-sm font-bold">Bancario</span>
                            : p.tipo_proveedor === 'proveedores'
                              ? <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-sm font-bold">Proveedor</span>
                              : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-gray-500">{p.documento || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{p.fecha_vencimiento}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold px-2.5 py-1 rounded-full text-sm ${urgente ? 'bg-red-100 text-red-800' : proximo ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'}`}>
                            {p.dias_para_vencer}d
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-gray-900">{fmtM(p.saldo)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {totalPagesPagos > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <span className="text-base text-gray-500">
                  Página {pagePagos} de {totalPagesPagos}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagePagos(p => Math.max(1, p - 1))}
                    disabled={pagePagos === 1}
                    className="px-5 py-2.5 text-base font-semibold rounded-xl border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => setPagePagos(p => Math.min(totalPagesPagos, p + 1))}
                    disabled={pagePagos === totalPagesPagos}
                    className="px-5 py-2.5 text-base font-semibold rounded-xl border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
