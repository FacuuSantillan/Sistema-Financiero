import React, { useState } from 'react'
import { User, Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import backgroundImage from '../../assets/background.jpg'

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const emailLimpio = email.trim()

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailLimpio,
        password: password,
      })

      if (authError) {
        console.error('Error Auth Supabase:', authError)
        if (authError.message.includes('Invalid login credentials')) {
          throw new Error('Correo o contraseña incorrectos.')
        } else if (authError.message.includes('Email not confirmed')) {
          throw new Error('El correo electrónico aún no ha sido confirmado.')
        } else {
          throw authError
        }
      }

      const user = authData.user

      const { data: usuarioData, error: userError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (userError) {
        console.warn('Error leyendo tabla usuarios:', userError.message)
      }

      const rolDefectuoso = emailLimpio.includes('admin') ? 'admin' : 'inversionista'
      
      const perfilCompleto = {
        ...user,
        rol: usuarioData?.rol || rolDefectuoso,
        nombre: usuarioData?.nombre_completo || usuarioData?.nombre || user.email
      }

      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(perfilCompleto)
      }
    } catch (err) {
      console.error('Error en login:', err)
      setErrorMsg(err.message || 'Error al conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      
            <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-xl "
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />

      <div className="relative z-10 flex h-full w-full items-center justify-center p-4">
        
        <div className="w-[70%] max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[60%]">
          
          <div className="md:w-1/2 bg-gradient-to-br from-[#148330] to-[#084842] p-8 text-white flex flex-col justify-center relative overflow-hidden shrink-0">
            <div className="relative z-10 space-y-3">
              <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-200">
                SISTEMA PRESTAMISTAS
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold leading-tight">
                Gestión y Control Financiero
              </h2>
            </div>

            <svg
              className="absolute -right-1 bottom-0 top-0 h-full w-20 text-white hidden md:block"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              fill="currentColor"
            >
              <path d="M0 0 C 60 20, 20 80, 100 100 L 100 0 Z" />
            </svg>
          </div>

          {/* PANEL DERECHO */}
          <div className="md:w-1/2 p-6 sm:p-8 bg-white flex flex-col justify-center space-y-4">
            
            <div className="flex flex-col items-center mb-1">
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#148330] to-[#0d6b63] flex items-center justify-center text-white shadow-md">
                <User className="w-7 h-7 stroke-[1.8]" />
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-3.5">
              
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 absolute left-3.5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Correo Electrónico"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100/90 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/30 transition-all"
                />
              </div>

              <div className="relative flex items-center">
                <Lock className="w-4 h-4 absolute left-3.5 text-slate-400" />
                <input
                  type={mostrarPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-100/90 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {mostrarPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#0d6b63] rounded border-slate-300 cursor-pointer"
                  />
                  <span>Recordarme</span>
                </label>

                <button
                  type="button"
                  onClick={() => alert('Por favor contactá al administrador para restablecer tu clave.')}
                  className="hover:text-[#0d6b63] transition-colors cursor-pointer"
                >
                  ¿Olvidaste tu clave?
                </button>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs font-semibold text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#084842] to-[#0d6b63] hover:from-[#05312d] hover:to-[#084842] active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer disabled:opacity-50 mt-2"
              >
                {loading ? 'INGRESANDO...' : 'ENTRAR'}
              </button>

            </form>

          </div>

        </div>

      </div>

    </div>
  )
}