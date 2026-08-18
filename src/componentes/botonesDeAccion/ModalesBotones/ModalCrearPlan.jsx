import React, { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'

export default function ModalCrearPlan({ isOpen, onClose, onSuccess, usuarioLogueado = null }) {
  const [formData, setFormData] = useState({
    nombre: '',
    monto: '',
    tasa_interes: '',
    plazo_cuotas: '1',
    frecuencia_pago: 'mensual'
  })
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const capitalizarPalabras = (texto) => {
    if (!texto) return ''
    return texto
      .toLowerCase()
      .replace(/(?:^|\s|-)\S/g, (caracter) => caracter.toUpperCase())
  }

  const handleChange = (e) => {
    const { name, value } = e.target

    let valorFinal = value
    if (name === 'nombre') {
      valorFinal = capitalizarPalabras(value)
    }

    setFormData((prev) => ({ ...prev, [name]: valorFinal }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const nombreLimpio = formData.nombre.trim()
    const montoNum = parseFloat(formData.monto)
    const tasaNum = parseFloat(formData.tasa_interes)
    const cuotasNum = parseInt(formData.plazo_cuotas, 10)

    try {
      // 1. Obtener usuario autenticado responsable
      let creadorId = usuarioLogueado?.id
      if (!creadorId) {
        const { data: authUserResp } = await supabase.auth.getUser()
        creadorId = authUserResp?.user?.id || null
      }

      let autorNombre = 'Administración'
      let autorRol = 'admin'

      if (creadorId) {
        const { data: autorData } = await supabase
          .from('usuarios')
          .select('nombre_completo, rol')
          .eq('id', creadorId)
          .maybeSingle()

        if (autorData) {
          autorNombre = autorData.nombre_completo || 'Administración'
          autorRol = autorData.rol || 'admin'
        }
      }

      // 2. Guardar el plan en la tabla planes_prestamo
      const payload = {
        nombre: nombreLimpio,
        monto: montoNum,
        tasa_interes: tasaNum,
        plazo_cuotas: cuotasNum,
        creado_por: creadorId,
        frecuencia_pago: formData.frecuencia_pago
      }

      const { data: planCreado, error } = await supabase
        .from('planes_prestamo')
        .insert([payload])
        .select()
        .single()

      if (error) throw error

      // 3. Registrar el alta en auditoria_actividades
      const auditPayload = {
        tipo: 'PRÉSTAMO',
        accion: 'CREADO',
        titulo: `Nuevo Plan: ${nombreLimpio}`,
        subtitulo: 'Creación de plantilla / opción de préstamo',
        detalles: `Monto: $${montoNum.toLocaleString('es-AR')} · Tasa: ${tasaNum}% · ${cuotasNum} cuotas (${formData.frecuencia_pago})`,
        persona: nombreLimpio,
        autor_id: creadorId,
        autor_nombre: autorNombre,
        autor_rol: autorRol,
        estado: 'Plan Habilitado',
        metadata: planCreado || payload
      }

      const { error: errAudit } = await supabase
        .from('auditoria_actividades')
        .insert([auditPayload])

      if (errAudit) console.warn('Aviso al guardar auditoría:', errAudit.message)

      // 4. Limpieza y cierre
      setFormData({
        nombre: '',
        monto: '',
        tasa_interes: '',
        plazo_cuotas: '1',
        frecuencia_pago: 'mensual'
      })

      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      console.error('Error al guardar la opción de préstamo:', err)
      setErrorMsg(err.message || 'Error al guardar la opción de préstamo.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-md rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl border border-line">
        
        {/* Cabecera */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#0d6b63]">
              CONFIGURACIÓN
            </span>
            <h2 className="text-2xl font-serif font-bold text-[#1d2939] mt-0.5">
              Nueva opción de préstamo
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-black/5 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nombre de la opción
            </label>
            <input
              type="text"
              name="nombre"
              required
              autoCapitalize="words"
              placeholder="Ej. Préstamo Clásico"
              value={formData.nombre}
              onChange={handleChange}
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Monto Capital ($)
              </label>
              <input
                type="number"
                name="monto"
                min="1"
                step="any"
                required
                placeholder="1000000"
                value={formData.monto}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tasa de interés (%)
              </label>
              <input
                type="number"
                name="tasa_interes"
                min="0"
                step="any"
                required
                placeholder="20"
                value={formData.tasa_interes}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cantidad de cuotas
              </label>
              <input
                type="number"
                name="plazo_cuotas"
                min="1"
                required
                value={formData.plazo_cuotas}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Frecuencia
              </label>
              <select
                name="frecuencia_pago"
                value={formData.frecuencia_pago}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63] cursor-pointer"
              >
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-xl border border-red-200">
              ⚠️ {errorMsg}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4">
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
              {loading ? 'Guardando...' : 'Guardar opción'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}