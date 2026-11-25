// Campos compartidos por el alta/edición de clientes y garantes.

export const TIPOS_DOCUMENTO = ['DNI', 'CUIT', 'CUIL', 'SIN DOCUMENTO']

export const CONDICIONES_FISCALES = [
  'Consumidor Final',
  'Monotributista',
  'Responsable Inscripto',
  'Exento',
  'No Responsable'
]

export const personaVacia = () => ({
  nombre_completo: '',
  tipo_documento: 'DNI',
  dni: '',
  condicion_fiscal: '',
  email: '',
  telefono: '',
  direccion: '',
  localidad: '',
  provincia_id: '',
  ocupacion: ''
})

/** Carga un registro existente (cliente o garante) en el formulario. */
export const personaDesdeRegistro = (r = {}) => ({
  nombre_completo: r.nombre_completo || '',
  tipo_documento: r.tipo_documento || (r.dni ? 'DNI' : 'SIN DOCUMENTO'),
  dni: r.dni || '',
  condicion_fiscal: r.condicion_fiscal || '',
  email: r.email || '',
  telefono: r.telefono || '',
  direccion: r.direccion || '',
  localidad: r.localidad || '',
  provincia_id: r.provincia_id || '',
  ocupacion: r.ocupacion || ''
})

const limpio = (v) => (typeof v === 'string' ? v.trim() : v) || null

/** Valida y arma el objeto para guardar en la base. Lanza Error si algo falta. */
export function payloadPersona(f) {
  const nombre = (f.nombre_completo || '').trim()
  if (!nombre) throw new Error('El nombre completo es obligatorio.')

  const sinDocumento = f.tipo_documento === 'SIN DOCUMENTO'
  const documento = sinDocumento ? null : limpio(f.dni)
  if (!sinDocumento && documento) {
    const digitos = documento.replace(/\D/g, '')
    if (f.tipo_documento === 'DNI' && (digitos.length < 7 || digitos.length > 8)) {
      throw new Error('El DNI debe tener 7 u 8 números.')
    }
    if ((f.tipo_documento === 'CUIT' || f.tipo_documento === 'CUIL') && digitos.length !== 11) {
      throw new Error(`El ${f.tipo_documento} debe tener 11 números.`)
    }
  }

  const email = limpio(f.email)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('El email no es válido.')
  }

  return {
    nombre_completo: nombre,
    tipo_documento: f.tipo_documento || 'DNI',
    dni: documento,
    condicion_fiscal: limpio(f.condicion_fiscal),
    email,
    telefono: limpio(f.telefono),
    direccion: limpio(f.direccion),
    localidad: limpio(f.localidad),
    provincia_id: f.provincia_id || null,
    ocupacion: limpio(f.ocupacion)
  }
}

const capitalizar = (t) => (t ? t.toLowerCase().replace(/(?:^|\s|-)\S/g, (c) => c.toUpperCase()) : '')

const claseInput =
  'w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63] disabled:bg-slate-100 disabled:text-slate-400'
const claseLabel = 'block text-xs font-bold text-slate-700 mb-1'

export default function CamposPersona({ formData, setFormData, provincias = [] }) {
  const handleChange = (e) => {
    const { name, value } = e.target
    const valor = ['nombre_completo', 'localidad', 'ocupacion'].includes(name) ? capitalizar(value) : value
    setFormData((prev) => ({
      ...prev,
      [name]: valor,
      ...(name === 'tipo_documento' && value === 'SIN DOCUMENTO' ? { dni: '' } : {})
    }))
  }

  const sinDocumento = formData.tipo_documento === 'SIN DOCUMENTO'

  return (
    <div className="space-y-3">
      <div>
        <label className={claseLabel}>Nombre completo *</label>
        <input
          type="text"
          name="nombre_completo"
          required
          autoComplete="name"
          value={formData.nombre_completo}
          onChange={handleChange}
          placeholder="Ej. María González"
          className={claseInput}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-3">
        <div>
          <label className={claseLabel}>Documento</label>
          <select name="tipo_documento" value={formData.tipo_documento} onChange={handleChange} className={`${claseInput} cursor-pointer`}>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t} value={t}>{t === 'SIN DOCUMENTO' ? 'Sin documento' : t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={claseLabel}>Número {sinDocumento ? '' : '(opcional)'}</label>
          <input
            type="text"
            inputMode="numeric"
            name="dni"
            disabled={sinDocumento}
            value={formData.dni}
            onChange={handleChange}
            placeholder={sinDocumento ? 'Sin documento' : formData.tipo_documento === 'DNI' ? 'Ej. 30123456' : 'Ej. 20-30123456-7'}
            className={claseInput}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={claseLabel}>Condición fiscal</label>
          <select name="condicion_fiscal" value={formData.condicion_fiscal} onChange={handleChange} className={`${claseInput} cursor-pointer`}>
            <option value="">-- Sin especificar --</option>
            {CONDICIONES_FISCALES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={claseLabel}>Ocupación</label>
          <input type="text" name="ocupacion" value={formData.ocupacion} onChange={handleChange} placeholder="Ej. Comerciante" className={claseInput} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={claseLabel}>Teléfono (WhatsApp)</label>
          <input type="tel" name="telefono" value={formData.telefono} onChange={handleChange} placeholder="Ej. 381 4987654" className={claseInput} />
        </div>
        <div>
          <label className={claseLabel}>Email</label>
          <input type="email" name="email" autoComplete="email" value={formData.email} onChange={handleChange} placeholder="ejemplo@correo.com" className={claseInput} />
        </div>
      </div>

      <div>
        <label className={claseLabel}>Domicilio</label>
        <input type="text" name="direccion" autoComplete="street-address" value={formData.direccion} onChange={handleChange} placeholder="Calle, número, piso/depto" className={claseInput} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={claseLabel}>Localidad</label>
          <input type="text" name="localidad" value={formData.localidad} onChange={handleChange} placeholder="Ej. San Miguel de Tucumán" className={claseInput} />
        </div>
        <div>
          <label className={claseLabel}>Provincia</label>
          <select name="provincia_id" value={formData.provincia_id} onChange={handleChange} className={`${claseInput} cursor-pointer`}>
            <option value="">-- Sin especificar --</option>
            {provincias.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
