# AR Tattoo

Herramienta web (HTML estático, lista para GitHub Pages) que usa un **tattoo real como marcador AR**: apuntas la cámara del móvil al tattoo y aparece un modelo 3D encima.

Tecnología: [MindAR](https://github.com/hiukim/mind-ar-js) (tracking de imagen) + [A-Frame](https://aframe.io) (render 3D) + aframe-extras (animaciones de modelos GLB). Todo se carga desde CDN: no hay build ni servidor.

## Estructura

```
index.html            Galería: lista los tattoos de config/tattoos.json (botones "Abrir AR" y "Vista 3D")
ar.html               Visor AR (ar.html?t=<id>): cámara + tracking + 3D
                      Vista previa sin cámara: ar.html?t=<id>&preview
compiler.html         Sube la foto del tattoo → genera el marcador .mind en el navegador
config/tattoos.json   Un registro por tattoo: marcador, modelo, escala, posición…
js/config.js          Lectura de la configuración
js/effects/           Efectos 3D programados, p. ej. mandala.js
tools/extract_tattoo.py  Aísla el diseño de una foto del tattoo (marcador + PNG + contornos)
css/style.css         Estilos
assets/markers/       Fotos de los tattoos (miniatura de la galería)
assets/targets/       Marcadores compilados (.mind)
assets/models/        Modelos 3D (.glb)
assets/effects/       Datos de los efectos (contornos vectoriales del diseño)
.nojekyll             Evita que GitHub Pages procese el sitio con Jekyll
```

## Tattoo "Mandala de loto"

- `assets/markers/mandala.jpg`: el marcador, con la tinta real aislada sobre un fondo de piel uniforme.
- `assets/markers/mandala-design.png`: el diseño aislado con fondo transparente.
- `assets/effects/mandala.json`: contornos vectoriales del diseño en coordenadas AR.
- `js/effects/mandala.js`: la secuencia 3D:
  1. El diseño del tattoo se eleva de la piel como un relieve de cobre, en el mismo sitio que la tinta.
  2. En el centro se abre una flor de loto 3D con 4 pétalos lobulados y pétalos interiores en diagonal, como en el tattoo.
  3. La gota de arriba se enciende como una llama.
  4. Los puntos del tattoo sueltan chispas que suben.
  Tocar la pantalla repite la animación.

Para regenerarlo desde otra foto: `python3 tools/extract_tattoo.py recorte.jpg mandala` y vuelve a compilar el `.mind` en `compiler.html`.

## Añadir un tattoo nuevo

1. **Foto**: de frente, buena luz, sin reflejos, recortada al tattoo. Guárdala en `assets/markers/`.
2. **Marcador**: abre `compiler.html`, sube la foto y descarga el `.mind`. Guárdalo en `assets/targets/`.
3. **Modelo 3D**: exporta tu modelo en `.glb` (Blender, Sketchfab…) y guárdalo en `assets/models/`. Intenta que pese menos de 5 MB.
4. **Config**: pega en `config/tattoos.json` el bloque que te da el compilador y ajusta `scale`, `position` y `rotation`.
   - El ancho del tattoo equivale a 1 unidad. `position: "0 0 0.1"` lo eleva un poco sobre la piel.
   - Si `model` está vacío se muestra una figura de prueba.
   - `animate: true` reproduce la animación del GLB (o gira la figura de prueba).

## Probar en local

La cámara solo funciona en `https://` o en `localhost`:

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000`. Para probar desde el móvil usa GitHub Pages (que ya es HTTPS).

Demo incluida: abre `assets/markers/demo.png` en otra pantalla y apunta la cámara desde `ar.html?t=demo`.

## Publicar en GitHub Pages

Repo → **Settings → Pages** → Source: *Deploy from a branch* → rama `main`, carpeta `/ (root)`.
La web quedará en `https://<usuario>.github.io/ar-tattoo/`.

## Limitaciones del tattoo como marcador

- La piel es curva y se deforma: funciona mejor en zonas planas (antebrazo, espalda, muslo).
- Detecta mejor tattoos con mucho detalle, contraste y formas asimétricas. Los de línea fina, minimalistas o muy simétricos dan menos puntos de referencia.
- Mejor tattoos de tamaño medio o grande: el tattoo tiene que ocupar buena parte de la pantalla.
- Si el tracking tiembla, sube `filterMinCF` / baja `filterBeta` en `ar.html`.
