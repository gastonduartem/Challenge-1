// controllers/orderController.js — listar, ver detalle y cambiar estado de pedidos

// Importamos el modelo de pedidos (Order) para interactuar con MongoDB
const Order = require('../models/Order');
const Delivery = require('../models/Delivery')

// Importamos funciones CSRF: generar tokens nuevos y verificar los que vienen del formulario
const { generate_csrf_token, verify_and_consume_csrf_token } = require('../middleware/csrf');


// GET o POST /orders — lista los pedidos (con posible filtro)
async function list_orders(req, res) {
  // Se permite recibir el estado de filtro tanto por query string (?status=)
  // como por body (por si la vista lo manda como POST).
  const status = (req.query?.status ?? req.body?.status ?? '').trim();

  // Si el estado existe, filtramos por ese campo; si no, devolvemos todos los pedidos
  const query = status ? { status } : {};

  // Buscamos en la colección "orders" y ordenamos los resultados por fecha de creación descendente
  const orders = await Order.find(query).sort({ created_at: -1 });

  // Renderizamos la vista "orders/list.pug" pasando los datos al template
  return res.status(200).render('orders/list', {
    token: res.locals.rotated_token,              // JWT rotado que mantiene sesión segura en admin
    csrf_token: generate_csrf_token(),            // Token CSRF nuevo (single-use) para formularios
    admin_email: res.locals.admin_claims?.email || '', // Mostramos el email de Paula (si está logueada)
    status_selected: status,                      // Estado actual del filtro (para mantener selección)
    orders,                                       // Lista de pedidos obtenidos de la DB
    auto_refresh_list: true                       // Flag opcional, si querés agregar <meta refresh> en la vista
  });
}


// GET o POST /orders/:id — muestra el detalle de un pedido
async function order_detail(req, res) {
  const { id } = req.params;                      // Tomamos el ID del pedido desde la URL
  const order = await Order.findById(id);         // Buscamos el pedido en la DB por su ObjectId
  if (!order) return res.status(404).send('Pedido no encontrado'); // Si no existe, devolvemos 404

  // Si el pedido está en estado "en_camino", activamos un auto-refresh en la vista (para Paula)
  const auto_refresh = order.status === 'en_camino';

  // Renderizamos la plantilla "orders/detail.pug" con la información completa del pedido
  return res.status(200).render('orders/detail', {
    token: res.locals.rotated_token,              // JWT rotado del admin
    csrf_token: generate_csrf_token(),            // Token CSRF nuevo
    admin_email: res.locals.admin_claims?.email || '',
    order,                                        // El pedido encontrado
    auto_refresh                                 // Bandera usada por la vista para recargar automáticamente
  });
}


// POST /orders/:id/status — cambia el estado del pedido
async function change_status(req, res) {
  const { id } = req.params;                     // ID del pedido desde la URL
  const { csrf_token, next_status } = req.body;  // Datos enviados por el formulario (CSRF + nuevo estado)

  // Verificamos que el token CSRF sea válido y lo consumimos (solo puede usarse una vez)
  if (!verify_and_consume_csrf_token(csrf_token))
    return res.status(403).send('CSRF inválido'); // Si no es válido, devolvemos 403 (forbidden)

  // Definimos los estados permitidos (seguridad básica para evitar valores inválidos)
  const allowed = ['nuevo', 'preparando', 'en_camino'];
  if (!allowed.includes(next_status))
    return res.status(400).send('Estado no permitido'); // Si no está en la lista, devolvemos 400

  // Actualizamos el pedido por su ID con el nuevo estado
  // { new: true } hace que "updated" sea el documento ya actualizado
  const updated = await Order.findByIdAndUpdate(
    id,
    { status: next_status },
    { new: true }
  );

  // Si no se encontró el pedido, devolvemos 404
  if (!updated) return res.status(404).send('Pedido no encontrado');

  // PRG (Post-Redirect-Get): redirigimos al detalle del pedido con un redirect 303
  // Esto evita reenvíos del formulario al recargar la página.
  return res.status(303).redirect(`/orders/${id}?token=${res.locals.rotated_token}`);
}


// Exportamos las tres funciones para ser usadas en las rutas del panel admin
module.exports = { list_orders, order_detail, change_status };