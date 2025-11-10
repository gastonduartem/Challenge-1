// routes/products.js — Rutas de productos con protección JWT y subida de imágenes

// Dependencias principales
const express = require('express');
const router = express.Router();                        // Router Express
const { requireToken } = require('../middleware/auth');  // Middleware JWT (valida Paula)
const { upload } = require('../middleware/multer');      // Configuración de Multer para imágenes

// Importamos los controladores (CRUD de productos)
const {
  list_products,     // Listar productos
  new_product_form,  // Mostrar formulario de creación
  create_product,    // Crear producto nuevo
  edit_product_form, // Mostrar formulario de edición
  update_product,    // Actualizar producto existente
  delete_product,    // Eliminar producto
  upload_image       // Subir o actualizar imagen
} = require('../controllers/productController');


// NOTA IMPORTANTE:
// Este router se monta con app.use('/products', router)
// Por lo tanto, todas las rutas aquí son relativas a /products


// GET /products — Listado de productos
// Muestra todos los productos en una tabla SSR (sin JS)
router.get('/', requireToken, list_products);


// GET /products/new — Formulario de alta
// Renderiza un formulario vacío con CSRF y token
router.get('/new', requireToken, new_product_form);


// POST /products — Crear producto
// - Se usa multer.single('image') para manejar imagen opcional
// - requireToken valida que el usuario esté autenticado
// - create_product crea el documento en Mongo
router.post('/', upload.single('image'), requireToken, create_product);


// GET /products/:id/edit — Formulario de edición
// - Renderiza el formulario precargado con datos existentes
// - No necesita multer (GET no tiene body)
router.get('/:id/edit', requireToken, edit_product_form);


// POST /products/:id — Actualizar producto existente
// - Igual que el alta, pero actualiza el documento
// - multer primero parsea la imagen si se envía
router.post('/:id', upload.single('image'), requireToken, update_product);


// POST /products/:id/delete — Eliminar producto
// - Solo se necesita validar el token
router.post('/:id/delete', requireToken, delete_product);


// POST /products/:id/image — Actualizar imagen exclusivamente
// - Permite subir solo una nueva imagen sin tocar otros campos
router.post('/:id/image', upload.single('image'), requireToken, upload_image);


// Exportación del router
module.exports = router;
