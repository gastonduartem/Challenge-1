// routes/products.js — Rutas de productos con protección JWT y subida de imágenes

const express = require('express');                     // Framework HTTP
const router = express.Router();                        // Instancia del router

const { requireToken } = require('../middleware/auth'); // Middleware que valida/rota JWT
const { upload } = require('../middleware/multer');     // Multer configurado (fileFilter, storage)

// Importamos controladores del CRUD
const {
  list_products,            // Lista productos
  new_product_form,         // Form de alta
  create_product,           // Crear producto
  edit_product_form,        // Form de edición
  update_product,           // Actualizar producto
  delete_product,           // Borrar producto
  upload_image              // Subir/actualizar imagen
} = require('../controllers/productController');


// IMPORTANTE: este router se monta en app.js con app.use('/products', router)
// Por eso las rutas acá son relativas a /products

// GET /products — listado (token por query)
router.get('/', requireToken, list_products);           // Protegido por JWT

// GET /products/new — form de alta (token por query)
router.get('/new', requireToken, new_product_form);     // Protegido por JWT

// POST /products — crear (multipart)
// Primero multer parsea form-data (req.body/req.file), luego requireToken lee req.body.token
router.post('/', upload.single('image'), requireToken, create_product);

// GET /products/:id/edit — form de edición (token por query)
// No usar multer en GET (no hay multipart en GET)
// Sólo validar JWT
router.get('/:id/edit', requireToken, edit_product_form);

// POST /products/:id — actualizar (multipart)
// Igual que crear: multer PRIMERO, luego requireToken
router.post('/:id', upload.single('image'), requireToken, update_product);

// POST /products/:id/delete — eliminar (no multipart)
// Basta con validar JWT
router.post('/:id/delete', requireToken, delete_product);

// POST /products/:id/image — subir/actualizar sólo la imagen (multipart)
// También: multer PRIMERO, luego requireToken
router.post('/:id/image', upload.single('image'), requireToken, upload_image);

module.exports = router;                                // Exportamos el router
