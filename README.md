# 🦕 Exposición de Fósiles

Plataforma web educativa para exhibir maquetas y fósiles de Biología.  
Diseño editorial minimalista con panel de administración completo.

---

## Inicio rápido (localhost)

```bash
npm install
npm start
```

- Sitio público → http://localhost:3000
- Panel admin  → http://localhost:3000/admin  
  - Usuario: `admin` / Contraseña: `admin`

Para desarrollo con recarga automática:
```bash
npm run dev
```

---

## Estructura del proyecto

```
fossil-expo/
├── server.js          ← Backend Express
├── package.json
├── railway.toml       ← Config Railway
├── data/
│   └── content.json   ← Base de datos JSON (auto-creada)
├── uploads/           ← Archivos subidos (auto-creada)
└── public/
    ├── index.html     ← Sitio público
    ├── admin.html     ← Dashboard admin
    ├── css/
    │   ├── style.css
    │   └── admin.css
    └── js/
        ├── site.js
        └── admin.js
```

---

## Deploy en Railway

1. Crear repositorio en GitHub y subir el proyecto
2. Conectar repositorio en [railway.app](https://railway.app)
3. Railway detecta automáticamente Node.js y usa `railway.toml`
4. Opcional: configurar variables de entorno en Railway:
   - `ADMIN_USER` — usuario admin (default: admin)
   - `ADMIN_PASS` — contraseña admin (default: admin)
   - `SESSION_SECRET` — secreto para sesiones

> **Nota:** Para producción en Railway se recomienda agregar un volumen persistente montado en `/uploads` y `/data` para que los archivos subidos no se pierdan entre deploys.

---

## Funcionalidades del admin

| Función | Descripción |
|---|---|
| Configuración del sitio | Título, subtítulo, descripción, imagen hero, fuente global, color de acento |
| Secciones | Crear, editar, eliminar y reordenar secciones |
| Tipos de sección | Texto, Imagen, Galería, Vídeo, Separador |
| Estilos de galería | Imagen única, 2 columnas, 3 columnas, Mosaico (masonry), Ancho completo |
| Fuentes | Cormorant Garamond, DM Sans, Playfair Display, Montserrat, Lora, EB Garamond, Josefin Sans, Libre Baskerville |
| Biblioteca de medios | Subir, visualizar y eliminar imágenes y vídeos |
| Selección desde biblioteca | Insertar medios ya subidos en cualquier sección |
