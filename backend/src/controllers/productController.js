// controllers/productController.js — CRUD de productos (SSR sin JS)

const Product = require('../models/Product');                                  // Modelo de Producto
const { generate_csrf_token, verify_and_consume_csrf_token } = require('../middleware/csrf'); // CSRF

// Listado de productos (GET /products)
async function list_products(req, res) {                                       // Handler de listado
  const products = await Product.find().sort({ created_at: -1 });              // Buscamos productos ordenados
  return res.status(200).render('products/list', {                             // Renderizamos la vista
    token: res.locals.rotated_token,                                           // Pasamos token rotado
    csrf_token: generate_csrf_token(),                                         // Token CSRF para formularios
    admin_email: res.locals.admin_claims?.email || '',                         // Para el header
    products                                                                    // Datos a mostrar
  });
}

// Form de nuevo producto (GET /products/new)
async function new_product_form(req, res) {                                    // Handler de form vacío
  return res.status(200).render('products/form', {                             // Render form
    token: res.locals.rotated_token,                                           // Token rotado
    csrf_token: generate_csrf_token(),                                         // CSRF
    admin_email: res.locals.admin_claims?.email || '',                         // Header
    mode: 'create',                                                            // Modo crear
    product: { name:'', description:'', price:'', stock:'', is_active:true }   // Valores por defecto
  });
}

// Crear producto (POST /products) — con imagen opcional vía multer.single('image')
async function create_product(req, res) {                                      // Handler de creación
  const { csrf_token, name, description, price, stock, is_active } = req.body; // Campos del body
  if (!verify_and_consume_csrf_token(csrf_token)) {                            // Validamos CSRF
    return res.status(403).send('CSRF inválido');                              // Si falla, cortamos
  }

  // Convertimos price/stock a número
  const price_num = Number(price);                                             // Precio a número
  const stock_num = Number(stock);                                             // Stock a número

  // Validamos campos mínimos
  if (!name || isNaN(price_num) || isNaN(stock_num) || price_num < 0 || stock_num < 0) {
    return res.status(400).render('products/form', {                           // Re-render con error
      token: res.locals.rotated_token,                                         // Token
      csrf_token: generate_csrf_token(),                                       // Nuevo CSRF
      admin_email: res.locals.admin_claims?.email || '',                       // Header
      mode: 'create',                                                          // Modo
      error_msg: 'Campos inválidos (price/stock >= 0, name requerido).',       // Mensaje
      product: { name, description, price, stock, is_active: is_active === 'on' } // Re-llenamos
    });
  }

  const imgPath = req.file ? `/uploads/${req.file.filename}` : undefined;      // Si subieron imagen, armamos ruta pública

  // Creamos el documento
  await Product.create({                                                        // Insert en Mongo
    name,
    description: description || '',
    price: price_num,
    stock: stock_num,
    is_active: is_active === 'on',
    image_path: imgPath,                                                       // Guardamos imagen si hay
    created_at: new Date(),                                                    // Auditoría simple
    updated_at: new Date()
  });

  // Redirigimos al listado con el token en query (sin cookies)
  return res.redirect(`/products?token=${res.locals.rotated_token}`);          // Volvemos a la lista
}

// Form de editar (GET /products/:id/edit)
async function edit_product_form(req, res) {                                   // Handler de edición
  const { id } = req.params;                                                   // ID desde ruta
  const product = await Product.findById(id);                                  // Buscamos doc
  if (!product) return res.status(404).send('Producto no encontrado');         // 404 si no existe

  return res.status(200).render('products/form', {                             // Render form con datos
    token: res.locals.rotated_token,                                           // Token
    csrf_token: generate_csrf_token(),                                         // CSRF
    admin_email: res.locals.admin_claims?.email || '',                         // Header
    mode: 'edit',                                                              // Modo editar
    product                                                                     // Datos actuales
  });
}

// Actualizar (POST /products/:id)
async function update_product(req, res) {                                      // Handler de update
  const { id } = req.params;                                                   // ID
  const { csrf_token, name, description, price, stock, is_active } = req.body; // Campos
  if (!verify_and_consume_csrf_token(csrf_token)) {                            // Validamos CSRF
    return res.status(403).send('CSRF inválido');                              // Error
  }

  const price_num = Number(price);                                             // A número
  const stock_num = Number(stock);

  if (!name || isNaN(price_num) || isNaN(stock_num) || price_num < 0 || stock_num < 0) {
    const product_again = await Product.findById(id);                          // Para rellenar
    return res.status(400).render('products/form', {                           // Re-render con error
      token: res.locals.rotated_token,                                         // Token
      csrf_token: generate_csrf_token(),                                       // Nuevo CSRF
      admin_email: res.locals.admin_claims?.email || '',                       // Header
      mode: 'edit',
      error_msg: 'Campos inválidos (price/stock >= 0, name requerido).',
      product: {
        _id: id,
        name: name || (product_again?.name || ''),
        description,
        price,
        stock,
        is_active: is_active === 'on'
      }
    });
  }

  await Product.findByIdAndUpdate(id, {                                        // Update en Mongo
    name,
    description: description || '',
    price: price_num,
    stock: stock_num,
    is_active: is_active === 'on',
    updated_at: new Date()
  });

  return res.redirect(`/products?token=${res.locals.rotated_token}`);          // Volvemos a la lista
}

// Borrar (POST /products/:id/delete)
async function delete_product(req, res) {                                      // Handler delete
  const { id } = req.params;                                                   // ID
  const { csrf_token } = req.body;                                             // CSRF del form
  if (!verify_and_consume_csrf_token(csrf_token)) {                            // Validamos CSRF
    return res.status(403).send('CSRF inválido');                              // Error
  }
  await Product.findByIdAndDelete(id);                                         // Borramos doc
  return res.redirect(`/products?token=${res.locals.rotated_token}`);          // Volvemos a la lista
}

// Subir/actualizar imagen (POST /products/:id/image)
async function upload_image(req, res) {                                        // Handler de imagen
  const { id } = req.params;                                                   // ID del producto
  const { csrf_token } = req.body;                                             // CSRF
  if (!verify_and_consume_csrf_token(csrf_token)) {                            // Validamos CSRF
    return res.status(403).send('CSRF inválido');                              // Error
  }
  if (!req.file) {                                                             // Si no hay archivo
    return res.status(400).send('No se recibió archivo');                      // 400
  }
  const public_path = `/uploads/${req.file.filename}`;                          // Ruta pública
  await Product.findByIdAndUpdate(id, { image_path: public_path, updated_at: new Date() }); // Guardamos

  return res.redirect(`/products?token=${res.locals.rotated_token}`);          // Volvemos a la lista
}

module.exports = {
  list_products,
  new_product_form,
  create_product,
  edit_product_form,
  update_product,
  delete_product,
  upload_image
};
