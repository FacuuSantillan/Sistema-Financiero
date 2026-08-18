import React from 'react'
import { 
  X, 
  Clock, 
  ShieldCheck, 
  CreditCard, 
  Receipt, 
  UserCheck, 
  Briefcase, 
  DollarSign, 
  Tag, 
  Phone, 
  Mail, 
  MapPin, 
  FileText,
  Edit3,
  User
} from 'lucide-react'

export default function ModalDetalleActividad({ isOpen, onClose, actividad, formatearFechaHoraExacta }) {
  if (!isOpen || !actividad) return null

  const { 
    tipo = '', 
    accion = '', 
    estado = 'Registrado', 
    titulo = '', 
    subtitulo = '', 
    detalles = '', 
    persona = '', 
    autorNombre = 'Sistema / Owner', 
    autorRol = 'admin', 
    fechaRaw = '', 
    rawItem = {} 
  } = actividad

  const tipoNormalizado = tipo.toUpperCase()
  const esEdicion = accion === 'EDITADO' || estado?.toLowerCase().includes('actualiz')

  // Configuración dinámica de badges e iconos
  let badgeColor = 'bg-slate-100 text-slate-800 border-slate-200'
  let IconoTipo = Tag

  if (tipoNormalizado.includes('PRÉSTAMO')) {
    badgeColor = 'bg-[#0d6b63]/10 text-[#0d6b63] border-[#0d6b63]/20'
    IconoTipo = CreditCard
  } else if (tipoNormalizado.includes('COBRO')) {
    badgeColor = 'bg-blue-100 text-blue-800 border-blue-200'
    IconoTipo = Receipt
  } else if (tipoNormalizado.includes('INVERSIONISTA')) {
    badgeColor = 'bg-purple-100 text-purple-800 border-purple-200'
    IconoTipo = Briefcase
  } else if (tipoNormalizado.includes('CLIENTE')) {
    badgeColor = 'bg-amber-100 text-amber-800 border-amber-200'
    IconoTipo = UserCheck
  } else if (['ADMIN', 'OWNER'].includes(tipoNormalizado)) {
    badgeColor = 'bg-rose-100 text-rose-800 border-rose-200'
    IconoTipo = ShieldCheck
  }

  // Cálculos financieros seguros para préstamos
  const montoCapital = Number(rawItem.monto_capital || rawItem.monto || 0)
  const montoTotalPagar = Number(rawItem.monto_total_pagar || rawItem.monto_total || 0)
  const interesTotal = Math.max(0, montoTotalPagar - montoCapital)
  const cuotas = rawItem.cantidad_cuotas || rawItem.plazo_cuotas || 1
  const valorCuota = Number(rawItem.monto_cuota || 0) || (montoTotalPagar > 0 ? montoTotalPagar / cuotas : 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-2xl rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl border border-line max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Cabecera */}
        <div className="flex items-start justify-between pb-4 border-b border-line shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${badgeColor}`}>
                {esEdicion ? <Edit3 className="w-3.5 h-3.5" /> : <IconoTipo className="w-3.5 h-3.5" />}
                <span>{tipoNormalizado} {esEdicion ? '· MODIFICACIÓN' : ''}</span>
              </span>

              <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md bg-white text-slate-600 border border-line">
                {estado}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1d2939] mt-2">
              {titulo}
            </h2>
            {subtitulo && <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitulo}</p>}
          </div>

          <button
            onClick={onClose}
            type="button"
            className="rounded-xl p-2 text-slate-400 hover:bg-black/5 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo con Información Detallada */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">

          {/* CASO A: PRÉSTAMO */}
          {tipoNormalizado.includes('PRÉSTAMO') && (
            <div className="p-4 rounded-2xl bg-white border border-line space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0d6b63] block">
                Detalle Financiero del Préstamo
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Capital Solicitado</span>
                  <span className="font-bold text-slate-900 text-sm">
                    ${montoCapital.toLocaleString('es-AR')}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Total a Devolver</span>
                  <span className="font-bold text-[#0d6b63] text-sm">
                    ${montoTotalPagar.toLocaleString('es-AR')}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Interés Pactado</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    +${interesTotal.toLocaleString('es-AR')}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Plan de Pago</span>
                  <span className="font-bold text-slate-800">
                    {cuotas} cuotas ({rawItem.frecuencia || 'mensual'})
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Valor Cuota</span>
                  <span className="font-bold text-slate-800">
                    ${valorCuota.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Fecha de Inicio</span>
                  <span className="font-bold text-slate-800">
                    {rawItem.fecha_inicio || 'Sin fecha'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* CASO B: COBRO */}
          {tipoNormalizado.includes('COBRO') && (
            <div className="p-4 rounded-2xl bg-white border border-line space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0d6b63] block">
                Detalle del Cobro / Pago
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Monto Cobrado</span>
                  <span className="font-bold text-blue-800 text-base">
                    ${Number(rawItem.monto_cobrado || rawItem.monto_pago || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Método de Pago</span>
                  <span className="font-bold text-slate-800 capitalize">
                    {rawItem.metodo_pago || 'Efectivo'}
                  </span>
                </div>
              </div>

              {rawItem.observaciones && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <span className="text-slate-400 block text-[10px] mb-0.5">Observaciones / Comprobante:</span>
                  <p className="font-medium text-slate-700">{rawItem.observaciones}</p>
                </div>
              )}
            </div>
          )}

          {/* CASO C: INVERSIONISTA, CLIENTE O ADMINISTRADOR (Creación o Edición) */}
          {(tipoNormalizado.includes('INVERSIONISTA') || tipoNormalizado.includes('CLIENTE') || ['ADMIN', 'OWNER'].includes(tipoNormalizado)) && (
            <div className="p-4 rounded-2xl bg-white border border-line space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0d6b63] block">
                {esEdicion ? 'Datos Actualizados del Perfil' : 'Ficha del Perfil Registrado'}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {(rawItem.nombre_completo || rawItem.nombre || persona) && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <User className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-slate-400 block text-[10px]">Nombre Completo</span>
                      <span className="font-bold text-slate-800">{rawItem.nombre_completo || rawItem.nombre || persona}</span>
                    </div>
                  </div>
                )}

                {rawItem.email && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-slate-400 block text-[10px]">Correo Electrónico</span>
                      <span className="font-bold text-slate-800">{rawItem.email}</span>
                    </div>
                  </div>
                )}

                {rawItem.telefono && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-slate-400 block text-[10px]">Teléfono de Contacto</span>
                      <span className="font-bold text-slate-800">{rawItem.telefono}</span>
                    </div>
                  </div>
                )}

                {(rawItem.dni || rawItem.dni_cuit) && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-slate-400 block text-[10px]">DNI / CUIT</span>
                      <span className="font-bold text-slate-800">{rawItem.dni || rawItem.dni_cuit}</span>
                    </div>
                  </div>
                )}

                {rawItem.direccion && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-slate-400 block text-[10px]">Dirección / Domicilio</span>
                      <span className="font-bold text-slate-800">{rawItem.direccion}</span>
                    </div>
                  </div>
                )}

                {tipoNormalizado.includes('INVERSIONISTA') && Number(rawItem.capital_disponible) >= 0 && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 col-span-1 sm:col-span-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <div>
                      <span className="text-emerald-600 block text-[10px] font-bold">Capital Disponible Aportado</span>
                      <span className="font-bold text-emerald-800 text-sm">
                        ${Number(rawItem.capital_disponible).toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {detalles && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <span className="text-slate-400 block text-[10px] mb-0.5">Resumen de Cambios / Datos:</span>
                  <p className="font-semibold text-slate-700">{detalles}</p>
                </div>
              )}
            </div>
          )}

          {/* 🔍 TABLA COMPARATIVA: ANTES VS DESPUÉS */}
          {rawItem.cambios_realizados && Array.isArray(rawItem.cambios_realizados) && rawItem.cambios_realizados.length > 0 && (
            <div className="p-4 rounded-2xl bg-white border border-line space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0d6b63] block">
                Historial de Parámetros Modificados ({rawItem.cambios_realizados.length})
              </span>
              
              <div className="space-y-2">
                {rawItem.cambios_realizados.map((cambio, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                    <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1">
                      {cambio.campo}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-red-50 text-red-700 font-semibold px-2.5 py-1 rounded-lg border border-red-200 line-through">
                        {cambio.anterior}
                      </span>
                      <span className="text-slate-400 font-bold">➔</span>
                      <span className="bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded-lg border border-emerald-200">
                        {cambio.nuevo}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bloque: Auditoría y Trazabilidad */}
          <div className="p-4 rounded-2xl bg-white border border-line space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Auditoría y Trazabilidad del Sistema
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#0d6b63] shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[10px]">Ejecutado por</span>
                  <span className="font-bold text-slate-900 capitalize">
                    {autorRol}: {autorNombre}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-[#0d6b63] shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[10px]">Fecha y Hora Exacta</span>
                  <span className="font-bold text-slate-900">
                    {formatearFechaHoraExacta ? formatearFechaHoraExacta(fechaRaw) : fechaRaw}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Pie del Modal */}
        <div className="pt-3 border-t border-line flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-[#0d6b63] text-white font-bold text-sm shadow-xs hover:bg-[#0b5a52] transition-colors cursor-pointer"
          >
            Cerrar Ficha
          </button>
        </div>

      </div>
    </div>
  )
}