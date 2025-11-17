// deliverController.js — marcar entregado (transacción: baja stock + mueve snapshot)

// Importamos mongoose para manejar sesiones/transacciones con MongoDB
const mongoose = require('mongoose');
// Importamos el modelo de pedidos activos (orders)
const Order    = require('../models/Order');
// Importamos el modelo de productos (para descontar stock)
const Product  = require('../models/Product');
// Importamos el modelo de entregas (histórico/snapshot)
const Delivery = require('../models/Delivery');
// Importamos helpers de CSRF (verificación y generación de nuevos tokens)
const { verify_and_consume_csrf_token, generate_csrf_token } = require('../middleware/csrf');

/**
 * POST /orders/:id/deliver
 * - Descuenta stock de cada item (en una transacción)
 * - Copia snapshot a "deliveries"
 * - Borra de "orders"
 * - En caso de error, vuelve al detalle con mensaje y CSRF nuevo (mejor UX)
 */
async function mark_as_delivered(req, res) {
  const { id } = req.params;          // Tomamos el id del pedido desde la URL
  const { csrf_token } = req.body;    // Tomamos el token CSRF enviado por el formulario

  // 1) CSRF (single-use)
  // Verificamos que el token CSRF sea válido y, si lo es, lo consumimos (deja de ser reutilizable)
  if (!verify_and_consume_csrf_token(csrf_token)) {
    return res.status(403).send('CSRF inválido.'); // Si es inválido, devolvemos 403
  }

  // 2) Abrimos sesión para la transacción
  // Creamos una sesión de mongoose para agrupar todas las operaciones en una transacción
  const session = await mongoose.startSession();
  try {
    // Ejecutamos un bloque transaccional: si algo falla, se hace rollback automático
    await session.withTransaction(async () => {
      // Buscamos el pedido dentro de la sesión (participa de la transacción)
      const order = await Order.findById(id).session(session);
      if (!order) throw new Error('Pedido no encontrado'); // Si no existe, cortamos con error

      const stock_delta = []; // Acá registraremos cuánto stock se descontó por producto (para auditar)

      // Recorremos cada item del pedido para actualizar stock de productos
      for (const it of order.items) {
        // Tolerancia a pedidos viejos: si no viene product_id, buscamos por nombre.
        let prod = null; // Referencia al producto real en la colección products
        if (it.product_id) {
          // Caso ideal: tenemos el ObjectId del producto en el item
          prod = await Product.findById(it.product_id).session(session);
        } else {
          // Fallback: buscamos por nombre (posible en pedidos viejos)
          prod = await Product.findOne({ name: it.name }).session(session);
        }

        // Si no existe el producto, no podemos continuar
        if (!prod) {
          throw new Error(`Producto ${it.product_id || it.name} no existe`);
        }
        // Validamos que haya stock suficiente para descontar la cantidad solicitada
        if (prod.stock < it.qty) {
          throw new Error(`Stock insuficiente para ${prod.name}`);
        }

        // Descontamos el stock en memoria
        prod.stock -= it.qty;
        // Guardamos el cambio dentro de la transacción
        await prod.save({ session });

        // Registramos el delta de stock aplicado (para guardarlo en deliveries como auditoría)
        stock_delta.push({ product_id: prod._id, qty: it.qty });
      }

      // Preparamos metadatos de fecha para facilitar futuros análisis (por día/mes/año)
      const now = new Date();
      const day   = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const month = now.toISOString().slice(0, 7);  // YYYY-MM
      const year  = now.getFullYear();              // YYYY (numérico)

      // Insertamos el snapshot del pedido entregado en la colección "deliveries"
      await Delivery.create([{
        order_id: order._id,            // Referencia al pedido original
        items: order.items,             // Copia de los items (snapshot del momento de entrega)
        total: order.total,             // Total en ese momento
        buyer_name: order.buyer_name,   // Datos del cliente (snapshot)
        address: order.address,
        igloo_sector: order.igloo_sector,
        email: order.email,
        delivered_at: now,              // Timestamp exacto de la entrega
        status_at_delivery: 'entregado',// Etiqueta fija para claridad histórica
        stock_delta,                    // Qué stock se descontó de cada producto
        day, month, year                // Campos de fecha desnormalizados para analytics
      }], { session });

      // Eliminamos el pedido de "orders" (ya no está activo)
      await Order.deleteOne({ _id: order._id }).session(session);
    });

    // Éxito → redirigimos con 303 (See Other) al listado de orders del admin
    // En la query string pasamos el token JWT rotado para evitar 401 al volver por POST-only
    return res.redirect(303, `/orders?token=${encodeURIComponent(res.locals.rotated_token)}`);
  } catch (err) {
    // withTransaction ya aborta automáticamente si hubo un throw dentro del callback
    // UX: Intentamos volver a la vista de detalle del pedido con un mensaje de error y un CSRF nuevo

    try {
      // Fuera de transacción, intentamos recuperar el pedido para re-renderizar la página de detalle
      const order = await Order.findById(id); // Si no existe, devolvemos 404
      if (!order) return res.status(404).send('Pedido no encontrado');

      // Renderizamos la vista 'orders/detail' con:
      // - token rotado (para navegar POST-only en admin)
      // - nuevo csrf_token (single-use)
      // - email del admin (si está disponible)
      // - el pedido y un mensaje de error friendly
      return res.status(400).render('orders/detail', {
        token: res.locals.rotated_token,
        csrf_token: generate_csrf_token(),
        admin_email: res.locals.admin_claims?.email || '',
        order,
        error_msg: `No se pudo entregar: ${err.message}`
      });
    } catch {
      // Si incluso el re-render falla, devolvemos un 400 con el mensaje simple
      return res.status(400).send(`No se pudo entregar: ${err.message}`);
    }
  } finally {
    // Cerramos la sesión de mongoose (libera recursos)
    session.endSession();
  }
}

// GET o POST /orders — lista los pedidos (con posible filtro)
async function list_orders_delivered(req, res) {
  try {
    console.log("Hola")
    // Se permite recibir el estado de filtro tanto por query string (?status=)
    // como por body (por si la vista lo manda como POST).

    // Si el estado existe, filtramos por ese campo; si no, devolvemos todos los pedidos

    // Buscamos en la colección "orders" y ordenamos los resultados por fecha de creación descendente
    const deliveries = await Delivery.find({}).sort({ delivered_at: -1 }).lean();
    console.log(deliveries);

    // Renderizamos la vista "orders/list.pug" pasando los datos al template
    return res.status(200).render('orders/deliver', {
      token: res.locals.rotated_token,              // JWT rotado que mantiene sesión segura en admin
      csrf_token: generate_csrf_token(),            // Token CSRF nuevo (single-use) para formularios
      admin_email: res.locals.admin_claims?.email || '', // Mostramos el email de Paula (si está logueada)
      deliveries,                                       // Lista de pedidos obtenidos de la DB
      auto_refresh_list: false                       // Flag opcional, si querés agregar <meta refresh> en la vista
    });
  } catch (err) {
    console.error('[deliveries] list error:', err.message);
    return res.status(500).send('Error al obtener las entregas');
  }
}

// Exportamos la función para usarla en la ruta POST /orders/:id/deliver
module.exports = { mark_as_delivered, list_orders_delivered };
