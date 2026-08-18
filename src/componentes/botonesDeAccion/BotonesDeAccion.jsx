import React from "react";
import { 
  Users, 
  Briefcase, 
  ShieldPlus, 
  UserPlus, 
  HandCoins, 
  ReceiptText, 
  BadgePercent 
} from "lucide-react";
import FiltroProvincia from "../barraSuperior/FiltroPorProvincia";

export default function BotonesDeAccion({ 
  onOpenModal, 
  onOpenClientes, 
  onOpenInversionistas, 
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
      id: "inversionistas",
      label: "Ver Inversionistas", 
      icon: Briefcase, 
      onClick: onOpenInversionistas, 
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
      id: "inversionista", 
      label: "Agregar inversor", 
      icon: UserPlus, 
      roles: ["owner", "admin"] 
    },
    { 
      id: "cliente", 
      label: "Agregar cliente", 
      icon: Users, 
      roles: ["owner", "admin"] 
    },
    { 
      id: "opcionPrestamo", 
      label: "Agregar opción de préstamo", 
      icon: HandCoins, 
      roles: ["owner", "admin"] 
    },
    { 
      id: "prestamo", 
      label: "Agregar préstamo", 
      icon: BadgePercent, 
      roles: ["owner", "admin"] 
    },
    { 
      id: "pago", 
      label: "Agregar cobro/pago", 
      icon: ReceiptText, 
      roles: ["owner", "admin", "inversionista"] 
    },
  ];

  return (
    <div className="mt-5 w-full space-y-4 select-none">
      
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
      <div className="flex flex-wrap justify-center items-center gap-2.5">
        {VISTAS
          .filter((btn) => btn.roles.includes(rolUsuario))
          .map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.id}
                onClick={btn.onClick}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#0d6b63] border border-[#0d6b63]/20 text-[#fcfcfc] font-bold text-xs hover:bg-[#0b5a52] transition-all shadow-xs cursor-pointer"
              >
                <Icon className="w-4 h-4 text-[#f9f9f9]" />
                <span>{btn.label}</span>
              </button>
            );
          })}
      </div>

      {/* SECCIÓN 2: ALTAS Y MODALES */}
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {ACCIONES
          .filter((btn) => btn.roles.includes(rolUsuario))
          .map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.id}
                onClick={() => onOpenModal && onOpenModal(btn.id)}
                className="flex items-center border border-[#0d6b63]/20 gap-2 bg-[#0d6b63]/10 text-[#0d6b63] px-3.5 py-2.5 rounded-xl shadow-xs hover:bg-[#0d6b63]/20 transition-colors duration-200 font-medium text-xs sm:text-sm cursor-pointer"
              >
                <Icon className="w-4 h-4" />
                <span>{btn.label}</span>
              </button>
            );
          })}
      </div>

    </div>
  );
}