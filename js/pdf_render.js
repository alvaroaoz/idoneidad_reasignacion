/* Generación de .pdf en el navegador con pdf-lib (sin servidor).
 * Reemplaza al antiguo flujo con docxtemplater: en vez de rellenar un .docx,
 * dibujamos directamente la carta (membrete + texto + firma) sobre una
 * página tamaño carta.
 *   window.PDFLib  */
import { BOILERPLATE, CUERPOS } from "./cartas_contenido.js";

const PAGE_W = 612; // carta, 8.5in
const PAGE_H = 792; // carta, 11in
const MARGIN_L = 85;
const MARGIN_R = 85;
const FONT_SIZE = 11;
const LINE_HEIGHT = 14;

let assetsCache = null;

async function cargarAsset(ruta) {
  const resp = await fetch(ruta);
  if (!resp.ok) throw new Error("No se pudo cargar: " + ruta);
  return resp.arrayBuffer();
}

async function cargarAssets() {
  if (assetsCache) return assetsCache;
  const [membrete, firma] = await Promise.all([
    cargarAsset("./assets/membrete.png"),
    cargarAsset("./assets/firma.jpg"),
  ]);
  assetsCache = { membrete, firma };
  return assetsCache;
}

/* Sustituye {{clave}} por datos[clave] (string vacío si falta). */
function sustituir(texto, datos) {
  return texto.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, clave) =>
    datos[clave] != null ? String(datos[clave]) : "");
}

/* Parte un texto en palabras (con sus espacios) para armar líneas. */
function palabras(texto) {
  return texto.split(/(\s+)/).filter((w) => w !== "");
}

/* Envuelve un párrafo en líneas que caben en maxWidth, y las dibuja
 * justificadas (excepto la última línea de cada párrafo). Devuelve el
 * nuevo y (más abajo = menor y). */
function dibujarParrafo(page, font, texto, { x, y, maxWidth, fontSize, lineHeight }) {
  const tokens = palabras(texto);
  const lineas = [];
  let actual = [];
  let anchoActual = 0;
  const anchoEspacio = font.widthOfTextAtSize(" ", fontSize);

  for (const tok of tokens) {
    if (/^\s+$/.test(tok)) continue; // los espacios se reconstruyen al justificar
    const ancho = font.widthOfTextAtSize(tok, fontSize);
    const anchoConEspacio = actual.length ? anchoActual + anchoEspacio + ancho : ancho;
    if (anchoConEspacio > maxWidth && actual.length) {
      lineas.push(actual);
      actual = [tok];
      anchoActual = ancho;
    } else {
      actual.push(tok);
      anchoActual = anchoConEspacio;
    }
  }
  if (actual.length) lineas.push(actual);

  lineas.forEach((linea, i) => {
    const esUltima = i === lineas.length - 1;
    const anchoPalabras = linea.reduce((a, w) => a + font.widthOfTextAtSize(w, fontSize), 0);
    if (!esUltima && linea.length > 1) {
      const espacioExtra = (maxWidth - anchoPalabras) / (linea.length - 1);
      let cx = x;
      for (const w of linea) {
        page.drawText(w, { x: cx, y, size: fontSize, font });
        cx += font.widthOfTextAtSize(w, fontSize) + espacioExtra;
      }
    } else {
      page.drawText(linea.join(" "), { x, y, size: fontSize, font });
    }
    y -= lineHeight;
  });

  return y;
}

/* Renderiza una carta -> Blob .pdf */
export async function renderPdf(plantillaKey, datos) {
  const { PDFDocument, StandardFonts } = window.PDFLib;
  const { membrete, firma } = await cargarAssets();

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const membreteImg = await pdfDoc.embedPng(membrete);
  page.drawImage(membreteImg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  const firmaImg = await pdfDoc.embedJpg(firma);
  const firmaW = 130;
  const firmaH = firmaImg.height * (firmaW / firmaImg.width);

  const maxWidth = PAGE_W - MARGIN_L - MARGIN_R;
  let y = PAGE_H - 100;
  const opts = { x: MARGIN_L, maxWidth, fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT };

  const linea = (texto) => {
    page.drawText(texto, { x: MARGIN_L, y, size: FONT_SIZE, font });
    y -= LINE_HEIGHT;
  };
  const parrafo = (texto) => {
    y = dibujarParrafo(page, font, texto, { ...opts, y });
  };
  const blanco = (n = 1) => { y -= LINE_HEIGHT * n; };

  linea(sustituir("Medellín, {{dia}} de {{mes}} de {{ano}}", datos));
  blanco(4);
  linea(BOILERPLATE.senores);
  parrafo(sustituir(datos.destinatario || "", datos));
  linea(BOILERPLATE.medellin);
  blanco(3);
  linea(BOILERPLATE.saludo);
  blanco(1);
  for (const cuerpo of CUERPOS[plantillaKey]) {
    parrafo(sustituir(cuerpo, datos));
    blanco(1);
  }
  blanco(1);
  linea(BOILERPLATE.cierre);
  blanco(1);

  page.drawImage(firmaImg, { x: MARGIN_L, y: y - firmaH + LINE_HEIGHT, width: firmaW, height: firmaH });
  y -= firmaH;

  for (const l of BOILERPLATE.firmante) linea(l);
  blanco(1);
  linea(BOILERPLATE.elaboro);

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: "application/pdf" });
}
