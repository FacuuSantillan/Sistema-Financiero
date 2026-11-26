import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'
import { avisar } from '../../../lib/avisos'
import { subirDocumentos } from '../../../lib/documentos'
import CamposPersona, { payloadPersona, personaVacia } from '../../comunes/CamposPersona'
import SelectorFotos from '../../comunes/SelectorFotos'
import ModalGarante from '../../comunes/ModalGarante'

/**
 * Alta de cliente en dos pasos:
 *   1. Datos del cliente (+ fotos de documentación)
 *   2. Datos del garante (+ fotos), se puede omitir
 */
export default function ModalCliente({ isOpen, onClose, onSuccess, usuarioLogueado = null }) {
  const [provincias, setProvincias] = useState([])
  const [formData, setFormData] = useState(personaVacia())
  const [archivos, setArchivos] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [clienteCreado, setClienteCreado] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setFormData(personaVacia())
    setArchivos([])
    setErrorMsg('')
    setClienteCreado(null)
    supabase
      .from('provincias')
      .select('*')
      .order('nombre', { ascending: true })
      .then(({ data }) => setProvincias(data || []))
  }, [isOpen])

  if (!isOpen) return null

  const finalizar = () => {
    if (onSuccess) onSuccess()
    onClose()
  }

  // Paso 2: garante
  if (clienteCreado) {
    return (
      <ModalGarante
        isOpen
        pasoDelAlta
        cliente={clienteCreado}
        usuarioLogueado={usuarioLogueado}
        onClose={finalizar}
      />
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      const datos = payloadPersona(formData)

      // Evita cargar dos veces a la misma persona (mismo número de documento)
      if (datos.dni) {
        const digitos = datos.dni.replace(/\D/g, '')
        // Se comparan solo los números: "30.123.456" y "30123456" son el mismo documento
        const { data: existentes } = await supabase
          .from('clientes')
          .select('id, nombre_completo, dni')
          .not('dni', 'is', null)

        const duplicado = (existentes || []).find((c) => (c.dni || '').replace(/\D/g, '') === digitos)
        if (duplicado && !window.confirm(
          `Ya existe un cliente con el documento ${datos.dni}: ${duplicado.nombre_completo}.\n\n¿Querés crearlo igual?`
        )) {
          setLoading(false)
          return
        }
      }

      const { data: cliente, error } = await supabase
        .from('clientes')
        .insert([{ ...datos, creado_por: usuarioLogueado?.id || null, inversionista_id: null, activo: true }])
        .select()
        .single()

      if (error) throw error

      // Fotos: si falla la subida, el cliente igual queda creado
      let avisoFotos = ''
      if (archivos.length > 0) {
        try {
          cliente.documentos = await subirDocumentos('clientes', cliente.id, archivos, cliente.documentos)
        } catch (errFotos) {
          avisoFotos = errFotos.message
        }
      }

      const { error: auditError } = await supabase.from('auditoria_actividades').insert([{
        tipo: 'CLIENTE',
        accion: 'CREADO',
        titulo: datos.nombre_completo,
        subtitulo: 'Nuevo cliente registrado',
        detalles: [
          datos.dni ? `${datos.tipo_documento}: ${datos.dni}` : 'Sin documento',
          datos.telefono ? `Tel: ${datos.telefono}` : null,
          datos.condicion_fiscal,
          datos.localidad
        ].filter(Boolean).join(' · '),
        persona: datos.nombre_completo,
        autor_id: usuarioLogueado?.id || null,
        autor_nombre: usuarioLogueado?.nombre || 'Administración',
        autor_rol: usuarioLogueado?.rol || 'admin',
        estado: 'Activo',
        metadata: cliente
      }])
      if (auditError) console.warn('Aviso al guardar auditoría:', auditError.message)

      if (avisoFotos) {
        window.alert(`El cliente se guardó, pero hubo un problema con las fotos:\n${avisoFotos}\n\nPodés volver a subirlas desde su ficha.`)
      }

      avisar(`Cliente ${datos.nombre_completo} guardado. Ahora podés cargar su garante.`)
      setClienteCreado(cliente) // → paso 2 (garante)
    } catch (err) {
      console.error('Error al guardar cliente:', err)
      setErrorMsg(err.message || 'No se pudo guardar el cliente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="modal-panel w-full max-w-xl rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl border border-line max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#0d6b63]">PASO 1 DE 2 · CLIENTE</span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1d2939] mt-0.5">Nuevo Cliente</h2>
          </div>
          <button onClick={onClose} type="button" className="rounded-xl p-2 text-slate-400 hover:bg-black/5 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <CamposPersona formData={formData} setFormData={setFormData} provincias={provincias} />
          <SelectorFotos archivos={archivos} setArchivos={setArchivos} />

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
              {loading ? (archivos.length ? 'Subiendo fotos...' : 'Guardando...') : 'Guardar y seguir con garante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
