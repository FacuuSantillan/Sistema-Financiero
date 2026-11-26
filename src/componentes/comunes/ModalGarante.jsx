import { useEffect, useState } from 'react'
import { X, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { avisar } from '../../lib/avisos'
import { subirDocumentos } from '../../lib/documentos'
import CamposPersona, { payloadPersona, personaVacia, personaDesdeRegistro } from './CamposPersona'
import SelectorFotos from './SelectorFotos'
import GaleriaDocumentos from './GaleriaDocumentos'

/**
 * Alta o edición del garante de un cliente.
 * - `garante` null → alta nueva. Si `pasoDelAlta` es true, se muestra como
 *   segundo paso del alta de cliente (con botón "Omitir").
 */
export default function ModalGarante({ isOpen, onClose, onGuardado, cliente, garante = null, usuarioLogueado = null, pasoDelAlta = false }) {
  const [provincias, setProvincias] = useState([])
  const [formData, setFormData] = useState(personaVacia())
  const [archivos, setArchivos] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setFormData(garante ? personaDesdeRegistro(garante) : { ...personaVacia(), provincia_id: cliente?.provincia_id || '', localidad: cliente?.localidad || '' })
    setArchivos([])
    setErrorMsg('')
    supabase.from('provincias').select('*').order('nombre', { ascending: true }).then(({ data }) => setProvincias(data || []))
  }, [isOpen, garante, cliente])

  if (!isOpen || !cliente) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      const datos = payloadPersona(formData)
      let guardado

      if (garante?.id) {
        const { data, error } = await supabase.from('garantes').update(datos).eq('id', garante.id).select().single()
        if (error) throw error
        guardado = data
      } else {
        const { data, error } = await supabase
          .from('garantes')
          .insert([{ ...datos, cliente_id: cliente.id, creado_por: usuarioLogueado?.id || null }])
          .select()
          .single()
        if (error) throw error
        guardado = data
      }

      if (archivos.length > 0) {
        guardado.documentos = await subirDocumentos('garantes', guardado.id, archivos, guardado.documentos)
      }

      const { error: errAudit } = await supabase.from('auditoria_actividades').insert([{
        tipo: 'GARANTE',
        accion: garante?.id ? 'EDITADO' : 'CREADO',
        titulo: datos.nombre_completo,
        subtitulo: `Garante de ${cliente.nombre_completo}`,
        detalles: [datos.dni ? `${datos.tipo_documento}: ${datos.dni}` : 'Sin documento', datos.telefono ? `Tel: ${datos.telefono}` : null]
          .filter(Boolean).join(' · '),
        persona: cliente.nombre_completo,
        autor_id: usuarioLogueado?.id || null,
        autor_nombre: usuarioLogueado?.nombre || 'Administración',
        autor_rol: usuarioLogueado?.rol || 'admin',
        estado: garante?.id ? 'Datos Actualizados' : 'Activo',
        metadata: guardado
      }])
      if (errAudit) console.warn('Aviso al registrar auditoría de garante:', errAudit.message)

      avisar(garante?.id ? 'Garante actualizado' : `Garante ${datos.nombre_completo} guardado`)
      onGuardado?.(guardado)
      onClose()
    } catch (err) {
      console.error('Error al guardar garante:', err)
      setErrorMsg(err.message || 'No se pudo guardar el garante.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="modal-panel w-full max-w-xl rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl border border-line max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#0d6b63] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              {pasoDelAlta ? 'PASO 2 DE 2 · GARANTE' : garante ? 'EDITAR GARANTE' : 'NUEVO GARANTE'}
            </span>
            <h2 className="text-2xl font-serif font-bold text-[#1d2939] mt-0.5">Datos del garante</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Cliente: {cliente.nombre_completo}</p>
          </div>
          <button onClick={onClose} type="button" className="rounded-xl p-2 text-slate-400 hover:bg-black/5 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <CamposPersona formData={formData} setFormData={setFormData} provincias={provincias} />

          {garante?.id ? (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700">Fotos de documentación</span>
              <GaleriaDocumentos tabla="garantes" registro={garante} />
            </div>
          ) : (
            <SelectorFotos archivos={archivos} setArchivos={setArchivos} />
          )}

          {errorMsg && (
            <p className="text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-xl border border-red-200">⚠️ {errorMsg}</p>
          )}

          <div className="form-acciones flex justify-end items-center gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-2xl border border-line bg-white font-bold text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
              {pasoDelAlta ? 'Omitir garante' : 'Cancelar'}
            </button>
            <button type="submit" disabled={loading}
              className="px-5 py-2.5 rounded-2xl bg-[#0d6b63] text-white font-bold text-sm shadow-sm hover:bg-[#0b5a52] disabled:opacity-50 cursor-pointer">
              {loading ? (archivos.length ? 'Subiendo fotos...' : 'Guardando...') : 'Guardar garante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
