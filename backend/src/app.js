// IMPORTACIONES
const path = require('path');               // Módulo para trabajar con rutas de archivos
const express = require('express');         // Framework HTTP de Node.js
const mongoose = require('mongoose');       // ODM para conectarse y modelar MongoDB
const morgan = require('morgan');           // Middleware de logs HTTP
const helmet = require('helmet');           // Middleware de seguridad (headers)
require('dotenv').config();                 // Carga variables de entorno desde .env

// VARIABLES DE ENTORNO
const port_backend = process.env.PORT_BACKEND || 4000;
const mongo_uri = process.env.MONGO_URI;
const mongo_db = process.env.MONGO_DB;
const uploads_path = process.env.UPLOADS_PATH || path.join(__dirname, 'uploads');

// INICIALIZAR APP
const app = express();

// MIDDLEWARES GLOBALES
app.use(helmet());                          // Seguridad básica por cabeceras HTTP
app.use(morgan('dev'));                     // Logs en consola de las requests
app.use(express.urlencoded({ extended: true })); // Permite leer datos de formularios
app.use(express.json());                    // Permite recibir JSON si hace falta

// CONFIGURACIÓN DE PUG + ARCHIVOS ESTÁTICOS
app.set('views', path.join(__dirname, 'views')); // Carpeta donde estarán las vistas Pug
app.set('view engine', 'pug');                   // Motor de plantillas Pug
app.use('/public', express.static(path.join(__dirname, 'public'))); // Archivos estáticos (CSS, img)
app.use('/uploads', express.static(uploads_path));                   // Carpeta donde se guardan las imágenes subidas

// CONEXIÓN A MONGODB
mongoose.set('strictQuery', true);

mongoose.connect(mongo_uri, { dbName: mongo_db })
  .then(() => console.log(`[mongo] conectado a ${mongo_db}`))
  .catch((err) => {
    console.error('[mongo] error de conexión:', err.message);
    process.exit(1);
  });

// RUTA BÁSICA (DÍA 1 TEST)
app.get('/', (req, res) => {
  res.send('<h1>🐧 Penguin Admin corriendo</h1><p>SSR + Mongo OK ✅</p>');
});

// LEVANTAR SERVIDOR
app.listen(port_backend, () => {
  console.log(`[admin] escuchando en http://localhost:${port_backend}`);
});
