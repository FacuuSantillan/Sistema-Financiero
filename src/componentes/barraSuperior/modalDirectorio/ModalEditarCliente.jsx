import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'
import { avisar } from '../../../lib/avisos'
import CamposPersona, { payloadPersona, personaDesdeRegistro, personaVacia } from '../../comunes/CamposPersona'

const ETIQUETAS = {
  nombre_completo: 'Nombre',
  tipo_documento: 'Tipo de documento',
  dni: 'Documento',
  condicion_fiscal: 'Condición fiscal',
  email: 'Email',
  telefono: 'Teléfono',
  direccion: 'Domicilio',
  localidad: 'Localidad',
  provincia_id: 'Provincia',
  ocupacion: 'Ocupación'
}

export default function ModalEditarCliente({ isOpen, onClose, onSuccess, cliente, usuarioLogueado = null }) {
  const [provincias, setProvincias] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [formData, setFormData] = useState(personaVacia())

  useEffect(() => {
    if (!isOpen || !cliente) return
    setFormData(personaDesdeRegistro(cliente))
    setErrorMsg('')
    supabase.from('provincias').select('*').order('nombre', { ascending: true }).then(({ data }) => setProvincias(data || []))
  }, [isOpen, cliente])

  const nombreProvincia = (id) => provincias.find((p) => p.id === id)?.nombre || 's/d'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      const payload = payloadPersona(formData)

      // Comparar valores viejos vs nuevos para la auditoría
      const cambiosDetectados = Object.keys(ETIQUETAS)
        .filter((campo) => (cliente[campo] || '') !== (payload[campo] || ''))
        .map((campo) => ({
          campo: ETIQUETAS[campo],
          anterior: campo === 'provincia_id' ? nombreProvincia(cliente[campo]) : cliente[campo] || 's/d',
          nuevo: campo === 'provincia_id' ? nombreProvincia(payload[campo]) : payload[campo] || 's/d'
        }))

      const { data, error } = await supabase
        .from('clientes')
        .update(payload)
        .eq('id', cliente.id)
        .select('*')
        .single()

      if (error) throw error

      const resumenCambiosTexto = cambiosDetectados.length > 0
        ? cambiosDetectados.map((c) => `${c.campo}: "${c.anterior}" ➔ "${c.nuevo}"`).join(' · ')
        : 'Actualización general sin cambios de texto'

      const { error: errAudit } = await supabase.from('auditoria_actividades').insert([{
        tipo: 'CLIENTE',
        accion: 'EDITADO',
        titulo: payload.nombre_completo,
        subtitulo: `Modificación de perfil (${cambiosDetectados.length} ${cambiosDetectados.length === 1 ? 'campo' : 'campos'})`,
        detalles: resumenCambiosTexto,
        persona: payload.nombre_completo,
        autor_id: usuarioLogueado?.id || null,
        autor_nombre: usuarioLogueado?.nombre || 'Administración',
        autor_rol: usuarioLogueado?.rol || 'admin',
        estado: 'Datos Actualizados',
        metadata: { ...data, cambios_realizados: cambiosDetectados }
      }])
      if (errAudit) console.warn('Aviso al registrar auditoría:', errAudit.message)

      avisar('Cambios del cliente guardados')
      if (onSuccess) onSuccess(data)
      onClose()
    } catch (err) {
      console.error('Error al actualizar cliente:', err)
      setErrorMsg(err.message || 'No se pudo actualizar el cliente.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !cliente) return null

  return (
    <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="modal-panel w-full max-w-xl rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl border border-line max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#0d6b63]">EDITAR CLIENTE</span>
            <h2 className="text-2xl font-serif font-bold text-[#1d2939] mt-0.5">{cliente.nombre_completo}</h2>
          </div>
          <button onClick={onClose} type="button" className="rounded-xl p-2 text-slate-400 hover:bg-black/5 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <CamposPersona formData={formData} setFormData={setFormData} provincias={provincias} />

          {errorMsg && (
            <p className="text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-xl border border-red-200">⚠️ {errorMsg}</p>
          )}

          <div className="form-acciones flex justify-end items-center gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-2xl border border-line bg-white font-bold text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="px-5 py-2.5 rounded-2xl bg-[#0d6b63] text-white font-bold text-sm shadow-sm hover:bg-[#0b5a52] disabled:opacity-50 cursor-pointer">
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
