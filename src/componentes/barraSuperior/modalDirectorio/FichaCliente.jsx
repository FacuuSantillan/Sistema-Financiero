import React from 'react'
import { Search, CreditCard, Receipt, Eye, Power, Edit2 } from 'lucide-react'

export default function FichaCliente({
  cliente,
  fetchingDetalle = false,
  referidoInfo = '',
  prestamos = [],
  pagos = [],
  esInversionista = false,
  actionLoading = false,
  formatearFecha,
  onEditar,
  onToggleEstado,
  onVerFichaPrestamo
}) {
  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <Search className="w-10 h-10 mb-2 opacity-40" />
        <p className="text-sm font-medium">Seleccioná un cliente para ver su perfil</p>
      </div>
    )
  }

  if (fetchingDetalle) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <p className="text-sm font-medium">Cargando detalles...</p>
      </div>
    )
  }

  const estaActivo = cliente.activo ?? true

  return (
    <div className="flex flex-col h-full overflow-y-auto pl-0 md:pl-2 pr-1 space-y-5">
      {/* Header Ficha Cliente */}
      <div className="p-5 rounded-2xl bg-white border border-line shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0d6b63]">
              INFORMACIÓN GENERAL (CLIENTE)
            </span>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              estaActivo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
            }`}>
              {estaActivo ? 'Activo' : 'Inactivo'}
            </span>
          </div>

          <h3 className="text-2xl font-serif font-bold text-slate-900 mt-0.5">
            {cliente.nombre_completo || cliente.nombre}
          </h3>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2.5 font-medium">
            <span className="flex items-center gap-1 bg-[#0d6b63]/10 text-[#0d6b63] font-bold px-2.5 py-1 rounded-xl">
              Origen: {referidoInfo || 'Cargando...'}
            </span>
            {cliente.dni && <span className="bg-slate-100 px-2.5 py-1 rounded-lg">🪪 DNI: {cliente.dni}</span>}
            {cliente.telefono && <span className="bg-slate-100 px-2.5 py-1 rounded-lg">📞 Tel: {cliente.telefono}</span>}
            {cliente.direccion && <span className="bg-slate-100 px-2.5 py-1 rounded-lg">📍 {cliente.direccion}</span>}
            {cliente.email && <span className="bg-slate-100 px-2.5 py-1 rounded-lg">✉️ Email: {cliente.email}</span>}
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

      {/* Préstamos del Cliente */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#0d6b63]" />
          Préstamos de este Cliente ({prestamos.length})
        </h4>
        {prestamos.length === 0 ? (
          <p className="text-xs text-slate-400 bg-white p-4 rounded-2xl border border-line">Sin préstamos asignados.</p>
        ) : (
          <div className="space-y-2">
            {prestamos.map((p) => (
              <div key={p.id} className="p-4 rounded-2xl bg-white border border-line flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-medium block">Capital entregado:</span>
                  <span className="text-base font-bold text-slate-800">
                    ${Number(p.monto_capital || p.monto || 0).toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                      p.estado === 'finalizado' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {p.estado === 'finalizado' ? '✓ COBRADO' : p.estado}
                    </span>
                    <span className="text-xs text-slate-500 font-bold block mt-1">
                      Total: ${Number(p.monto_total_pagar || p.monto_total || 0).toLocaleString('es-AR')}
                    </span>
                  </div>
                  {onVerFichaPrestamo && (
                    <button 
                      onClick={() => onVerFichaPrestamo(p)} 
                      className="p-2.5 rounded-xl bg-[#0d6b63]/10 text-[#0d6b63] hover:bg-[#0d6b63] hover:text-white transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial de Cobros
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-[#0d6b63]" />
          Historial de Cobros Recibidos ({pagos.length})
        </h4>
        {pagos.length === 0 ? (
          <p className="text-xs text-slate-400 bg-white p-4 rounded-2xl border border-line">No posee cobros registrados.</p>
        ) : (
          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {pagos.map((pago) => {
              const nombreCliente = pago.clientes?.nombre_completo || cliente?.nombre_completo || 'Cliente'

              return (
                <div key={pago.id} className="p-3.5 rounded-2xl bg-white border border-line flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0d6b63] block mb-0.5">
                      Cliente: {nombreCliente}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        ${Number(pago.monto_cobrado || pago.monto_pago || 0).toLocaleString('es-AR')}
                      </span>
                      <span className="text-slate-500 font-medium">({pago.metodo_pago || 'Efectivo'})</span>
                    </div>
                  </div>
                  <span className="text-slate-600 font-bold bg-slate-100 px-3 py-1 rounded-xl shrink-0">
                    {formatearFecha ? formatearFecha(pago.fecha_pago) : pago.fecha_pago}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div> */}
    </div>
  )
}