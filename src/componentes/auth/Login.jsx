import React, { useState } from 'react'
import { Lock, Mail, Eye, EyeOff, AlertCircle, ShieldCheck, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import backgroundImage from '../../assets/background.jpg'

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim()
      })

      if (error) throw error

      if (onLoginSuccess) {
        onLoginSuccess(data.user)
      }
    } catch (err) {
      console.error('Error de autenticación:', err)
      setErrorMsg(err.message || 'Credenciales inválidas. Verificá tu correo y contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="min-h-screen w-full flex flex-col justify-center items-center p-6 relative overflow-hidden select-none bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      {/* Capa de oscurecimiento suave para fondo elegante */}
      <div className="absolute inset-0 bg-[#061e1b]/80 backdrop-blur-[1px] z-0" />

      {/* Contenedor central unificado */}
      <div className="w-full max-w-md flex flex-col items-center z-10 space-y-6">
        
        {/* Cabecera / Identidad de Marca */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#0d6b63] text-white shadow-xl shadow-black/20 border border-white/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-4xl sm:text-5xl font-serif font-bold text-white tracking-tight drop-shadow-sm">
              Valora
            </h1>
            <p className="text-[10px] sm:text-xs font-semibold text-emerald-300/85 tracking-[0.28em] uppercase font-sans">
              Sistema Financiero
            </p>
          </div>
        </div>

        {/* Tarjeta de Formulario */}
        <div className="w-full bg-white/95 backdrop-blur-xl rounded-3xl p-7 sm:p-8 shadow-2xl shadow-black/40 border border-white/40">
          <div className="mb-6">
            <h2 className="text-xl font-serif font-bold text-slate-900">Iniciar Sesión</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Ingresá tus credenciales para acceder al panel
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Campo Correo */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold tracking-wider uppercase text-slate-600">
                Correo Electrónico
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 absolute left-4 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@empresa.com"
                  className="w-full pl-11 pr-4 py-3 bg-[#FAF8F5] rounded-2xl border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63] transition-all"
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold tracking-wider uppercase text-slate-600">
                Contraseña
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 absolute left-4 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-11 pr-11 py-3 bg-[#FAF8F5] rounded-2xl border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Opciones */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 text-slate-600 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded-md border-slate-300 text-[#0d6b63] focus:ring-[#0d6b63]/30 cursor-pointer accent-[#0d6b63]"
                />
                <span>Recordarme</span>
              </label>
              <button
                type="button"
                className="text-[#0d6b63] font-semibold hover:underline cursor-pointer"
              >
                ¿Olvidaste tu clave?
              </button>
            </div>

            {/* Error */}
            {errorMsg && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Botón Ingresar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-6 rounded-2xl bg-[#0d6b63] hover:bg-[#0b5a52] text-white font-bold text-xs sm:text-sm tracking-wider uppercase shadow-lg shadow-[#0d6b63]/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Ingresar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer integrado */}
        <p className="text-[11px] font-medium text-emerald-100/70 text-center">
          Plataforma de Control Financiero © {new Date().getFullYear()}. Todos los derechos reservados.
        </p>

      </div>
    </div>
  )
}
