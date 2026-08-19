
import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'

export default function ModalEditarCliente({ isOpen, onClose, onSuccess, cliente }) {
  const [inversionistas, setInversionistas] = useState([])
  const [provincias, setProvincias] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [formData, setFormData] = useState({
    nombre_completo: '',
    dni: '',
    telefono: '',
    direccion: '',
    origen: 'propio',
    inversionista_id: '',
    provincia_id: ''
  })

  useEffect(() => {
    if (isOpen && cliente) {
      setFormData({
        nombre_completo: cliente.nombre_completo || cliente.nombre || '',
        dni: cliente.dni || cliente.dni_cuit || '',
        telefono: cliente.telefono || '',
        direccion: cliente.direccion || '',
        origen: cliente.inversionista_id ? 'inversionista' : 'propio',
        inversionista_id: cliente.inversionista_id || '',
        provincia_id: cliente.provincia_id || ''
      })
      setErrorMsg('')

      async function loadData() {
        try {
          const { data: provData } = await supabase
            .from('provincias')
            .select('*')
            .order('nombre', { ascending: true })
          if (provData) setProvincias(provData)

          const { data: invData } = await supabase
            .from('usuarios')
            .select('id, nombre_completo, rol, activo')
            .eq('activo', true)
            .eq('rol', 'inversionista')
            .order('nombre_completo', { ascending: true })
          if (invData) setInversionistas(invData)
        } catch (err) {
          console.error('Error al cargar datos auxiliares:', err)
        }
      }

      loadData()
    }
  }, [isOpen, cliente])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

 const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    if (!formData.nombre_completo.trim()) {
      setErrorMsg('El nombre completo es obligatorio.')
      setLoading(false)
      return
    }

    try {
      const payload = {
        nombre_completo: formData.nombre_completo.trim(),
        dni: formData.dni.trim() || null,
        telefono: formData.telefono.trim() || null,
        direccion: formData.direccion.trim() || null,
        inversionista_id: formData.origen === 'inversionista' ? formData.inversionista_id : null,
        provincia_id: formData.provincia_id || null
      }

      // 🔍 1. Comparar valores viejos vs nuevos
      const cambiosDetectados = []

      if ((cliente.nombre_completo || '') !== payload.nombre_completo) {
        cambiosDetectados.push({ campo: 'Nombre', anterior: cliente.nombre_completo || 'Sin nombre', nuevo: payload.nombre_completo })
      }
      if ((cliente.dni || '') !== (payload.dni || '')) {
        cambiosDetectados.push({ campo: 'DNI / CUIT', anterior: cliente.dni || 's/d', nuevo: payload.dni || 's/d' })
      }
      if ((cliente.telefono || '') !== (payload.telefono || '')) {
        cambiosDetectados.push({ campo: 'Teléfono', anterior: cliente.telefono || 's/d', nuevo: payload.telefono || 's/d' })
      }
      if ((cliente.direccion || '') !== (payload.direccion || '')) {
        cambiosDetectados.push({ campo: 'Dirección', anterior: cliente.direccion || 's/d', nuevo: payload.direccion || 's/d' })
      }
      if ((cliente.inversionista_id || '') !== (payload.inversionista_id || '')) {
        const invViejo = inversionistas.find(i => i.id === cliente.inversionista_id)?.nombre_completo || 'Propio'
        const invNuevo = inversionistas.find(i => i.id === payload.inversionista_id)?.nombre_completo || 'Propio'
        cambiosDetectados.push({ campo: 'Inversionista / Cartera', anterior: invViejo, nuevo: invNuevo })
      }

      // 2. Actualizar en Supabase
      const { data, error } = await supabase
        .from('clientes')
        .update(payload)
        .eq('id', cliente.id)
        .select('*, provincias(nombre), usuarios!inversionista_id(nombre_completo)')
        .single()

      if (error) throw error

      // 3. Obtener autor
      const { data: authUserResp } = await supabase.auth.getUser()
      const autorId = authUserResp?.user?.id || null
      let autorNombre = 'Administración'
      let autorRol = 'admin'

      if (autorId) {
        const { data: autorData } = await supabase
          .from('usuarios')
          .select('nombre_completo, rol')
          .eq('id', autorId)
          .maybeSingle()
        if (autorData) {
          autorNombre = autorData.nombre_completo || 'Administración'
          autorRol = autorData.rol || 'admin'
        }
      }

      // 4. Guardar en auditoría con el array de cambios
      const resumenCambiosTexto = cambiosDetectados.length > 0
        ? cambiosDetectados.map(c => `${c.campo}: "${c.anterior}" ➔ "${c.nuevo}"`).join(' · ')
        : 'Actualización general sin cambios de texto'

      await supabase.from('auditoria_actividades').insert([{
        tipo: 'CLIENTE',
        accion: 'EDITADO',
        titulo: formData.nombre_completo.trim(),
        subtitulo: `Modificación de perfil (${cambiosDetectados.length} ${cambiosDetectados.length === 1 ? 'campo' : 'campos'})`,
        detalles: resumenCambiosTexto,
        persona: formData.nombre_completo.trim(),
        autor_id: autorId,
        autor_nombre: autorNombre,
        autor_rol: autorRol,
        estado: 'Datos Actualizados',
        metadata: {
          ...data,
          cambios_realizados: cambiosDetectados
        }
      }])

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-xl rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl border border-line">
        <div className="flex items-start justify-between mb-6">
          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#0d6b63]">
              GESTIÓN DE CLIENTE
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1d2939] mt-0.5">
              Editar Cliente
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-xl p-2 text-slate-400 hover:bg-black/5 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nombre completo</label>
              <input
                type="text"
                name="nombre_completo"
                required
                value={formData.nombre_completo}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">DNI / CUIT</label>
              <input
                type="text"
                name="dni"
                value={formData.dni}
                onChange={handleChange}
                placeholder="Ej. 44478619"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono</label>
              <input
                type="tel"
                name="telefono"
                value={formData.telefono}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Dirección / Domicilio</label>
              <input
                type="text"
                name="direccion"
                value={formData.direccion}
                onChange={handleChange}
                placeholder="Ej. Av. Aconquija 1200"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Origen del cliente</label>
              <select
                name="origen"
                value={formData.origen}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63] cursor-pointer"
              >
                <option value="propio">Propio (Administrador)</option>
                <option value="inversionista">Inversionista asignado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Provincia</label>
              <select
                name="provincia_id"
                value={formData.provincia_id}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63] cursor-pointer"
              >
                <option value="">Sin especificar</option>
                {provincias.map((prov) => (
                  <option key={prov.id} value={prov.id}>
                    {prov.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formData.origen === 'inversionista' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Inversionista asignado</label>
              <select
                name="inversionista_id"
                required
                value={formData.inversionista_id}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63] cursor-pointer"
              >
                <option value="">-- Seleccioná el inversionista --</option>
                {inversionistas.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.nombre_completo}
                  </option>
                ))}
              </select>
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-xl border border-red-200">
              ⚠️ {errorMsg}
            </p>
          )}

          <div className="flex justify-end items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl border border-line bg-white font-bold text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-2xl bg-[#0d6b63] text-white font-bold text-sm shadow-sm hover:bg-[#0b5a52] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Guardando...' : 'Actualizar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}