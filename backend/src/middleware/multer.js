// multer.js — Configuración para subir imágenes de productos

const path = require('path');                       // Manejo de rutas de archivos
const fs = require('fs');                           // Para crear carpetas si no existen
const multer = require('multer');                   // Manejar multipart/form-data

// Leemos UPLOADS_PATH (opcional); si no viene, usamos 'uploads' dentro de src/
const uploadsEnv = process.env.UPLOADS_PATH || 'uploads'; // Ej: 'uploads'

// Convertimos SIEMPRE a ruta ABSOLUTA basada en src/ (este archivo vive en src/middleware)
const UPLOADS_DIR = path.resolve(__dirname, '..', uploadsEnv); // /.../backend/src/uploads

// Aseguramos que la carpeta exista
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Límite de tamaño: 2MB
const MAX_SIZE = 2 * 1024 * 1024;

// Filtro de tipos de imagen válidos
function file_filter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Tipo de archivo no permitido'), false);
  }
  cb(null, true);
}

// Estrategia de guardado en disco
const storage = multer.diskStorage({
  destination: (req, file, cb) => {                 // Carpeta destino
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {                    // Nombre de archivo
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext)
      .toString()
      .normalize('NFKD')
      .replace(/[^\w\-]+/g, '-')                    // limpia caracteres raros
      .replace(/\-+/g, '-')
      .toLowerCase();
    cb(null, `${base}-${Date.now()}${ext}`);        // ejemplo: remera-one-piece-1732.png
  }
});

// Instancia de multer
const upload = multer({
  storage,                                          // dónde y cómo guardar
  fileFilter: file_filter,                          // filtro MIME
  limits: { fileSize: MAX_SIZE }                    // límite 2MB
});

module.exports = { upload, UPLOADS_DIR };           // Exportamos middleware y ruta absoluta
