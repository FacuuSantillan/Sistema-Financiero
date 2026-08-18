import React from 'react'
import { DollarSign, TrendingUp, Wallet, CreditCard, Eye, Power, Edit2, MapPin } from 'lucide-react'

export default function FichaInversionista({
  inversionista,
  prestamos = [],
  clientesRelacionados = [],
  esInversionista = false,
  actionLoading = false,
  onEditar,
  onToggleEstado,
  onVerFichaPrestamo
}) {
  if (!inversionista) return null

  const estaActivo = inversionista.activo ?? true
  const totalCapitalInvertido = Number(inversionista.capital_disponible || 0)
  const totalRetornoEsperado = prestamos.reduce((acc, p) => acc + Number(p.monto_total_pagar || p.monto_total || 0), 0)
  const totalCapitalColocado = prestamos.reduce((acc, p) => acc + Number(p.monto_capital || p.monto || 0), 0)
  const totalInteresesGanados = Math.max(0, totalRetornoEsperado - totalCapitalColocado)

  return (
    <div className="flex flex-col h-full overflow-y-auto pr-1 space-y-5">
      {/* Header Ficha Inversionista */}
      <div className="p-5 rounded-2xl bg-white border border-line shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0d6b63]">
              INFORMACIÓN GENERAL (INVERSIONISTA)
            </span>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              estaActivo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
            }`}>
              {estaActivo ? 'Activo' : 'Inactivo'}
            </span>
          </div>

          <h3 className="text-2xl font-serif font-bold text-slate-900 mt-0.5">
            {inversionista.nombre_completo || inversionista.nombre}
          </h3>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2.5 font-medium">
            {inversionista.dni && <span className="bg-slate-100 px-2.5 py-1 rounded-lg">🪪 DNI: {inversionista.dni}</span>}
            {inversionista.telefono && <span className="bg-slate-100 px-2.5 py-1 rounded-lg">📞 Tel: {inversionista.telefono}</span>}
            {inversionista.email && <span className="bg-slate-100 px-2.5 py-1 rounded-lg">✉️ Email: {inversionista.email}</span>}
            {inversionista.direccion && (
              <span className="bg-slate-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-500" /> {inversionista.direccion}
              </span>
            )}
          </div>
        </div>

        {!esInversionista && (
          <div className="flex items-center gap-2">
            <button
              onClick={onEditar}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-xs cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-[#0d6b63]" />
              <span>Editar</span>
            </button>

            <button
              onClick={onToggleEstado}
              disabled={actionLoading}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                estaActivo
                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{estaActivo ? 'Deshabilitar' : 'Habilitar'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Métricas Financieras */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-line flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">CAPITAL INVERTIDO</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700"><DollarSign className="w-4 h-4" /></div>
          </div>
          <p className="text-xl font-bold text-slate-900">${totalCapitalInvertido.toLocaleString('es-AR')}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-line flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">GANANCIA ESPERADA</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700"><TrendingUp className="w-4 h-4" /></div>
          </div>
          <p className="text-xl font-bold text-emerald-700">+${totalInteresesGanados.toLocaleString('es-AR')}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-line flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">CAPITAL CON INTERESES</span>
            <div className="p-2 rounded-xl bg-[#0d6b63]/10 text-[#0d6b63]"><Wallet className="w-4 h-4" /></div>
          </div>
          <p className="text-xl font-bold text-[#0d6b63]">${totalRetornoEsperado.toLocaleString('es-AR')}</p>
        </div>
      </div>

      {/* Préstamos Otorgados */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#0d6b63]" />
          Préstamos Otorgados con Capital del Inversor ({prestamos.length})
        </h4>
        {prestamos.length === 0 ? (
          <p className="text-xs text-slate-400 bg-white p-4 rounded-2xl border border-line">
            No posee préstamos vigentes con su capital.
          </p>
        ) : (
          <div className="space-y-2">
            {prestamos.map((p) => {
              const nombreCliente = p.clientes?.nombre_completo 
                || clientesRelacionados.find((c) => c.id === p.cliente_id)?.nombre_completo 
                || 'Cliente'

              return (
                <div key={p.id} className="p-4 rounded-2xl bg-white border border-line flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-black block mb-1">
                      Cliente: <b className='text-[#0d6b63] text-[12px]'>{nombreCliente}</b>
                    </span>
                    <span className="text-xs text-slate-500 font-medium block">Monto:</span>
                    <span className="text-base font-bold text-[#0d6b63]">
                      ${Number(p.monto_capital || p.monto || 0).toLocaleString('es-AR')}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-700 block">
                        Retorno Esperado: ${Number(p.monto_total_pagar || p.monto_total || 0).toLocaleString('es-AR')}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-block mt-1 ${
                        p.estado === 'finalizado' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {p.estado === 'finalizado' ? '✓ COBRADO' : p.estado}
                      </span>
                    </div>
                    {onVerFichaPrestamo && (
                      <button 
                        onClick={() => onVerFichaPrestamo(p)} 
                        className="p-2.5 rounded-xl bg-[#0d6b63]/10 text-[#0d6b63] hover:bg-[#0d6b63] hover:text-white transition-colors cursor-pointer"
                        title="Ver Ficha Prestamo"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}