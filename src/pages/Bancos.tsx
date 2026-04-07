import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Building2, CheckCircle, XCircle, BarChart3 } from 'lucide-react'
import { getBancos } from '../api/dashboard'
import { Header } from '../components/layout/Header'
import { Card } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { Badge } from '../components/ui/Badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export const Bancos = () => {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['bancos'],
    queryFn: () => getBancos(),
  })

  return (
    <div>
      <Header title="Bancos" subtitle="Conciliacion bancaria diaria">
        <button
          onClick={() => navigate('/bancos/dashboard')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white font-medium rounded-lg transition-colors shadow-md hover:shadow-lg"
        >
          <BarChart3 className="h-5 w-5" />
          Ver Dashboard de Ventas vs Recaudo
        </button>
      </Header>
      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : !data?.length ? (
          <Card>
            <EmptyState icon={Building2} title="Sin datos bancarios" description="Ejecuta el ETL de bancos para ver la conciliacion" />
          </Card>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Fecha de corte: <span className="font-medium text-gray-700">
                {format(new Date(data[0].fecha_corte), 'PPP', { locale: es })}
              </span>
              <span className="ml-3">· {data.length} bancos</span>
            </p>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Banco</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Ingresos</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Identificados</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Sin identificar</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Transacciones</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">Cuadre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          {b.banco}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt(b.total_ingresos)}</td>
                        <td className="px-4 py-3 text-right text-green-700 font-medium">{fmt(b.identificados)}</td>
                        <td className="px-4 py-3 text-right text-yellow-700">{fmt(b.no_identificados)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{b.cant_transacciones}</td>
                        <td className="px-4 py-3 text-center">
                          {b.flag_cuadre ? (
                            <Badge nivel="error"><XCircle className="h-3 w-3" />Diferencia</Badge>
                          ) : (
                            <Badge nivel="ok"><CheckCircle className="h-3 w-3" />OK</Badge>
                          )}
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
