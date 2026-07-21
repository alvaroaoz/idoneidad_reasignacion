# Generador de cartas — Consultorio Jurídico Luis Amigó

Webapp 100% estática (sin servidor) para generar de forma **masiva** las cartas de
**idoneidad** y **reasignación** del Consultorio Jurídico, a partir de un Excel.

- Funciona **online** (GitHub Pages) y **offline** (PWA instalable).
- **Privacidad total**: los datos del Excel se procesan en el navegador; nada se sube a internet.
- Por cada fila del Excel se generan **2 cartas**: idoneidad (a nombre del *estudiante nuevo*) y reasignación.

## Cómo se usa

1. Abrir la página y pulsar **Descargar plantilla Excel**.
2. Llenar la hoja *Datos* (un caso por fila). Ver la hoja *Instrucciones* para qué va en cada columna.
3. Subir el Excel lleno (arrastrar o clic).
4. Pulsar **Generar y descargar ZIP**. Se descarga un `.zip` con un `.pdf` por carta.

La columna **`tema`** decide el modelo:
`civil`, `familia`, `laboral` → modelo Civil/Familia/Laboral · `penal` → modelo Penal · `administrativo` → modelo Administrativo.

## Estructura

```
index.html              página
css/styles.css          estilos
js/config.js            ⭐ especialidades, columnas y campos requeridos (editar aquí)
js/excel.js             leer Excel + generar plantilla descargable
js/cartas_contenido.js  texto de las 6 cartas (generado, ver Mantenimiento)
js/pdf_render.js        arma el .pdf de cada carta con pdf-lib (membrete + texto + firma)
js/app.js               orquestación / interfaz
assets/membrete.png     membrete institucional (fondo de página completo)
assets/firma.jpg        firma escaneada de la directora
templates/*.docx        ⭐ las 6 plantillas (editar en Word para cambiar textos)
vendor/                 librerías (pdf-lib, xlsx, jszip, FileSaver)
scripts/build_templates.py   regenera templates/ desde el .docx maestro
scripts/build_contenido.py   regenera js/cartas_contenido.js desde templates/*.docx
sw.js, manifest.webmanifest  PWA / offline
```

## Mantenimiento

- **Cambiar el texto de una carta** (p. ej. la directora): editar el `.docx` correspondiente
  en `templates/` con Word, cuidando de no partir los `{{placeholders}}`, y luego correr
  `python3 scripts/build_contenido.py` para propagar el texto a `js/cartas_contenido.js`
  (que es lo que la app realmente usa para generar el PDF).
- **Regenerar las 6 plantillas desde cero**: editar `CARTAS_Modelo_Rellenar.docx` y correr
  `python3 scripts/build_templates.py` y luego `python3 scripts/build_contenido.py`.
- **Cambiar el membrete o la firma**: reemplazar `assets/membrete.png` / `assets/firma.jpg`
  (o volver a extraerlos de `CARTAS_Modelo_Rellenar.docx` si se editó ahí).
- **Añadir/ajustar una especialidad o un campo**: editar `js/config.js`.
- **Tras cambiar archivos**, subir el número de versión en `sw.js` (`CACHE_VERSION`) para
  que los usuarios reciban la actualización (el service worker cachea todo para offline).

## Publicar en GitHub Pages

1. Subir esta carpeta a un repositorio.
2. En **Settings → Pages**, elegir *Deploy from a branch*, rama `main`, carpeta `/ (root)`.
3. La app queda en `https://<usuario>.github.io/<repo>/`.

> Las rutas son relativas (`./`), así que funciona bajo subcarpeta. El archivo `.nojekyll`
> evita que GitHub Pages procese los archivos con Jekyll.

## Placeholders por plantilla

| Plantilla | Campos |
|---|---|
| penal_idoneidad | dia, mes, ano, destinatario, estudiante, cedula, usuario, delitos, id_identificador, id_consultorio |
| penal_reasignacion | …, estudiante_anterior, estudiante_nuevo, cc_nuevo, usuario, delitos, id_identificador, id_consultorio |
| civil_idoneidad | …, estudiante, cedula, usuario, tipo_proceso, demandado, id_consultorio |
| civil_reasignacion | …, estudiante_anterior, estudiante_nuevo, cc_nuevo, tipo_proceso, id_identificador, usuario, demandado, id_consultorio |
| admin_idoneidad | …, estudiante, cedula, usuario, id_identificador, id_consultorio |
| admin_reasignacion | …, estudiante_anterior, estudiante_nuevo, cc_nuevo, tipo_proceso, id_identificador, usuario, id_consultorio |

En la idoneidad, `estudiante`/`cedula` se toman de `estudiante_nuevo`/`cc_nuevo`.
