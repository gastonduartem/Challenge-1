// auth.js — Rutas de login/logout y dashboard minimal

// Importaciones necesarias
const express = require('express');        // Framework para manejar rutas HTTP
const bcrypt = require('bcryptjs');        // Comparar contraseñas hasheadas
const AdminUser = require('../models/AdminUser'); // Modelo del administrador (Paula)
const { create_token } = require('../services/jwt'); // Función para crear JWTs
const { generate_csrf_token, verify_and_consume_csrf_token } = require('../middleware/csrf'); // CSRF helpers
const { require_jwt } = require('../middleware/requireJWT'); // Middleware que valida token desde el body (POST)
const { requireToken } = require('../middleware/auth');       // Middleware que valida token desde headers/query

// Creamos un router de Express (agrupa todas las rutas relacionadas)
const router = express.Router();


// GET /login — muestra formulario de login
router.get('/login', async (req, res) => {
  // Generamos un token CSRF nuevo para proteger el formulario
  const csrf_token = generate_csrf_token();

  // Renderizamos la vista SSR (login.pug), inyectando el token CSRF
  return res.status(200).render('login', { csrf_token });
});


// POST /login — procesa credenciales y emite JWT (sin cookies)
router.post('/login', async (req, res) => {
  // Extraemos los campos enviados por el formulario
  const { email, password, csrf_token } = req.body;

  // Validamos el token CSRF (previene ataques cross-site)
  if (!verify_and_consume_csrf_token(csrf_token)) {
    return res.status(403).send('CSRF inválido.');
  }

  // Buscamos al admin en la base de datos
  const admin = await AdminUser.findOne({ email });
  if (!admin) {
    // Si el usuario no existe, devolvemos el login con mensaje de error
    return res.status(401).render('login', {
      error_msg: 'Credenciales inválidas.',
      csrf_token: generate_csrf_token() // Nuevo CSRF para reintentar
    });
  }

  // Validamos la contraseña comparando con el hash almacenado
  const ok = await admin.validatePassword(password);
  if (!ok) {
    // Si la contraseña no coincide → volvemos al login
    return res.status(401).render('login', {
      error_msg: 'Credenciales inválidas.',
      csrf_token: generate_csrf_token()
    });
  }

  // Credenciales correctas → creamos un JWT
  // Incluimos los claims mínimos: ID y email
  const token = create_token({
    admin_id: admin._id.toString(),
    email
  });

  // Renderizamos el dashboard con SSR (sin redirección)
  // El token se inyecta como campo oculto (para futuros POST)
  return res.status(200).render('dashboard', {
    token,                             // JWT a incluir en formularios
    csrf_token: generate_csrf_token(), // Nuevo CSRF para operaciones posteriores
    admin_email: email                 // Mostramos el email en el header
  });
});


// POST /logout — “cierra” sesión lógicamente
// No existe una lista negra de tokens (stateless JWT).
// Simplemente se renderiza nuevamente el login, sin reenviar token.
router.post('/logout', async (req, res) => {
  return res.status(200).render('login', {
    csrf_token: generate_csrf_token()
  });
});


// POST /dashboard — ejemplo de ruta protegida (solo POST)
// Usa el middleware require_jwt, que valida el token desde req.body.token
router.post('/dashboard', require_jwt, async (req, res) => {
  // En este punto, el token ya fue validado y rotado por el middleware
  return res.status(200).render('dashboard', {
    token: res.locals.rotated_token,    // Nuevo token (rotado)
    csrf_token: generate_csrf_token(),  // CSRF nuevo para formularios
    admin_email: res.locals.admin_claims.email // Email del admin logueado
  });
});


// GET /dashboard — versión GET (token en query string)
// Usa el middleware requireToken, que busca el token en headers o query (?token=)
router.get('/dashboard', requireToken, (req, res) => {
  res.status(200).render('dashboard', {
    admin_email: res.locals.admin_claims?.email || '', // Email del admin
    token: res.locals.rotated_token,                   // Token rotado
    csrf_token: generate_csrf_token()                  // CSRF nuevo
  });
});


// Exportamos el router para usarlo en app.js o server.js
module.exports = router;
