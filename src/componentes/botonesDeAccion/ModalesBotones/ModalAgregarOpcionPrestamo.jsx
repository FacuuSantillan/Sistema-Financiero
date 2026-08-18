import React, { useState, useEffect } from 'react'
import { X, Pencil, Trash2, Plus, Check } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient' // Ajustá la ruta según tu proyecto

export default function ModalCrearPlan({ isOpen, onClose, onSuccess }) {
  const [planes, setPlanes] = useState([])
  const [editingId, setEditingId] = useState(null) // ID del plan en edición (null = creando nuevo)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [formData, setFormData] = useState({
    nombre: '',
    monto: '',
    tasa_interes: ''
  })

  // Cargar planes cargados en la base de datos
  const fetchPlanes = async () => {
    setFetching(true)
    try {
      const { data, error } = await supabase
        .from('planes_prestamo')
        .select('*')
        .order('monto', { ascending: true })

      if (error) throw error
      if (data) setPlanes(data)
    } catch (err) {
      console.error('Error al cargar opciones de préstamos:', err)
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchPlanes()
      resetForm()
    }
  }, [isOpen])

  const resetForm = () => {
    setFormData({ nombre: '', monto: '', tasa_interes: '' })
    setEditingId(null)
    setErrorMsg('')
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Cargar datos en el formulario para editar
  const handleEditClick = (plan) => {
    setEditingId(plan.id)
    setFormData({
      nombre: plan.nombre,
      monto: plan.monto.toString(),
      tasa_interes: plan.tasa_interes.toString()
    })
    setErrorMsg('')
  }

  // Guardar (Insertar o Actualizar)
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      const payload = {
        nombre: formData.nombre,
        monto: parseFloat(formData.monto),
        tasa_interes: parseFloat(formData.tasa_interes),

      }

      if (editingId) {
        // ACTUALIZAR REGISTRO EXISTENTE
        const { error } = await supabase
          .from('planes_prestamo')
          .update(payload)
          .eq('id', editingId)

        if (error) throw error
      } else {
        // CREAR NUEVO REGISTRO
        const { error } = await supabase
          .from('planes_prestamo')
          .insert([payload])

        if (error) throw error
      }

      resetForm()
      await fetchPlanes()
      if (onSuccess) onSuccess()
    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || 'Error al procesar la opción de préstamo.')
    } finally {
      setLoading(false)
    }
  }

  // Eliminar un plan de la base de datos
  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de que querés eliminar esta opción de préstamo?')) return

    try {
      const { error } = await supabase
        .from('planes_prestamo')
        .delete()
        .eq('id', id)

      if (error) throw error

      if (editingId === id) resetForm()
      await fetchPlanes()
      if (onSuccess) onSuccess()
    } catch (err) {
      console.error(err)
      alert('No se pudo eliminar el registro. Puede estar asociado a préstamos existentes.')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-3xl bg-cream p-6 shadow-2xl border border-line max-h-[90vh] flex flex-col">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center mb-4">
          <div>
          
            <h2 className="text-xl font-bold font-serif text-[#1d2939] mt-0.5">
              Opciones de préstamo
            </h2>
          </div>
          <button 
            onClick={onClose} 
            type="button" 
            className="rounded-xl p-2 text-slate-400 hover:bg-black/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="overflow-y-auto pr-1 space-y-6 flex-1">
          
          {/* Formulario de Alta / Edición */}
          <form onSubmit={handleSubmit} className="bg-white p-4 rounded-2xl border border-line space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0d6b63] uppercase tracking-wider">
                {editingId ? '✏️ Editando opción' : '➕ Nueva opción'}
              </span>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-500 underline font-medium hover:text-slate-800"
                >
                  Cancelar edición
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nombre de la opción / etiqueta
              </label>
              <input
                type="text"
                name="nombre"
                required
                placeholder="Ej. Préstamo 1"
                value={formData.nombre}
                onChange={handleChange}
                className="w-full rounded-xl border border-line bg-cream/30 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Monto ($)
                </label>
                <input
                  type="number"
                  name="monto"
                  required
                  min="1"
                  placeholder="1000000"
                  value={formData.monto}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-line bg-cream/30 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tasa de interés (%)
                </label>
                <input
                  type="number"
                  name="tasa_interes"
                  required
                  min="0"
                  step="any"
                  placeholder="20"
                  value={formData.tasa_interes}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-line bg-cream/30 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
                />
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-red-600 font-semibold bg-red-50 p-2 rounded-lg border border-red-200">
                ⚠️ {errorMsg}
              </p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-[#0d6b63] text-white text-xs font-bold hover:bg-[#0b5a52] transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {editingId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {loading ? 'Guardando...' : editingId ? 'Actualizar opción' : 'Agregar opción'}
              </button>
            </div>
          </form>

          {/* Listado de Opciones Guardadas */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Opciones cargadas ({planes.length})
            </h3>

            {fetching ? (
              <p className="text-xs text-slate-400 py-4 text-center">Cargando opciones...</p>
            ) : planes.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center bg-white rounded-2xl border border-dashed border-line">
                No hay opciones guardadas todavía.
              </p>
            ) : (
              <div className="space-y-2">
                {planes.map((plan) => (
                  <div
                    key={plan.id}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      editingId === plan.id
                        ? 'bg-[#0d6b63]/10 border-[#0d6b63]'
                        : 'bg-white border-line hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-bold text-[#1d2939]">{plan.nombre}</p>
                      <p className="text-xs text-slate-500 font-medium">
                        Monto: <span className="text-[#0d6b63] font-bold">${Number(plan.monto).toLocaleString('es-AR')}</span> | Tasa: <span className="font-bold">{plan.tasa_interes}%</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditClick(plan)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#0d6b63] hover:bg-slate-100 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(plan.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="pt-4 mt-2 border-t border-line flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-2xl border border-line bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  )
}