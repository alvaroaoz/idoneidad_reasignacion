/* Configuración de especialidades, campos y plantillas.
 * Para añadir/ajustar una especialidad o un modelo, edita SOLO este archivo
 * y, si hace falta, el .docx correspondiente en templates/. */

export const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/* Cada "tema" del Excel se mapea a una familia de plantillas.
 * civil, familia y laboral comparten el mismo modelo. */
export const TEMA_A_FAMILIA = {
  civil: "civil",
  familia: "civil",
  laboral: "civil",
  penal: "penal",
  administrativo: "admin",
  admin: "admin",
};

/* Opciones válidas que aparecen como lista desplegable en la columna "tema"
 * de la plantilla Excel (el usuario solo puede elegir, no escribir libre). */
export const TEMAS_OPCIONES = ["civil", "familia", "laboral", "penal", "administrativo"];

/* Columnas del Excel (orden = orden en la plantilla descargable). */
export const COLUMNAS = [
  "tema",
  "fecha",
  "destinatario",
  "usuario",
  "estudiante_anterior",
  "estudiante_nuevo",
  "cc_nuevo",
  "delitos",
  "tipo_proceso",
  "demandado",
  "id_identificador",
  "id_consultorio",
];

export const COLUMNA_AYUDA = {
  tema: "civil, familia, laboral, penal o administrativo",
  fecha: "opcional (dd/mm/aaaa). Si se deja vacío usa la fecha de hoy",
  destinatario: "a quién se dirige la carta (juzgado, fiscalía, entidad...)",
  usuario: "nombre del usuario/víctima representado",
  estudiante_anterior: "estudiante que deja el caso (para la reasignación)",
  estudiante_nuevo: "estudiante que recibe el caso (va en idoneidad y reasignación)",
  cc_nuevo: "cédula del estudiante nuevo",
  delitos: "solo penal: delitos",
  tipo_proceso: "civil/familia/laboral y administrativo: tipo de proceso",
  demandado: "civil/familia/laboral: contra quién (demandado)",
  id_identificador: "radicado del juzgado / número SPOA / No. de proceso",
  id_consultorio: "radicado interno del consultorio",
};

/* Plantillas por familia y campos REQUERIDOS para cada documento.
 * (estudiante/cedula de la idoneidad se toman del estudiante_nuevo.) */
export const FAMILIAS = {
  penal: {
    etiqueta: "Penal",
    idoneidad: {
      plantilla: "penal_idoneidad",
      requeridos: ["destinatario", "estudiante_nuevo", "cc_nuevo", "usuario", "delitos", "id_identificador", "id_consultorio"],
    },
    reasignacion: {
      plantilla: "penal_reasignacion",
      requeridos: ["destinatario", "estudiante_anterior", "estudiante_nuevo", "cc_nuevo", "usuario", "delitos", "id_identificador", "id_consultorio"],
    },
  },
  civil: {
    etiqueta: "Civil / Familia / Laboral",
    idoneidad: {
      plantilla: "civil_idoneidad",
      requeridos: ["destinatario", "estudiante_nuevo", "cc_nuevo", "usuario", "tipo_proceso", "demandado", "id_consultorio"],
    },
    reasignacion: {
      plantilla: "civil_reasignacion",
      requeridos: ["destinatario", "estudiante_anterior", "estudiante_nuevo", "cc_nuevo", "usuario", "tipo_proceso", "demandado", "id_identificador", "id_consultorio"],
    },
  },
  admin: {
    etiqueta: "Administrativo",
    idoneidad: {
      plantilla: "admin_idoneidad",
      requeridos: ["destinatario", "estudiante_nuevo", "cc_nuevo", "usuario", "id_identificador", "id_consultorio"],
    },
    reasignacion: {
      plantilla: "admin_reasignacion",
      requeridos: ["destinatario", "estudiante_anterior", "estudiante_nuevo", "cc_nuevo", "usuario", "tipo_proceso", "id_identificador", "id_consultorio"],
    },
  },
};

/* Ejemplos para la plantilla Excel descargable (uno por tema). */
export const EJEMPLOS = [
  {
    tema: "penal", fecha: "", destinatario: "FISCALÍA GENERAL DE LA NACIÓN",
    usuario: "Juan Pérez Gómez", estudiante_anterior: "María López",
    estudiante_nuevo: "Carlos Ramírez", cc_nuevo: "1.234.567.890",
    delitos: "hurto calificado", tipo_proceso: "", demandado: "",
    id_identificador: "1100160000123202400001", id_consultorio: "CJ-2024-001",
  },
  {
    tema: "civil", fecha: "", destinatario: "JUZGADO 5 CIVIL MUNICIPAL DE MEDELLÍN",
    usuario: "Ana Torres", estudiante_anterior: "Diego Ruiz",
    estudiante_nuevo: "Laura Gómez", cc_nuevo: "1.020.304.050",
    delitos: "", tipo_proceso: "proceso ejecutivo singular", demandado: "Pedro Salazar",
    id_identificador: "05001310300520240010", id_consultorio: "CJ-2024-002",
  },
  {
    tema: "administrativo", fecha: "", destinatario: "CONTRALORÍA GENERAL DE ANTIOQUIA",
    usuario: "Sociedad XYZ S.A.S.", estudiante_anterior: "Felipe Cano",
    estudiante_nuevo: "Sofía Mejía", cc_nuevo: "43.210.987",
    delitos: "", tipo_proceso: "proceso de responsabilidad fiscal", demandado: "",
    id_identificador: "PRF-2024-0099", id_consultorio: "CJ-2024-003",
  },
];

export function resolverFamilia(tema) {
  if (!tema) return null;
  const key = String(tema).trim().toLowerCase();
  return TEMA_A_FAMILIA[key] || null;
}
