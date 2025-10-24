// app.js — Arranque del admin con Pug, Mongo, seeding y rutas de auth

const path = require('path');                       // Manejo de paths
const express = require('express');                 // Servidor HTTP
const mongoose = require('mongoose');               // ODM Mongo
const morgan = require('morgan');                   // Logger HTTP
const helmet = require('helmet');                   // Seguridad por headers
const bcrypt = require('bcryptjs');                 // Hash de contraseña
require('dotenv').config();                         // Cargar .env

// Importamos modelo y rutas
const AdminUser = require('./models/AdminUser');    // Modelo AdminUser
const auth_routes = require('./routes/auth');       // Rutas de auth/login/dashboard

// IMPORTANTE: traemos la MISMA ruta de uploads que usa Multer
const { UPLOADS_DIR } = require('./middleware/multer'); // Carpeta absoluta compartida con Multer

// Variables de entorno
const port_backend = process.env.PORT_BACKEND || 4000;     // Puerto del admin
const mongo_uri = process.env.MONGO_URI;                   // URI de Mongo (docker)
const mongo_db = process.env.MONGO_DB;                     // Nombre de base
// (Ya no calculamos uploads_path por nuestra cuenta; usamos UPLOADS_DIR de multer)

// Inicializamos la app
const app = express();                            // Instancia de Express

// Middlewares globales
app.use(helmet());                                // Headers de seguridad
app.use(morgan('dev'));                           // Logs de requests
app.use(express.urlencoded({ extended: true }));  // Parseo de forms
app.use(express.json());                          // Parseo de JSON

// Vista Pug + estáticos
app.set('views', path.join(__dirname, 'views'));  // Carpeta vistas
app.set('view engine', 'pug');                    // Motor Pug
app.use('/public', express.static(path.join(__dirname, 'public'))); // Archivos públicos

// Servimos /uploads desde la MISMA carpeta absoluta que usa Multer
console.log('[uploads] sirviendo estáticos desde:', UPLOADS_DIR);     // Log para verificar ruta
app.use('/uploads', express.static(UPLOADS_DIR));                     // Sirve /uploads/* desde UPLOADS_DIR

// Conectar Mongo
mongoose.set('strictQuery', true);                // Buenas prácticas
mongoose.connect(mongo_uri, { dbName: mongo_db }) // Conexión a Mongo
  .then(() => console.log(`[mongo] conectado a ${mongo_db}`)) // Log ok
  .catch((err) => { console.error('[mongo] error:', err.message); process.exit(1); }); // Log error

// Seeder de Paula (si no existe)
async function seed_admin_if_needed() {           // Función seeding
  const email = process.env.ADMIN_EMAIL;          // Email desde .env
  const password = process.env.ADMIN_PASSWORD;    // Password desde .env
  if (!email || !password) return;                // Si falta algo, salimos silenciosos

  const exists = await AdminUser.findOne({ email });  // Buscamos por email
  if (exists) return;                             // Si ya existe, no hacemos nada

  const password_hash = await bcrypt.hash(password, 10); // Hasheamos password
  await AdminUser.create({ email, password_hash });      // Creamos admin
  console.log('[seed] admin creado:', email);            // Log de éxito
}

// Ruta mínima GET raíz (informativa)
//    La ponemos ANTES de montar rutas protegidas para que / siempre redirija a /login
app.get('/', (req, res) => {                      // GET raíz
  res.redirect('/login');                         // Redirigimos a login
});

// Rutas públicas de autenticación (login/logout/dashboard GET/POST según diseño)
app.use('/', auth_routes);                        // Montamos rutas de auth (login/logout/dashboard)

// Rutas de productos (montadas en /products, no en /)
// Esto evita que GET / pase por el middleware de productos
const product_routes = require('./routes/products');   // Importamos rutas de productos
app.use('/products', product_routes);                  // Montamos en /products

// (Opcional) 404 para cualquier otra ruta no matcheada
app.use((req, res) => {                           // Middleware final
  return res.status(404).send('Recurso no encontrado'); // 404 simple
});

// Levantar servidor
app.listen(port_backend, async () => {            // Iniciamos server
  await seed_admin_if_needed();                   // Ejecutamos seeding al arrancar
  console.log(`[admin] escuchando en http://localhost:${port_backend}`); // Log
});
