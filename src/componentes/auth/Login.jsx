import React, { useState } from 'react'
import { User, Lock, Mail, Eye, EyeOff, AlertCircle, ShieldCheck, ArrowRight } from 'lucide-react'
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
      className="min-h-screen w-full flex flex-col justify-between items-center p-6 relative overflow-hidden select-none bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      {/* Capa de oscurecimiento / gradiente sobre la foto para contraste */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b3b36]/85 via-[#082824]/90 to-[#041412]/95 backdrop-blur-[2px] z-0" />

      {/* Luces sutiles de acento */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#148b81]/20 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#0d6b63]/25 rounded-full blur-3xl pointer-events-none z-0" />

      {/* Cabecera / Identidad */}
      <header className="w-full max-w-md pt-4 sm:pt-12 text-center z-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0d6b63] text-white shadow-xl shadow-black/30 border border-white/15 mb-4">
          <ShieldCheck className="w-7 h-7" />
        </div>
      
        <h1 className="text-3xl sm:text-3xl font-serif font-bold text-white tracking-tight mt-1">
          SISTEMA FINANCIERO
        </h1>
      </header>

      {/* Tarjeta de Formulario Glassmorphism */}
      <main className="w-full max-w-md my-auto py-6 z-10">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-7 sm:p-9 shadow-2xl shadow-black/40 border border-white/40">
          
          <div className="mb-6">
            <h2 className="text-xl font-serif font-bold text-slate-900">Iniciar Sesión</h2>
           
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Input Correo */}
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

            {/* Input Contraseña */}
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
                  className="absolute right-3.5 p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Opciones adicionales */}
            <div className="flex items-center justify-between text-xs pt-1">
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

            {/* Alerta de Error */}
            {errorMsg && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Botón de Entrada */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-6 rounded-2xl bg-[#0d6b63] hover:bg-[#0b5a52] text-white font-bold text-sm tracking-wider uppercase shadow-lg shadow-[#0d6b63]/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
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
      </main>

      {/* Pie de página */}
      <footer className="w-full text-center py-4 z-10">
        <p className="text-[11px] font-medium text-emerald-100/70">
          Plataforma de Control Financiero © 2026. Todos los derechos reservados.
        </p>
      </footer>

    </div>
  )
}