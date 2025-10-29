// orderController.js — listar, detalle, cambiar estado

const Order = require('../models/Order'); // modelo de pedidos
const { generate_csrf_token, verify_and_consume_csrf_token } = require('../middleware/csrf'); // CSRF

// POST /orders — listado con filtro opcional
async function list_orders(req, res) {
  const { status } = req.body;                       // filtro opcional
  const query = status ? { status } : {};            // armamos query
  const orders = await Order.find(query).sort({ created_at: -1 }); // ordenamos
  return res.status(200).render('orders/list', {     // render SSR
    token: res.locals.rotated_token,                 // JWT rotado
    csrf_token: generate_csrf_token(),               // CSRF
    status_selected: status || '',                   // estado elegido (UI)
    orders                                           // data
  });
}

// POST /orders/:id — detalle
async function order_detail(req, res) {
  const { id } = req.params;                         // id desde ruta
  const order = await Order.findById(id);            // buscamos
  if (!order) return res.status(404).send('Pedido no encontrado'); // 404
  return res.status(200).render('orders/detail', {   // render detalle
    token: res.locals.rotated_token,                 // JWT rotado
    csrf_token: generate_csrf_token(),               // CSRF
    order                                            // data
  });
}

// POST /orders/:id/status — cambiar estado (sin entregar)
async function change_status(req, res) {
  const { id } = req.params;                         // id pedido
  const { csrf_token, next_status } = req.body;      // body

  if (!verify_and_consume_csrf_token(csrf_token))    // valida CSRF
    return res.status(403).send('CSRF inválido');    // error

  const allowed = ['nuevo','preparando','en_camino']; // estados permitidos
  if (!allowed.includes(next_status))                // valida estado
    return res.status(400).send('Estado no permitido');

  const updated = await Order.findByIdAndUpdate(id, { status: next_status }, { new: true }); // update
  if (!updated) return res.status(404).send('Pedido no encontrado'); // 404

  req.params.id = id;                                // reusamos detalle
  return order_detail(req, res);                     // render
}

module.exports = { list_orders, order_detail, change_status };
