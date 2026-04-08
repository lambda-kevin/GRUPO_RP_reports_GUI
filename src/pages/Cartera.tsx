import { useQuery } from '@tanstack/react-query'
import { Wallet } from 'lucide-react'
import { getCartera } from '../api/dashboard'
import { Header } from '../components/layout/Header'
import { Card } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { Badge } from '../components/ui/Badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { fmtCOP } from '../utils/fmt'

const fmt = fmtCOP

const nivelDeuda = (deuda: number): 'ok' | 'warn' | 'error' => {
  if (deuda > 20_000_000) return 'error'
  if (deuda > 5_000_000) return 'warn'
  return 'ok'
}

export const Cartera = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['cartera'],
    queryFn: () => getCartera(),
  })

  return (
    <div>
      <Header title="Cartera" subtitle="Aging de cartera por cliente" />
      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !data?.length ? (
          <Card><EmptyState icon={Wallet} title="Sin datos de cartera" description="Ejecuta el ETL de cartera para ver el aging" /></Card>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Fecha de corte: <span className="font-medium text-gray-700">
                {format(new Date(data[0].fecha_corte), 'PPP', { locale: es })}
              </span>
              <span className="ml-3">· {data.length} clientes</span>
            </p>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Vigente</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">1-30</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">31-60</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">61-90</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">91-180</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">+180</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Total deuda</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">Nivel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{c.cliente_nombre}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmt(c.vigente)}</td>
                        <td className="px-4 py-3 text-right text-green-700">{fmt(c.dias_1_30)}</td>
                        <td className="px-4 py-3 text-right text-yellow-600">{fmt(c.dias_31_60)}</td>
                        <td className="px-4 py-3 text-right text-orange-600">{fmt(c.dias_61_90)}</td>
                        <td className="px-4 py-3 text-right text-red-500">{fmt(c.dias_91_180)}</td>
                        <td className="px-4 py-3 text-right text-red-700 font-medium">{fmt(c.mas_180_dias)}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(c.total_deuda)}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge nivel={nivelDeuda(c.total_deuda)}>
                            {nivelDeuda(c.total_deuda) === 'error' ? 'Critico' : nivelDeuda(c.total_deuda) === 'warn' ? 'Atencion' : 'OK'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
