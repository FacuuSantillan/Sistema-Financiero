import { useState } from 'react'
import { abrirWhatsApp, mensajeRecordatorio, normalizarTelefonoAR } from '../../lib/whatsapp'

function IconoWhatsApp({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35M12.05 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.2-3.58.93.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.91.99 6.7 2.78a9.4 9.4 0 0 1 2.77 6.7c0 5.22-4.25 9.46-9.47 9.46m8.06-17.53A11.33 11.33 0 0 0 12.05.63C5.77.63.66 5.74.66 12.02c0 2.01.52 3.97 1.52 5.7L.56 23.63l6.04-1.58a11.37 11.37 0 0 0 5.44 1.39h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.18-5.9-3.33-8.05" />
    </svg>
  )
}

/**
 * Botón verde que abre WhatsApp con el recordatorio de la cuota vencida.
 * datos: { nombre, telefono, numeroCuota, cantidadCuotas, monto, vencimiento, diasAtraso, punitorio }
 */
export default function BotonWhatsApp({ datos, compacto = false }) {
  const [aviso, setAviso] = useState('')
  const telefonoValido = Boolean(normalizarTelefonoAR(datos?.telefono))

  const enviar = async (e) => {
    e.stopPropagation()
    const ok = await abrirWhatsApp(datos.telefono, mensajeRecordatorio(datos))
    if (!ok) {
      setAviso('Teléfono inválido o vacío')
      setTimeout(() => setAviso(''), 3000)
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={enviar}
        title={telefonoValido ? 'Enviar recordatorio por WhatsApp' : 'El cliente no tiene un teléfono válido'}
        className={`flex items-center gap-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
          telefonoValido ? 'bg-[#25D366] text-white hover:bg-[#1ebe5a]' : 'bg-slate-200 text-slate-500'
        } ${compacto ? 'p-2.5 sm:p-2' : 'p-2.5 sm:px-3 sm:py-2'}`}
        aria-label="Enviar recordatorio por WhatsApp"
      >
        <IconoWhatsApp className="w-5 h-5 sm:w-4 sm:h-4" />
        {/* En celular solo el ícono, para dejarle lugar al nombre del cliente */}
        {!compacto && <span className="hidden sm:inline">Recordar</span>}
      </button>
      {aviso && (
        <span className="absolute top-full right-0 mt-1 whitespace-nowrap text-[10px] font-bold bg-red-600 text-white px-2 py-1 rounded-lg z-10">
          {aviso}
        </span>
      )}
    </span>
  )
}
