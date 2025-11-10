// multer.js — Configuración para subir imágenes de productos


// Importamos módulos nativos de Node.js

const path = require('path'); // Maneja rutas de archivos y directorios de forma cross-plataforma
const fs = require('fs');     // Permite crear carpetas y manejar archivos en el sistema
// Importamos multer, librería para procesar formularios multipart/form-data (archivos + texto)
const multer = require('multer');


// Ruta base de subida de archivos

// Intentamos leer una variable de entorno UPLOADS_PATH (por si queremos una carpeta personalizada)
// Si no existe, usamos por defecto 'uploads' (dentro de src/)
const uploadsEnv = process.env.UPLOADS_PATH || 'uploads'; // Ejemplo: 'uploads'


// Construimos una ruta absoluta para las subidas

// __dirname apunta a la carpeta donde está este archivo (src/middleware/)
// path.resolve(__dirname, '..', uploadsEnv) → sube un nivel y concatena 'uploads'
// Resultado: /ruta/proyecto/backend/src/uploads
const UPLOADS_DIR = path.resolve(__dirname, '..', uploadsEnv);


// Aseguramos que la carpeta exista (si no, la creamos recursivamente)

fs.mkdirSync(UPLOADS_DIR, { recursive: true });


// Límite máximo de tamaño permitido por archivo (2 MB)

const MAX_SIZE = 2 * 1024 * 1024;


// Filtro de tipos de archivos válidos (solo imágenes permitidas)

function file_filter(req, file, cb) {
  // Tipos MIME permitidos
  // MIME: Multipurpose Internet Mail Extensions
  // tipo de contenido (content type) que identifica el formato de un archivo o dato transmitido por HTTP, email, etc.
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  // Si el tipo MIME no está en la lista → rechazamos la subida
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Tipo de archivo no permitido'), false);
  }

  // Si es válido → aceptamos el archivo
  // cb: callback, función callback que vos tenés que llamar para decirle a Multer qué hacer con ese archivo, cb se llama con dos argumentos
  cb(null, true);
}


// Estrategia de almacenamiento (diskStorage)

// Define cómo y dónde se guardarán los archivos subidos.
const storage = multer.diskStorage({
  // Carpeta destino donde se guardará el archivo físico
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR); // Le pasamos la carpeta de destino
  },

  // Definimos el nombre con el que se guardará el archivo en disco
  filename: (req, file, cb) => {
    // Extraemos la extensión (por ejemplo ".png")
    const ext = path.extname(file.originalname).toLowerCase();

    // Extraemos el nombre base sin extensión
    const base = path.basename(file.originalname, ext)
      .toString()
      .normalize('NFKD')       // Normaliza caracteres especiales (acentos, etc.)
      .replace(/[^\w\-]+/g, '-') // Reemplaza todo lo que no sea letras, números o guiones
      .replace(/\-+/g, '-')      // Evita guiones repetidos
      .toLowerCase();            // Convierte a minúsculas

    // Ejemplo final: "pescado-helado-1732123123123.png"
    cb(null, `${base}-${Date.now()}${ext}`);
  }
});


// Instancia principal de Multer

// Creamos la instancia configurada con:
//  - storage: define cómo y dónde guardar
//  - fileFilter: qué tipos de archivo aceptar
//  - limits: tamaño máximo
const upload = multer({
  storage,                      // estrategia de guardado
  fileFilter: file_filter,       // validador MIME
  limits: { fileSize: MAX_SIZE } // límite de 2 MB por archivo
});


// Exportamos para usar en controladores o rutas

// upload → middleware que se usa en las rutas (ejemplo: upload.single('image'))
// UPLOADS_DIR → ruta absoluta donde se almacenan los archivos
module.exports = { upload, UPLOADS_DIR };
