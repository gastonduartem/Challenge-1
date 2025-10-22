// multer.js — Configuración para subir imágenes de productos

const path = require('path');                                      // Manejo de rutas de archivos
const multer = require('multer');                                   // Librería para manejar multipart/form-data

// Límite de tamaño: 2MB
const MAX_SIZE = 2 * 1024 * 1024;                                   // 2 megabytes

// Filtro de archivos: permitimos jpg/jpeg/png/webp
function file_filter(req, file, cb) {                               // cb = callback de Multer
  const allowed = ['image/jpeg','image/jpg','image/png','image/webp']; // Tipos permitidos
  // mimetype seria la naturaleza de los tipo de archivo especificadso mas arriba
  if (!allowed.includes(file.mimetype)) {                           // Si el MIME no está permitido
    return cb(new Error('Tipo de archivo no permitido'), false);    // Rechazamos
  }
  cb(null, true);                                                   // Aceptamos
}

// Configuración de destino y nombre
const storage = multer.diskStorage({                                // Almacenamiento en disco
  destination: (req, file, cb) => {                                 // Dónde guardar
    cb(null, path.join(__dirname, '..', 'uploads'));                // /backend/src/uploads
  },
  filename: (req, file, cb) => {                                    // Nombre del archivo
    const ext = path.extname(file.originalname).toLowerCase();      // Extraemos extensión en minúsculas
    const base = path.basename(file.originalname, ext)              // Nombre base sin extensión
                  .toLowerCase().replace(/\s+/g,'-');               // Normalizamos espacios -> guiones
    const stamp = Date.now();                                       // Timestamp para evitar colisiones
    cb(null, `${base}-${stamp}${ext}`);                             // Ej: pescado-1732020000000.jpg
  }
});

// Instancia de multer con límites y filtro
const upload = multer({                                             // Creamos el middleware
  storage,                                                          // Usamos nuestro storage
  fileFilter: file_filter,                                          // Usamos nuestro filtro
  limits: { fileSize: MAX_SIZE }                                    // Límite de tamaño
});

module.exports = { upload };                                        // Exportamos para usar en rutas
