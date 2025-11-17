// app.js — Arranque del panel admin con Pug, MongoDB, seeding y rutas de auth

// Importaciones base
const path = require('path');           // Módulo nativo de Node: manejo de rutas de archivos y carpetas
const express = require('express');     // Framework web principal (ruteo, middlewares, SSR)
const mongoose = require('mongoose');   // ODM (Object Document Mapper) para MongoDB
const morgan = require('morgan');       // Middleware para logs HTTP (requests/responses)
const helmet = require('helmet');       // Seguridad por headers HTTP
const bcrypt = require('bcryptjs');     // Hasheo seguro de contraseñas
require('dotenv').config();             // Carga variables del archivo .env en process.env


// Importaciones internas (modelos y rutas)
const AdminUser = require('./models/AdminUser');  // Modelo del usuario admin (Paula)
const auth_routes = require('./routes/auth');     // Rutas de login/logout/dashboard

// Obtenemos la ruta ABSOLUTA de la carpeta de uploads desde multer
// (para garantizar que el backend y multer usen la misma ruta de imágenes)
const { UPLOADS_DIR } = require('./middleware/multer');


// Variables de entorno (configuración global)
const port_backend = process.env.PORT_BACKEND || 4000;  // Puerto donde corre el admin
const mongo_uri = process.env.MONGO_URI;                // URI completa de MongoDB
const mongo_db = process.env.MONGO_DB;                  // Nombre de la base de datos


// Inicializamos la aplicación Express
const app = express();


// Middlewares globales

// Helmet: agrega cabeceras HTTP seguras (previene ataques comunes)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Permite cargar imágenes desde mismo host
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      imgSrc: ["'self'", "data:"] // Permite imágenes locales y base64
    }
  }
}));

// Morgan: loggea todas las requests (método, ruta, tiempo, etc.), intercepta esa request y muestra en la terminal un pequeño resumen
app.use(morgan('dev'));

// Parsers: interpretan los datos del body
app.use(express.urlencoded({ extended: true })); // Para formularios HTML
app.use(express.json());                         // Para JSON (si hicieras API REST)


// Configuración del motor de vistas y archivos estáticos

// Motor de plantillas Pug (SSR)
app.set('views', path.join(__dirname, 'views'));  // Carpeta donde están las vistas .pug
app.set('view engine', 'pug');                    // Indicamos el motor

// Carpeta pública (CSS, imágenes, scripts si hubiesen)
app.use('/public', express.static(path.join(__dirname, 'public')));

// Servimos /uploads desde la misma carpeta que Multer
console.log('[uploads] sirviendo estáticos desde:', UPLOADS_DIR);
app.use('/uploads', express.static(UPLOADS_DIR)); // Así las imágenes subidas se ven desde el navegador


// Conexión a MongoDB
mongoose.set('strictQuery', true); // Evita advertencias por consultas no definidas

mongoose.connect(mongo_uri, { dbName: mongo_db })
  .then(() => console.log(`[mongo] conectado a ${mongo_db}`))
  .catch((err) => {
    console.error('[mongo] error:', err.message);
    process.exit(1); // Si falla, se termina el proceso
  });


// Seeder de Paula (crea usuario admin si no existe)
async function seed_admin_if_needed() {
  const email = process.env.ADMIN_EMAIL;      // Email desde .env
  const password = process.env.ADMIN_PASSWORD; // Contraseña desde .env

  // Si falta alguno de los dos, salimos sin hacer nada
  if (!email || !password) return;

  // Buscamos si ya existe el usuario admin
  const exists = await AdminUser.findOne({ email });
  if (exists) return; // Si ya existe, no lo volvemos a crear

  // Si no existe → generamos hash seguro de la contraseña
  const password_hash = await bcrypt.hash(password, 10);

  // Creamos el usuario admin
  await AdminUser.create({ email, password_hash });
  console.log('[seed] admin creado:', email);
}


// Ruta raíz mínima
// Redirige / → /login, para evitar acceder sin autenticación
app.get('/', (req, res) => {
  res.redirect('/login');
});


// Montamos las rutas principales

// Rutas de autenticación y dashboard
app.use('/', auth_routes);

// Rutas de productos (CRUD, imágenes)
const product_routes = require('./routes/products');
app.use('/products', product_routes);

// Rutas de pedidos (listado, cambio de estado)
const order_routes = require('./routes/orders');
app.use('/', order_routes);

// Ruta de entrega (mover pedido a histórico y descontar stock)
const deliver_routes = require('./routes/deliver');
app.use('/', deliver_routes);


app.use('/deliver', deliver_routes);


// Middleware final — 404
app.use((req, res) => {
  return res.status(404).send('Recurso no encontrado'); // En caso de ruta inválida
});


// Inicialización del servidor
// Lanza el servidor Express y ejecuta el seeder
app.listen(port_backend, async () => {
  await seed_admin_if_needed(); // Crea el admin si no existe
  console.log(`[admin] escuchando en http://localhost:${port_backend}`);
});
