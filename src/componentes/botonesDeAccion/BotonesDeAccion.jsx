import React from "react";
import {
  Users,
  ShieldPlus,
  HandCoins,
  ReceiptText,
  BadgePercent,
  CalendarClock
} from "lucide-react";
import FiltroProvincia from "../barraSuperior/filtroPorProvincia";


export default function BotonesDeAccion({
  onOpenModal,
  onOpenClientes,
  onOpenCobranzas,
  provinciaSeleccionada,
  setProvinciaSeleccionada,
  provincias = [],
  rolUsuario = "admin"
}) {

  const VISTAS = [
    {
      id: "clientes",
      label: "Ver Clientes",
      icon: Users,
      onClick: onOpenClientes,
      roles: ["owner", "admin", "inversionista"]
    },
    {
      id: "cobranzas",
      label: "Cuotas y vencimientos",
      icon: CalendarClock,
      onClick: onOpenCobranzas,
      roles: ["owner", "admin"]
    },
  ];

  // 2. CONFIGURACIÓN DE ALTAS Y MODALES
  const ACCIONES = [
    {
      id: "admin",
      label: "Agregar admin",
      icon: ShieldPlus,
      roles: ["owner"]
    },
    {
      id: "cliente", 
      label: "Crear cliente", 
      icon: Users, 
      roles: ["owner", "admin"] 
    },
    { 
      id: "opcionPrestamo", 
      label: "Crear tipos de préstamo", 
      icon: HandCoins, 
      roles: ["owner", "admin"] 
    },
    { 
      id: "prestamo", 
      label: "Crear préstamo", 
      icon: BadgePercent, 
      roles: ["owner", "admin"] 
    },
    { 
      id: "pago", 
      label: "Cobro/Pago", 
      icon: ReceiptText, 
      roles: ["owner", "admin", "inversionista"] 
    },
  ];

  return (
    <div className="mt-5 w-full px-4 sm:px-0 space-y-3 sm:space-y-4 select-none">
      
      {provincias.length > 0 && (
        <div className="flex justify-center mb-2">
          <FiltroProvincia
            provinciaSeleccionada={provinciaSeleccionada}
            setProvinciaSeleccionada={setProvinciaSeleccionada}
            provincias={provincias}
          />
        </div>
      )}

      {/* SECCIÓN 1: VISTAS Y NAVEGACIÓN */}
      {/* En celular: grilla de 2 columnas con botones grandes. En PC: fila centrada. */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:items-center sm:gap-2.5">
        {VISTAS
          .filter((btn) => btn.roles.includes(rolUsuario))
          .map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.id}
                onClick={btn.onClick}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-3.5 sm:py-2.5 rounded-2xl bg-[#0d6b63] border border-[#0d6b63]/20 text-[#fcfcfc] font-bold text-sm sm:text-xs hover:bg-[#0b5a52] active:scale-[0.98] transition-all shadow-xs cursor-pointer"
              >
                <Icon className="w-5 h-5 sm:w-4 sm:h-4 shrink-0 text-[#f9f9f9]" />
                <span className="leading-tight">{btn.label}</span>
              </button>
            );
          })}
      </div>

      {/* SECCIÓN 2: ALTAS Y MODALES */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-2.5">
        {ACCIONES
          .filter((btn) => btn.roles.includes(rolUsuario))
          .map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.id}
                onClick={() => onOpenModal && onOpenModal(btn.id)}
                className="flex flex-col sm:flex-row items-center justify-center text-center gap-1.5 sm:gap-2 border border-[#0d6b63]/20 bg-white sm:bg-[#0d6b63]/10 text-[#0d6b63] px-2 sm:px-3.5 py-3 sm:py-2.5 min-h-[72px] sm:min-h-0 rounded-2xl sm:rounded-xl shadow-xs hover:bg-[#0d6b63]/20 active:scale-[0.98] transition-all duration-200 font-semibold sm:font-medium text-xs sm:text-sm cursor-pointer"
              >
                <Icon className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
                <span className="leading-tight">{btn.label}</span>
              </button>
            );
          })}
      </div>

    </div>
  );
}