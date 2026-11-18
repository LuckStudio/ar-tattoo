# AR Tattoo

Herramienta web (HTML estático, lista para GitHub Pages) que usa un **tattoo real como marcador AR**: apuntas la cámara del móvil al tattoo y aparece un modelo 3D encima.

Tecnología: [MindAR](https://github.com/hiukim/mind-ar-js) (tracking de imagen) + [A-Frame](https://aframe.io) (render 3D) + aframe-extras (animaciones de modelos GLB). Todo se carga desde CDN: no hay build ni servidor.

## Estructura

```
index.html            Galería: lista los tattoos de config/tattoos.json
ar.html               Visor AR (ar.html?t=<id>): cámara + tracking + modelo 3D
compiler.html         Sube la foto del tattoo → genera el marcador .mind en el navegador
config/tattoos.json   Un registro por tattoo: marcador, modelo, escala, posición…
js/config.js          Lectura de la configuración
css/style.css         Estilos
assets/markers/       Fotos de los tattoos (miniatura de la galería)
assets/targets/       Marcadores compilados (.mind)
assets/models/        Modelos 3D (.glb)
.nojekyll             Evita que GitHub Pages procese el sitio con Jekyll
```

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
