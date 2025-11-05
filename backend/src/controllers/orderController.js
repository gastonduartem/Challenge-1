// controllers/orderController.js — listar, detalle, cambiar estado

const Order = require('../models/Order');
const { generate_csrf_token, verify_and_consume_csrf_token } = require('../middleware/csrf');

// GET/POST /orders — listado de pedidos
async function list_orders(req, res) {
  // Acepta filtro por query o body
  const status = (req.query?.status ?? req.body?.status ?? '').trim();
  const query = status ? { status } : {};

  const orders = await Order.find(query).sort({ created_at: -1 });

  return res.status(200).render('orders/list', {
    token: res.locals.rotated_token,
    csrf_token: generate_csrf_token(),
    admin_email: res.locals.admin_claims?.email || '',
    status_selected: status,
    orders,
    auto_refresh_list: true // si tu vista lo usa para <meta refresh>
  });
}

// GET/POST /orders/:id — detalle de pedido
async function order_detail(req, res) {
  const { id } = req.params;
  const order = await Order.findById(id);
  if (!order) return res.status(404).send('Pedido no encontrado');

  const auto_refresh = order.status === 'en_camino';

  return res.status(200).render('orders/detail', {
    token: res.locals.rotated_token,
    csrf_token: generate_csrf_token(),
    admin_email: res.locals.admin_claims?.email || '',
    order,
    auto_refresh
  });
}

// POST /orders/:id/status — cambiar estado (PRG)
async function change_status(req, res) {
  const { id } = req.params;
  const { csrf_token, next_status } = req.body;

  if (!verify_and_consume_csrf_token(csrf_token))
    return res.status(403).send('CSRF inválido');

  const allowed = ['nuevo','preparando','en_camino'];
  if (!allowed.includes(next_status))
    return res.status(400).send('Estado no permitido');

  const updated = await Order.findByIdAndUpdate(
    id,
    { status: next_status },
    { new: true }
  );
  if (!updated) return res.status(404).send('Pedido no encontrado');

  // PRG: redirigimos al detalle GET con el token rotado
  return res.status(303).redirect(`/orders/${id}?token=${res.locals.rotated_token}`);
}


module.exports = { list_orders, order_detail, change_status };
