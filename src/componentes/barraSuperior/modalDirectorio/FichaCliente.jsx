import { useEffect, useState } from 'react'
import { Search, CreditCard, Eye, Power, Edit2, Trash2, AlertTriangle, X, ShieldCheck, FileImage, Plus } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'
import { avisar } from '../../../lib/avisos'
import GaleriaDocumentos from '../../comunes/GaleriaDocumentos'
import ModalGarante from '../../comunes/ModalGarante'

function Dato({ etiqueta, valor }) {
  if (!valor) return null
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{etiqueta}</span>
      <span className="block text-xs font-semibold text-slate-800 break-words">{valor}</span>
    </div>
  )
}

function DatosPersona({ persona, provincias }) {
  const provincia = provincias.find((p) => p.id === persona.provincia_id)?.nombre
  const documento = persona.dni
    ? `${persona.tipo_documento || 'DNI'} ${persona.dni}`
    : persona.tipo_documento === 'SIN DOCUMENTO' ? 'Sin documento' : null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <Dato etiqueta="Documento" valor={documento} />
      <Dato etiqueta="Condición fiscal" valor={persona.condicion_fiscal} />
      <Dato etiqueta="Ocupación" valor={persona.ocupacion} />
      <Dato etiqueta="Teléfono" valor={persona.telefono} />
      <Dato etiqueta="Email" valor={persona.email} />
      <Dato etiqueta="Domicilio" valor={persona.direccion} />
      <Dato etiqueta="Localidad" valor={persona.localidad} />
      <Dato etiqueta="Provincia" valor={provincia} />
    </div>
  )
}

export default function FichaCliente({
  cliente,
  fetchingDetalle = false,
  prestamos = [],
  esInversionista = false,
  actionLoading = false,
  usuarioLogueado = null,
  onEditar,
  onToggleEstado,
  onVerFichaPrestamo,
  onSuccess
}) {
  const [modalConfirmacion, setModalConfirmacion] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [errorBorrado, setErrorBorrado] = useState(null)

  const [garantes, setGarantes] = useState([])
  const [provincias, setProvincias] = useState([])
  const [garanteEditando, setGaranteEditando] = useState(null) // null | 'nuevo' | objeto garante

  const clienteId = cliente?.id

  useEffect(() => {
    supabase.from('provincias').select('id, nombre').then(({ data }) => setProvincias(data || []))
  }, [])

  useEffect(() => {
    if (!clienteId) return
    let activo = true
    supabase
      .from('garantes')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.warn('No se pudieron cargar los garantes:', error.message)
        if (activo) setGarantes(data || [])
      })
    return () => { activo = false }
  }, [clienteId])

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
  const puedeEditar = !esInversionista

  const ejecutarBorrado = async () => {
    setEliminando(true)
    setErrorBorrado(null)

    try {
      // Se borran primero pagos y préstamos por si la base no tiene ON DELETE CASCADE
      const { data: prestamosDelCliente, error: errP } = await supabase
        .from('prestamos').select('id').eq('cliente_id', cliente.id)
      if (errP) throw errP

      const prestamoIds = (prestamosDelCliente || []).map((p) => p.id)
      if (prestamoIds.length > 0) {
        const { error: errPagos } = await supabase.from('pagos').delete().in('prestamo_id', prestamoIds)
        if (errPagos) throw errPagos
        const { error: errPrest } = await supabase.from('prestamos').delete().eq('cliente_id', cliente.id)
        if (errPrest) throw errPrest
      }

      const { data: eliminado, error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', cliente.id)
        .select()

      if (error) throw error
      if (!eliminado || eliminado.length === 0) {
        throw new Error('Permiso denegado en la base de datos (RLS).')
      }

      setModalConfirmacion(false)
      avisar(`Cliente ${cliente.nombre_completo} eliminado`)
      if (onSuccess) onSuccess(cliente.id)
    } catch (err) {
      console.error('Error al borrar cliente:', err)
      setErrorBorrado(err.message || 'No se pudo eliminar el cliente.')
    } finally {
      setEliminando(false)
    }
  }

  const eliminarGarante = async (garante) => {
    if (!window.confirm(`¿Eliminar a ${garante.nombre_completo} como garante?`)) return
    const { error } = await supabase.from('garantes').delete().eq('id', garante.id)
    if (error) {
      window.alert(`No se pudo eliminar: ${error.message}`)
      return
    }
    setGarantes((prev) => prev.filter((g) => g.id !== garante.id))
  }

  const garanteGuardado = (g) => {
    setGarantes((prev) => (prev.some((x) => x.id === g.id) ? prev.map((x) => (x.id === g.id ? g : x)) : [...prev, g]))
  }

  return (
    <>
      <div className="flex flex-col h-full overflow-y-auto pl-0 md:pl-2 pr-1 space-y-5 pb-4">
        {/* Cabecera */}
        <div className="p-5 rounded-2xl bg-white border border-line shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0d6b63]">FICHA DEL CLIENTE</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${estaActivo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  {estaActivo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <h3 className="text-2xl font-serif font-bold text-slate-900 mt-0.5">{cliente.nombre_completo}</h3>
            </div>

            {puedeEditar && (
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button onClick={onEditar}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer">
                  <Edit2 className="w-3.5 h-3.5 text-[#0d6b63]" /> Editar
                </button>
                <button onClick={() => { setErrorBorrado(null); setModalConfirmacion(true) }} disabled={eliminando}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer disabled:opacity-50">
                  <Trash2 className="w-3.5 h-3.5" /> Borrar
                </button>
                <button onClick={onToggleEstado} disabled={actionLoading}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                    estaActivo ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  }`}>
                  <Power className="w-3.5 h-3.5" /> {estaActivo ? 'Deshabilitar' : 'Habilitar'}
                </button>
              </div>
            )}
          </div>

          <DatosPersona persona={cliente} provincias={provincias} />

          <div className="space-y-2 pt-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <FileImage className="w-4 h-4 text-[#0d6b63]" /> Documentación del cliente
            </h4>
            <GaleriaDocumentos key={cliente.id} tabla="clientes" registro={cliente} puedeEditar={puedeEditar} />
          </div>
        </div>

        {/* Garantes */}
        <div className="p-5 rounded-2xl bg-white border border-line shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0d6b63]" /> Garante{garantes.length === 1 ? '' : 's'} ({garantes.length})
            </h4>
            {puedeEditar && (
              <button onClick={() => setGaranteEditando('nuevo')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0d6b63]/10 text-[#0d6b63] text-xs font-bold hover:bg-[#0d6b63] hover:text-white cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Agregar garante
              </button>
            )}
          </div>

          {garantes.length === 0 ? (
            <p className="text-xs text-slate-400">Este cliente no tiene garante cargado.</p>
          ) : (
            garantes.map((g) => (
              <div key={g.id} className="rounded-2xl border border-line p-4 space-y-3 bg-[#FAF8F5]">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-slate-900">{g.nombre_completo}</span>
                  {puedeEditar && (
                    <div className="flex gap-1.5">
                      <button onClick={() => setGaranteEditando(g)} aria-label="Editar garante"
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => eliminarGarante(g)} aria-label="Eliminar garante"
                        className="p-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <DatosPersona persona={g} provincias={provincias} />
                <GaleriaDocumentos key={g.id} tabla="garantes" registro={g} puedeEditar={puedeEditar} />
              </div>
            ))
          )}
        </div>

        {/* Préstamos */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#0d6b63]" /> Préstamos de este cliente ({prestamos.length})
          </h4>
          {prestamos.length === 0 ? (
            <p className="text-xs text-slate-400 bg-white p-4 rounded-2xl border border-line">Sin préstamos asignados.</p>
          ) : (
            <div className="space-y-2">
              {prestamos.map((p) => (
                <div key={p.id} className="p-4 rounded-2xl bg-white border border-line flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 font-medium block">Capital entregado:</span>
                    <span className="text-base font-bold text-slate-800">${Number(p.monto_capital || 0).toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${p.estado === 'finalizado' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {p.estado === 'finalizado' ? '✓ COBRADO' : p.estado}
                      </span>
                      <span className="text-xs text-slate-500 font-bold block mt-1">
                        Total: ${Number(p.monto_total_pagar || 0).toLocaleString('es-AR')}
                      </span>
                    </div>
                    {onVerFichaPrestamo && (
                      <button onClick={() => onVerFichaPrestamo(p)} aria-label="Ver préstamo"
                        className="p-2.5 rounded-xl bg-[#0d6b63]/10 text-[#0d6b63] hover:bg-[#0d6b63] hover:text-white cursor-pointer">
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

      <ModalGarante
        isOpen={garanteEditando !== null}
        cliente={cliente}
        garante={garanteEditando === 'nuevo' ? null : garanteEditando}
        usuarioLogueado={usuarioLogueado}
        onGuardado={garanteGuardado}
        onClose={() => setGaranteEditando(null)}
      />

      {/* Confirmación de borrado */}
      {modalConfirmacion && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-[#FAF8F5] p-6 shadow-2xl border border-[#E7E2D9] space-y-5">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 border border-red-200">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <button disabled={eliminando} onClick={() => setModalConfirmacion(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-serif font-bold text-slate-900">¿Eliminar cliente?</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Estás a punto de borrar a <strong className="text-slate-800">{cliente.nombre_completo}</strong>. Se eliminará también todo su historial (préstamos, cobros y garantes). Esta acción no se puede deshacer.
              </p>
            </div>
            {errorBorrado && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600">⚠️ {errorBorrado}</div>
            )}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button type="button" disabled={eliminando} onClick={() => setModalConfirmacion(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                Cancelar
              </button>
              <button type="button" disabled={eliminando} onClick={ejecutarBorrado}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" /> {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
