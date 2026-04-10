import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend,
} from 'recharts'
import { Calendar, Landmark, Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { getDashboardTesoreria } from '../api/dashboard'
import { Spinner, PageLoader } from '../components/ui/Spinner'
import { Card } from '../components/ui/Card'
import { fmtCOPShort } from '../utils/fmt'

const fmtM = fmtCOPShort

export const Tesoreria = () => {
  const [año, setAño] = useState<number>(new Date().getFullYear())
  const [mes, setMes] = useState<number | undefined>(undefined)
  const [tipoProveedor, setTipoProveedor] = useState<'todos' | 'bancario' | 'proveedores'>('todos')

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['dashboard-tesoreria', { año, mes, tipoProveedor }],
    queryFn: () => getDashboardTesoreria({ año, mes, tipo_proveedor: tipoProveedor }),
  })

  if (isLoading) return <PageLoader label="Cargando tesorería..." />
  if (isError || !data) return <div className="p-6 text-red-700">No fue posible cargar tesorería.</div>

  const k = data.kpis

  return (
    <div className="h-full overflow-y-auto bg-gray-100/60">
      <header className="bg-white/95 backdrop-blur border-b border-gray-200 px-6 py-5 sticky top-0 z-20">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Tesorería</h1>
            <p className="text-base text-gray-600 mt-1">
              {tipoProveedor === 'bancario'
                ? 'Vista bancaria: cuotas y compromisos financieros'
                : tipoProveedor === 'proveedores'
                  ? 'Vista proveedores: pagos operativos y presión de caja'
                  : 'Cuentas por pagar, ingresos bancarios y flujo'}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap items-end bg-gray-50 border border-gray-200 rounded-xl p-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Tipo</label>
              <select
                value={tipoProveedor}
                onChange={(e) => setTipoProveedor(e.target.value as 'todos' | 'bancario' | 'proveedores')}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="todos">Todos</option>
                <option value="bancario">Bancario</option>
                <option value="proveedores">Proveedores</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Año</label>
              <select
                value={año}
                onChange={(e) => setAño(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                {Array.from({ length: 6 }).map((_, i) => {
                  const y = new Date().getFullYear() - i
                  return <option key={y} value={y}>{y}</option>
                })}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Mes</label>
              <select
                value={mes ?? ''}
                onChange={(e) => setMes(e.target.value ? Number(e.target.value) : undefined)}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="">Todos</option>
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-600 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {isFetching ? <><Spinner className="h-4 w-4" /> Actualizando…</> : 'Datos en línea'}
            </div>
          </div>
        </div>
      </header>

      <div className="p-7 space-y-7">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <Card className="border-l-4 border-amber-500"><div className="p-4"><div className="text-sm text-gray-500">{tipoProveedor === 'bancario' ? 'Deuda bancaria total' : tipoProveedor === 'proveedores' ? 'CxP proveedores total' : 'CxP total'}</div><div className="text-3xl font-extrabold text-gray-900">{k.cxp_total_fmt}</div></div></Card>
          <Card className="border-l-4 border-red-500"><div className="p-4"><div className="text-sm text-gray-500">Próximos 7 días</div><div className="text-3xl font-extrabold text-red-700">{k.pagos_7_dias_fmt}</div></div></Card>
          <Card className="border-l-4 border-orange-500"><div className="p-4"><div className="text-sm text-gray-500">Próximos 30 días</div><div className="text-3xl font-extrabold text-orange-700">{k.pagos_30_dias_fmt}</div></div></Card>
          <Card className="border-l-4 border-emerald-600"><div className="p-4"><div className="text-sm text-gray-500 flex items-center gap-2"><Landmark className="h-4 w-4" /> Ingreso bancario</div><div className="text-3xl font-extrabold text-emerald-700">{k.ingresos_periodo_fmt}</div></div></Card>
          <Card className="border-l-4 border-slate-500"><div className="p-4"><div className="text-sm text-gray-500 flex items-center gap-2"><Wallet className="h-4 w-4" /> Egresos</div><div className="text-3xl font-extrabold text-slate-700">{k.egresos_periodo_fmt}</div></div></Card>
          <Card className={`border-l-4 ${k.flujo_neto_periodo >= 0 ? 'border-green-600' : 'border-red-600'}`}>
            <div className="p-4">
              <div className="text-sm text-gray-500 flex items-center gap-2">{k.flujo_neto_periodo >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} Flujo neto</div>
              <div className={`text-3xl font-extrabold ${k.flujo_neto_periodo >= 0 ? 'text-green-700' : 'text-red-700'}`}>{k.flujo_neto_periodo_fmt}</div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <div className="p-4">
              <h2 className="text-lg font-extrabold text-gray-800 mb-3">Cuentas por pagar por edad</h2>
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
              <h2 className="text-lg font-extrabold text-gray-800 mb-3">Flujo (ingresos vs egresos)</h2>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.flujo}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={(v) => fmtM(Number(v))} />
                  <Tooltip formatter={(value: number) => fmtM(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="ingresos" stroke="#16a34a" name="Ingresos" strokeWidth={2.5} />
                  <Line type="monotone" dataKey="egresos" stroke="#ef4444" name="Egresos" strokeWidth={2.5} />
                  <Line type="monotone" dataKey="flujo_neto" stroke="#1d4ed8" name="Flujo neto" strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card>
          <div className="p-4">
              <h2 className="text-lg font-extrabold text-gray-800 mb-3">Próximos pagos (60 días)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Proveedor</th>
                      <th className="px-3 py-2 text-left">Tipo</th>
                      <th className="px-3 py-2 text-left">Documento</th>
                      <th className="px-3 py-2 text-left">Vence</th>
                      <th className="px-3 py-2 text-right">Días</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.proximos_pagos.map((p, i) => (
                    <tr key={`${p.proveedor}-${p.documento}-${i}`} className="border-t border-gray-100">
                      <td className="px-3 py-2">{p.proveedor}</td>
                      <td className="px-3 py-2">
                        {p.tipo_proveedor === 'bancario' ? 'Bancario' : p.tipo_proveedor === 'proveedores' ? 'Proveedor' : '—'}
                      </td>
                      <td className="px-3 py-2">{p.documento || '—'}</td>
                      <td className="px-3 py-2">{p.fecha_vencimiento}</td>
                      <td className="px-3 py-2 text-right">{p.dias_para_vencer}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmtM(p.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
