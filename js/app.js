/* Orquestación de la app. */
import { FAMILIAS, MESES, resolverFamilia } from "./config.js";
import { descargarPlantillaExcel, leerExcel } from "./excel.js";
import { renderPdf } from "./pdf_render.js";

const $ = (sel) => document.querySelector(sel);

const els = {
  drop: $("#dropzone"),
  input: $("#fileInput"),
  plantillaBtn: $("#btnPlantilla"),
  generarBtn: $("#btnGenerar"),
  resumen: $("#resumen"),
  tabla: $("#tabla"),
  log: $("#log"),
};

let filas = [];

/* Escapa texto para insertarlo de forma segura en HTML. */
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function log(msg, tipo = "") {
  const p = document.createElement("div");
  p.className = "log-linea " + tipo;
  p.textContent = msg;
  els.log.appendChild(p);
  els.log.scrollTop = els.log.scrollHeight;
}

/* Fecha -> {dia, mes, ano}. Acepta Date, "dd/mm/aaaa", "aaaa-mm-dd" o vacío.
 * Si el "mes" sale > 12 (formato m/d), intercambia día y mes. */
function partesFecha(valor) {
  let d;
  if (valor instanceof Date && !isNaN(valor)) {
    d = valor;
  } else if (typeof valor === "string" && valor.trim()) {
    const s = valor.trim();
    let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
    if (m) {
      let dia = +m[1], mes = +m[2];
      if (mes > 12 && dia <= 12) { [dia, mes] = [mes, dia]; }
      d = new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], mes - 1, dia);
    } else {
      m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
      if (m) d = new Date(+m[1], +m[2] - 1, +m[3]);
    }
  }
  if (!d || isNaN(d)) d = new Date();
  const mes = MESES[d.getMonth()] || MESES[new Date().getMonth()];
  return { dia: String(d.getDate()), mes, ano: String(d.getFullYear()) };
}

/* Construye el objeto de datos para una carta. */
function construirDatos(fila, tipo) {
  const f = partesFecha(fila.fecha);
  const base = {
    ...f,
    destinatario: fila.destinatario || "",
    usuario: fila.usuario || "",
    delitos: fila.delitos || "",
    tipo_proceso: fila.tipo_proceso || "",
    demandado: fila.demandado || "",
    id_identificador: fila.id_identificador || "",
    id_consultorio: fila.id_consultorio || "",
    estudiante_anterior: fila.estudiante_anterior || "",
    estudiante_nuevo: fila.estudiante_nuevo || "",
    cc_nuevo: fila.cc_nuevo || "",
  };
  if (tipo === "idoneidad") {
    // La idoneidad se emite a nombre del estudiante nuevo.
    base.estudiante = fila.estudiante_nuevo || "";
    base.cedula = fila.cc_nuevo || "";
  }
  return base;
}

/* Limpia un texto para usarlo en nombres de carpeta/archivo. */
function limpiarNombre(s, permitirGuion = false) {
  const re = permitirGuion ? /[^\wáéíóúñ -]/gi : /[^\wáéíóúñ ]/gi;
  return String(s ?? "").replace(re, "").trim().replace(/\s+/g, "_");
}

/* Nombre de la carpeta del caso: "<radicado>_<estudiante nuevo>". */
function nombreCaso(fila) {
  const rad = limpiarNombre(fila.id_consultorio || fila.id_identificador, true);
  const est = limpiarNombre(fila.estudiante_nuevo);
  const partes = [rad, est].filter(Boolean);
  return partes.length ? partes.join("_") : "caso";
}

/* Nombre del documento dentro de la carpeta del caso. */
const NOMBRE_DOC = { idoneidad: "Idoneidad.pdf", reasignacion: "Reasignacion.pdf" };

/* Valida una fila contra los requeridos de su familia. Devuelve {familia, faltantes[]}. */
function validarFila(fila) {
  const familia = resolverFamilia(fila.tema);
  if (!familia) return { familia: null, faltantes: ["tema no reconocido"] };
  const cfg = FAMILIAS[familia];
  const req = new Set([...cfg.idoneidad.requeridos, ...cfg.reasignacion.requeridos]);
  const faltantes = [...req].filter((c) => !String(fila[c] ?? "").trim());
  return { familia, faltantes };
}

function pintarTabla() {
  if (!filas.length) {
    els.tabla.innerHTML = "";
    els.resumen.textContent = "";
    els.generarBtn.disabled = true;
    return;
  }
  let okCount = 0;
  const rows = filas.map((fila, i) => {
    const { familia, faltantes } = validarFila(fila);
    const ok = familia && faltantes.length === 0;
    if (ok) okCount++;
    const estado = !familia
      ? `<span class="bad">tema inválido</span>`
      : faltantes.length
        ? `<span class="warn">faltan: ${esc(faltantes.join(", "))}</span>`
        : `<span class="ok">lista</span>`;
    return `<tr>
      <td>${i + 1}</td>
      <td>${esc(fila.tema)}</td>
      <td>${esc(fila.estudiante_nuevo)}</td>
      <td>${esc(fila.usuario)}</td>
      <td>${esc(fila.id_consultorio)}</td>
      <td>${estado}</td>
    </tr>`;
  }).join("");

  els.tabla.innerHTML = `<table>
    <thead><tr><th>#</th><th>Tema</th><th>Estudiante nuevo</th><th>Usuario</th><th>Rad. interno</th><th>Estado</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
  els.resumen.textContent = `${filas.length} fila(s) · ${okCount} lista(s) · ${filas.length - okCount} con avisos`;
  els.generarBtn.disabled = filas.length === 0;
}

async function cargarArchivo(file) {
  els.log.innerHTML = "";
  try {
    filas = await leerExcel(file);
    log(`Excel leído: ${filas.length} fila(s).`, "ok");
    pintarTabla();
  } catch (e) {
    log("Error leyendo el Excel: " + e.message, "bad");
  }
}

async function generar() {
  els.generarBtn.disabled = true;
  els.log.innerHTML = "";
  const zip = new window.JSZip();
  const carpetas = new Set();
  let generadas = 0, saltadas = 0;

  // Carpeta única por caso (evita que dos filas del mismo caso se pisen).
  const carpetaUnica = (fila) => {
    const base = nombreCaso(fila);
    let nombre = base, n = 2;
    while (carpetas.has(nombre)) nombre = `${base}_${n++}`;
    carpetas.add(nombre);
    return nombre;
  };

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const { familia } = validarFila(fila);
    if (!familia) {
      log(`Fila ${i + 1}: tema "${fila.tema}" no reconocido — omitida.`, "bad");
      saltadas++;
      continue;
    }
    const cfg = FAMILIAS[familia];
    try {
      const carpeta = carpetaUnica(fila);
      for (const tipo of ["idoneidad", "reasignacion"]) {
        const blob = await renderPdf(cfg[tipo].plantilla, construirDatos(fila, tipo));
        zip.file(`${carpeta}/${NOMBRE_DOC[tipo]}`, blob);
        generadas++;
      }
      log(`Fila ${i + 1} (${familia}): carpeta "${carpeta}" con idoneidad + reasignación.`, "ok");
    } catch (e) {
      log(`Fila ${i + 1}: error generando — ${e.message}`, "bad");
      saltadas++;
    }
  }

  if (generadas === 0) {
    log("No se generó ningún documento.", "bad");
    els.generarBtn.disabled = false;
    return;
  }
  const contenido = await zip.generateAsync({ type: "blob" });
  const fecha = new Date().toISOString().slice(0, 10);
  window.saveAs(contenido, `cartas_consultorio_${fecha}.zip`);
  log(`Listo: ${generadas} documento(s) en el ZIP${saltadas ? `, ${saltadas} omitido(s)` : ""}.`, "ok");
  els.generarBtn.disabled = false;
}

/* --- Eventos --- */
els.plantillaBtn.addEventListener("click", descargarPlantillaExcel);
els.generarBtn.addEventListener("click", generar);
els.input.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (f) cargarArchivo(f);
  e.target.value = ""; // permite volver a elegir el mismo archivo
});
els.drop.addEventListener("click", () => els.input.click());
["dragover", "dragenter"].forEach((ev) =>
  els.drop.addEventListener(ev, (e) => { e.preventDefault(); els.drop.classList.add("hover"); }));
["dragleave", "drop"].forEach((ev) =>
  els.drop.addEventListener(ev, (e) => { e.preventDefault(); els.drop.classList.remove("hover"); }));
els.drop.addEventListener("drop", (e) => {
  const f = e.dataTransfer.files[0];
  if (f) cargarArchivo(f);
});

/* Registro del service worker (PWA / offline). */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
