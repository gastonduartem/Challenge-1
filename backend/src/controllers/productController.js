// controllers/productController.js — CRUD de productos (SSR sin JS)

// Importamos el modelo Product para manipular los documentos en MongoDB
const Product = require('../models/Product');

// Importamos funciones CSRF: para generar tokens nuevos y verificar los que llegan del form
const { generate_csrf_token, verify_and_consume_csrf_token } = require('../middleware/csrf');


// GET /products — listar productos
async function list_products(req, res) {
  // Buscamos todos los productos en MongoDB ordenados por fecha de creación (más recientes primero)
  const products = await Product.find().sort({ created_at: -1 });

  // Renderizamos la vista "products/list.pug" pasando los datos necesarios
  return res.status(200).render('products/list', {
    token: res.locals.rotated_token,            // JWT rotado, usado para navegación segura del admin
    csrf_token: generate_csrf_token(),          // Token CSRF nuevo (protege formularios)
    admin_email: res.locals.admin_claims?.email || '', // Mostramos el email de Paula en el header
    products                                    // Lista de productos obtenidos de la DB
  });
}


// GET /products/new — formulario vacío para crear producto
async function new_product_form(req, res) {
  // Renderizamos el formulario en modo “crear”
  return res.status(200).render('products/form', {
    token: res.locals.rotated_token,
    csrf_token: generate_csrf_token(),
    admin_email: res.locals.admin_claims?.email || '',
    mode: 'create',                              // Modo “create” lo usa la vista para los textos/botones
    product: { name:'', description:'', price:'', stock:'', is_active:true } // Valores iniciales
  });
}


// POST /products — crear producto
async function create_product(req, res) {
  // Desestructuramos los campos del formulario (body)
  const { csrf_token, name, description, price, stock, is_active } = req.body;

  // Verificamos token CSRF para seguridad
  if (!verify_and_consume_csrf_token(csrf_token)) {
    return res.status(403).send('CSRF inválido'); // Si es inválido, devolvemos 403
  }

  // Convertimos precio y stock a número
  const price_num = Number(price);
  const stock_num = Number(stock);

  // Validamos campos mínimos (name requerido, price/stock válidos)
  if (!name || isNaN(price_num) || isNaN(stock_num) || price_num < 0 || stock_num < 0) {
    // Si algo falla, re-renderizamos el formulario con un mensaje de error
    return res.status(400).render('products/form', {
      token: res.locals.rotated_token,
      csrf_token: generate_csrf_token(),
      admin_email: res.locals.admin_claims?.email || '',
      mode: 'create',
      error_msg: 'Campos inválidos (price/stock >= 0, name requerido).',
      // Repoblamos los valores para que Paula no tenga que reescribirlos
      product: { name, description, price, stock, is_active: is_active === 'on' }
    });
  }

  // Si se subió imagen (via multer.single('image')), guardamos su ruta pública
  const imgPath = req.file ? `/uploads/${req.file.filename}` : undefined;

  // Creamos el documento del producto en MongoDB
  await Product.create({
    name,
    description: description || '',
    price: price_num,
    stock: stock_num,
    is_active: is_active === 'on', // Checkbox -> booleano
    image_path: imgPath,           // Guardamos la imagen si existe
    created_at: new Date(),        // Fecha de creación
    updated_at: new Date()         // Fecha de última modificación (igual al crear)
  });

  // Redirigimos al listado general de productos (manteniendo sesión por token)
  return res.redirect(`/products?token=${res.locals.rotated_token}`);
}


// GET /products/:id/edit — formulario de edición
async function edit_product_form(req, res) {
  const { id } = req.params;                // Tomamos el ID de la URL
  const product = await Product.findById(id); // Buscamos el producto en Mongo
  if (!product) return res.status(404).send('Producto no encontrado'); // 404 si no existe

  // Renderizamos el mismo form pero en modo “edit”
  return res.status(200).render('products/form', {
    token: res.locals.rotated_token,
    csrf_token: generate_csrf_token(),
    admin_email: res.locals.admin_claims?.email || '',
    mode: 'edit', // Usado en la vista para mostrar botones/textos correctos
    product       // Datos actuales del producto
  });
}


// POST /products/:id — actualizar producto existente
async function update_product(req, res) {
  const { id } = req.params;
  const { csrf_token, name, description, price, stock, is_active } = req.body;

  // Validamos CSRF
  if (!verify_and_consume_csrf_token(csrf_token)) {
    return res.status(403).send('CSRF inválido');
  }

  // Convertimos a número
  const price_num = Number(price);
  const stock_num = Number(stock);

  // Validamos datos igual que en create
  if (!name || isNaN(price_num) || isNaN(stock_num) || price_num < 0 || stock_num < 0) {
    // Recuperamos el producto actual para re-renderizarlo con el error
    const product_again = await Product.findById(id);
    return res.status(400).render('products/form', {
      token: res.locals.rotated_token,
      csrf_token: generate_csrf_token(),
      admin_email: res.locals.admin_claims?.email || '',
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

  // Si todo es válido, actualizamos en MongoDB
  await Product.findByIdAndUpdate(id, {
    name,
    description: description || '',
    price: price_num,
    stock: stock_num,
    is_active: is_active === 'on',
    updated_at: new Date()
  });

  // Redirigimos al listado general
  return res.redirect(`/products?token=${res.locals.rotated_token}`);
}


// POST /products/:id/delete — borrar producto
async function delete_product(req, res) {
  const { id } = req.params;
  const { csrf_token } = req.body;

  // Validamos CSRF
  if (!verify_and_consume_csrf_token(csrf_token)) {
    return res.status(403).send('CSRF inválido');
  }

  // Borramos el producto
  await Product.findByIdAndDelete(id);

  // Redirigimos a la lista
  return res.redirect(`/products?token=${res.locals.rotated_token}`);
}


// POST /products/:id/image — subir o reemplazar imagen
async function upload_image(req, res) {
  const { id } = req.params;
  const { csrf_token } = req.body;

  // Validamos CSRF
  if (!verify_and_consume_csrf_token(csrf_token)) {
    return res.status(403).send('CSRF inválido');
  }

  // Validamos que realmente se haya subido un archivo
  if (!req.file) {
    return res.status(400).send('No se recibió archivo');
  }

  // Calculamos la ruta pública de la imagen (dentro de /uploads)
  const public_path = `/uploads/${req.file.filename}`;

  // Actualizamos el campo image_path en el producto
  await Product.findByIdAndUpdate(id, {
    image_path: public_path,
    updated_at: new Date()
  });

  // Volvemos al listado
  return res.redirect(`/products?token=${res.locals.rotated_token}`);
}


// Exportación de controladores
module.exports = {
  list_products,       // Mostrar lista
  new_product_form,    // Mostrar formulario vacío
  create_product,      // Crear producto nuevo
  edit_product_form,   // Mostrar formulario de edición
  update_product,      // Actualizar existente
  delete_product,      // Eliminar producto
  upload_image         // Subir imagen
};
