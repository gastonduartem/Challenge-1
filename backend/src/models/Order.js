// Order.js — pedidos activos (operativa)

// Importamos Mongoose, que nos permite definir esquemas y modelos para MongoDB
const mongoose = require('mongoose');


// Subdocumento: order_item_schema
// Representa cada producto incluido en un pedido.
// Es un "snapshot" de cómo era el producto en el momento de la compra
// (por si su precio o nombre cambian en el futuro).
const order_item_schema = new mongoose.Schema({
  // ID del producto original (referencia al modelo Product)
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },

  // Nombre del producto (guardado como estaba al momento de la compra)
  name:       { type: String, required: true },

  // Cantidad de unidades pedidas de ese producto
  qty:        { type: Number, required: true, min: 1 },

  // Precio unitario al momento de la compra (snapshot)
  unit_price: { type: Number, required: true, min: 0 },

  // Subtotal = qty * unit_price
  subtotal:   { type: Number, required: true, min: 0 }

  // _id: false → desactiva el _id automático para cada subdocumento del array
}, { _id: false });


// Esquema principal: order_schema
// Representa los pedidos "activos" en la tienda (todavía no entregados).
const order_schema = new mongoose.Schema({
  // Array de productos incluidos en el pedido
  items: { type: [order_item_schema], required: true },

  // Total general del pedido (sumatoria de subtotales)
  total: { type: Number, required: true, min: 0 },

  // Datos del comprador
  buyer_name:   { type: String, required: true },  // Nombre del cliente
  address:      { type: String, required: true },  // Dirección del iglú
  igloo_sector: { type: String, default: '' },     // Sector opcional (por si quieren agrupar zonas)
  email:        { type: String, required: true },  // Email del cliente

  // Estado actual del pedido
  // "nuevo" → pedido recién creado
  // "preparando" → en proceso
  // "en_camino" → ya enviado
  status: {
    type: String,
    enum: ['nuevo', 'preparando', 'en_camino'],   // Solo se permiten estos valores
    default: 'nuevo'                              // Valor inicial
  },

  // Fecha de creación del pedido (por defecto: hora actual)
  created_at: { type: Date, default: Date.now }
});


// Exportación del modelo
// Creamos y exportamos el modelo "Order"
// Los documentos se guardarán en la colección "orders"
module.exports = mongoose.model('Order', order_schema);
