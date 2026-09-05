import React, { useState } from 'react'
import { Search, CreditCard, Eye, Power, Edit2, Trash2, AlertTriangle, X } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'

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
  onVerFichaPrestamo,
  onSuccess,
  onClose
}) {
  const [modalConfirmacion, setModalConfirmacion] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [errorBorrado, setErrorBorrado] = useState(null)

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

  const ejecutarBorrado = async () => {
    const idCliente = cliente.id
    if (!idCliente) return

    setEliminando(true)
    setErrorBorrado(null)

    try {
      // 1. Obtener préstamos relacionados para evitar bloqueo por foreign keys
      const { data: prestamosDelCliente } = await supabase
        .from('prestamos')
        .select('id')
        .eq('cliente_id', idCliente)

      const prestamoIds = (prestamosDelCliente || []).map((p) => p.id)

      // 2. Eliminar pagos vinculados
      if (prestamoIds.length > 0) {
        await supabase
          .from('pagos')
          .delete()
          .in('prestamo_id', prestamoIds)
      }

      // 3. Eliminar préstamos vinculados
      await supabase
        .from('prestamos')
        .delete()
        .eq('cliente_id', idCliente)

      // 4. Eliminar el cliente
      const { data: eliminado, error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', idCliente)
        .select()

      if (error) {
        throw error
      }

      if (!eliminado || eliminado.length === 0) {
        throw new Error('Permiso denegado en la base de datos (RLS).')
      }

      // Cerrar modal y notificar para actualizar la lista
      setModalConfirmacion(false)
      if (onSuccess) onSuccess(idCliente)
    } catch (err) {
      console.error('Error al borrar cliente:', err)
      setErrorBorrado(err.message || 'No se pudo eliminar el cliente.')
    } finally {
      setEliminando(false)
    }
  }

  return (
    <>
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
                onClick={() => {
                  setErrorBorrado(null)
                  setModalConfirmacion(true)
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 shadow-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                <span>Borrar</span>
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
      </div>

      {/* MODAL DE CONFIRMACIÓN DE BORRADO */}
      {modalConfirmacion && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150 select-none">
          <div className="w-full max-w-md rounded-3xl bg-[#FAF8F5] p-6 shadow-2xl border border-[#E7E2D9] space-y-5">
            
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 shadow-sm border border-red-200">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <button
                disabled={eliminando}
                onClick={() => setModalConfirmacion(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-serif font-bold text-slate-900">
                ¿Eliminar cliente?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Estás a punto de borrar a <strong className="text-slate-800">{cliente.nombre_completo || cliente.nombre}</strong>. Se eliminará también todo su historial registrado (préstamos y cobros). Esta acción no se puede deshacer.
              </p>
            </div>

            {errorBorrado && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600">
                ⚠️ {errorBorrado}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={eliminando}
                onClick={() => setModalConfirmacion(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={eliminando}
                onClick={ejecutarBorrado}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {eliminando ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sí, eliminar</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
