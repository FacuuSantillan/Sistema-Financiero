import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'

export default function ModalEditarInversionista({ isOpen, onClose, onSuccess, inversionista }) {
  const [provincias, setProvincias] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [formData, setFormData] = useState({
    nombre_completo: '',
    dni: '',
    telefono: '',
    direccion: '',
    provincia_id: '',
    capital_disponible: ''
  })

  useEffect(() => {
    if (isOpen && inversionista) {
      setFormData({
        nombre_completo: inversionista.nombre_completo || inversionista.nombre || '',
        dni: inversionista.dni || '',
        telefono: inversionista.telefono || '',
        direccion: inversionista.direccion || '',
        provincia_id: inversionista.provincia_id || '',
        capital_disponible: inversionista.capital_disponible ?? ''
      })
      setErrorMsg('')

      async function loadProvincias() {
        const { data } = await supabase
          .from('provincias')
          .select('*')
          .order('nombre', { ascending: true })

        if (data) setProvincias(data)
      }
      loadProvincias()
    }
  }, [isOpen, inversionista])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

 const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      const payload = {
        nombre_completo: formData.nombre_completo.trim(),
        dni: formData.dni.trim() || null,
        telefono: formData.telefono.trim() || null,
        direccion: formData.direccion.trim() || null,
        provincia_id: formData.provincia_id || null,
        capital_disponible: Number(formData.capital_disponible || 0)
      }

      // 🔍 1. Comparar valores viejos vs nuevos
      const cambiosDetectados = []

      if ((inversionista.nombre_completo || '') !== payload.nombre_completo) {
        cambiosDetectados.push({ campo: 'Nombre', anterior: inversionista.nombre_completo || 'Sin nombre', nuevo: payload.nombre_completo })
      }
      if ((inversionista.dni || '') !== (payload.dni || '')) {
        cambiosDetectados.push({ campo: 'DNI / CUIT', anterior: inversionista.dni || 's/d', nuevo: payload.dni || 's/d' })
      }
      if ((inversionista.telefono || '') !== (payload.telefono || '')) {
        cambiosDetectados.push({ campo: 'Teléfono', anterior: inversionista.telefono || 's/d', nuevo: payload.telefono || 's/d' })
      }
      if ((inversionista.direccion || '') !== (payload.direccion || '')) {
        cambiosDetectados.push({ campo: 'Dirección', anterior: inversionista.direccion || 's/d', nuevo: payload.direccion || 's/d' })
      }
      if (Number(inversionista.capital_disponible || 0) !== payload.capital_disponible) {
        cambiosDetectados.push({ 
          campo: 'Capital Disponible', 
          anterior: `$${Number(inversionista.capital_disponible || 0).toLocaleString('es-AR')}`, 
          nuevo: `$${payload.capital_disponible.toLocaleString('es-AR')}` 
        })
      }

      // 2. Actualizar en Supabase
      const { data, error } = await supabase
        .from('usuarios')
        .update(payload)
        .eq('id', inversionista.id)
        .select()
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
        : 'Actualización general sin cambios'

      await supabase.from('auditoria_actividades').insert([{
        tipo: 'INVERSIONISTA',
        accion: 'EDITADO',
        titulo: formData.nombre_completo.trim(),
        subtitulo: `Modificación de perfil (${cambiosDetectados.length} ${cambiosDetectados.length === 1 ? 'campo' : 'campos'})`,
        detalles: resumenCambiosTexto,
        persona: formData.nombre_completo.trim(),
        autor_id: autorId,
        autor_nombre: autorNombre,
        autor_rol: autorRol,
        estado: 'Perfil Actualizado',
        metadata: {
          ...data,
          cambios_realizados: cambiosDetectados
        }
      }])

      if (onSuccess) onSuccess(data)
      onClose()
    } catch (err) {
      console.error('Error al editar inversionista:', err)
      setErrorMsg(err.message || 'No se pudo actualizar el perfil.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !inversionista) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-xl rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl border border-line">
        <div className="flex items-start justify-between mb-6">
          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#0d6b63]">
              GESTIÓN DE PERFIL
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1d2939] mt-0.5">
              Editar Inversionista
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nombre completo
              </label>
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                DNI / CUIT
              </label>
              <input
                type="text"
                name="dni"
                value={formData.dni}
                onChange={handleChange}
                placeholder="Ej. 35123456"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                name="telefono"
                value={formData.telefono}
                onChange={handleChange}
                placeholder="Ej. 381 1234567"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Dirección / Domicilio
              </label>
              <input
                type="text"
                name="direccion"
                value={formData.direccion}
                onChange={handleChange}
                placeholder="Ej. San Martín 450"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Provincia
              </label>
              <select
                name="provincia_id"
                value={formData.provincia_id}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63] cursor-pointer"
              >
                <option value="">Sin especificar</option>
                {provincias.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Capital Disponible ($)
              </label>
              <input
                type="number"
                name="capital_disponible"
                min="0"
                step="any"
                required
                value={formData.capital_disponible}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>
          </div>

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
              {loading ? 'Guardando...' : 'Actualizar Inversionista'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}