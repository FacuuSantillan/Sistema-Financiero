import React, { useState, useEffect } from 'react'
import { X, Lock, Mail, UserCheck } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabaseClient'

export default function ModalInversionista({ isOpen, onClose, onSuccess }) {
  const [provincias, setProvincias] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [formData, setFormData] = useState({
    nombre_completo: '',
    telefono: '',
    email: '',
    password: '',
    provincia_id: '',
    capital_disponible: ''
  })

  // Cargar lista de provincias desde Supabase
  useEffect(() => {
    if (isOpen) {
      async function loadProvincias() {
        const { data, error } = await supabase
          .from('provincias')
          .select('*')
          .order('nombre', { ascending: true })

        if (!error && data) {
          setProvincias(data)
          if (data.length > 0) {
            setFormData((prev) => ({ ...prev, provincia_id: data[0].id }))
          }
        }
      }
      loadProvincias()
    }
  }, [isOpen])

  const capitalizarPalabras = (texto) => {
    if (!texto) return ''
    return texto
      .toLowerCase()
      .replace(/(?:^|\s|-)\S/g, (caracter) => caracter.toUpperCase())
  }

  const handleChange = (e) => {
    const { name, value } = e.target

    let valorFinal = value
    if (name === 'nombre_completo' || name === 'direccion') {
      valorFinal = capitalizarPalabras(value)
    }

    setFormData((prev) => ({
      ...prev,
      [name]: valorFinal
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const emailLimpio = formData.email.trim()
    const nombreLimpio = formData.nombre_completo.trim()

    try {
      // 1. Obtener el usuario autenticado (Owner o Admin) que ejecuta el alta
      const { data: authUserResp } = await supabase.auth.getUser()
      const creadorId = authUserResp?.user?.id || null

      let autorNombre = 'Sistema / Owner'
      let autorRol = 'owner'

      if (creadorId) {
        const { data: autorData } = await supabase
          .from('usuarios')
          .select('nombre_completo, rol')
          .eq('id', creadorId)
          .maybeSingle()

        if (autorData) {
          autorNombre = autorData.nombre_completo || 'Administrador'
          autorRol = autorData.rol || 'admin'
        }
      }

      // 2. Cliente auxiliar en memoria volátil (no persiste ni desloguea al usuario actual)
      const supabaseAuxiliar = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
            storage: {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {}
            }
          }
        }
      )

      // 3. Registrar credenciales en Supabase Auth
      const { data: authData, error: authError } = await supabaseAuxiliar.auth.signUp({
        email: emailLimpio,
        password: formData.password.trim(),
        options: {
          data: {
            nombre_completo: nombreLimpio,
            rol: 'inversionista'
          }
        }
      })

      if (authError) throw new Error(`Error en autenticación: ${authError.message}`)

      const nuevoUserId = authData.user?.id
      if (!nuevoUserId) throw new Error('No se pudo obtener el ID del nuevo inversionista.')

      // 4. Insertar en la tabla 'usuarios'
      const payloadUsuario = {
        id: nuevoUserId,
        nombre_completo: nombreLimpio,
        telefono: formData.telefono ? formData.telefono.trim() : null,
        email: emailLimpio,
        rol: 'inversionista',
        creado_por: creadorId,
        provincia_id: formData.provincia_id || null,
        capital_disponible: Number(formData.capital_disponible || 0),
        activo: true
      }

      const { data: usuarioCreado, error: dbError } = await supabase
        .from('usuarios')
        .insert([payloadUsuario])
        .select()
        .single()

      if (dbError) throw dbError

      // 5. Registrar el evento en la tabla 'auditoria_actividades'
      const auditPayload = {
        tipo: 'INVERSIONISTA',
        accion: 'CREADO',
        titulo: nombreLimpio,
        subtitulo: 'Alta de perfil en plataforma',
        detalles: [
          formData.telefono ? `Tel: ${formData.telefono.trim()}` : null,
          `Email: ${emailLimpio}`,
          Number(formData.capital_disponible) > 0 
            ? `Capital inicial: $${Number(formData.capital_disponible).toLocaleString('es-AR')}` 
            : null
        ].filter(Boolean).join(' · ') || 'Nuevo inversionista registrado',
        persona: nombreLimpio,
        autor_id: creadorId,
        autor_nombre: autorNombre,
        autor_rol: autorRol,
        estado: 'NUEVO REGISTRO',
        metadata: usuarioCreado || payloadUsuario
      }

      const { error: auditError } = await supabase
        .from('auditoria_actividades')
        .insert([auditPayload])

      if (auditError) console.warn('Aviso al guardar auditoría:', auditError.message)

      // Éxito: Reset y cierre
      setFormData({
        nombre_completo: '',
        telefono: '',
        email: '',
        password: '',
        provincia_id: provincias.length > 0 ? provincias[0].id : '',
        capital_disponible: ''
      })

      if (onSuccess) onSuccess()
      onClose()

    } catch (err) {
      console.error('Error al crear inversionista:', err)
      setErrorMsg(err.message || 'No se pudo crear el perfil.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-xl rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl border border-line">
        
        {/* Cabecera del Modal */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#0d6b63]">
              ALTA DE USUARIO
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1d2939] mt-0.5">
              Nuevo Inversor
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

        {/* Formulario */}
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
                autoComplete="name"
                autoCapitalize="words"
                value={formData.nombre_completo}
                onChange={handleChange}
                placeholder="Ej. Jorge Diaz"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>

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
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/60 border border-line/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0d6b63]">
              <UserCheck className="w-4 h-4" />
              <span>Credenciales para Inicio de Sesión</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Correo Electrónico (Login)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="inversor@correo.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-line bg-white text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contraseña Inicial
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="password"
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-line bg-white text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Provincia asignada
              </label>
              <select
                name="provincia_id"
                required
                value={formData.provincia_id}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63] cursor-pointer"
              >
                {provincias.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Capital Inicial a Invertir ($)
              </label>
              <input
                type="number"
                name="capital_disponible"
                min="0"
                step="any"
                required
                value={formData.capital_disponible}
                onChange={handleChange}
                placeholder="0"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
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
              {loading ? 'Guardando...' : 'Crear Inversionista'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}