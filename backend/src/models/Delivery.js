// Delivery.js — histórico inmutable (para analytics)

// Importamos Mongoose (ODM para MongoDB)
// Nos permite definir esquemas y modelos con validaciones y tipos.
const mongoose = require('mongoose');


// Sub-esquema: delivered_item_schema
// Representa cada ítem entregado dentro de una entrega (snapshot de los productos del pedido original)
const delivered_item_schema = new mongoose.Schema({
  // Referencia al producto original (por si se quiere enlazar o analizar a futuro)
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },

  // Nombre del producto en el momento de la entrega (por si cambia más adelante)
  name:       { type: String, required: true },

  // Cantidad entregada de ese producto
  qty:        { type: Number, required: true, min: 1 },

  // Precio unitario en el momento de la compra
  unit_price: { type: Number, required: true, min: 0 },

  // Subtotal (unit_price * qty)
  subtotal:   { type: Number, required: true, min: 0 }

  // `_id: false` → indica que este subdocumento no tendrá su propio _id generado automáticamente
}, { _id: false });


// Esquema principal: delivery_schema
// Representa una entrega finalizada (histórico, no se modifica).
const delivery_schema = new mongoose.Schema({
  // ID del pedido original (sirve para trazabilidad)
  order_id:    { type: mongoose.Schema.Types.ObjectId, required: true },

  // Array de productos entregados (snapshot de ese momento)
  items:       { type: [delivered_item_schema], required: true },

  // Total del pedido en el momento de la entrega
  total:       { type: Number, required: true, min: 0 },

  // Datos del comprador (se guardan como snapshot para no depender de otras tablas)
  buyer_name:  { type: String, required: true },
  address:     { type: String, required: true },
  igloo_sector:{ type: String, default: '' },
  email:       { type: String, required: true },

  // Fecha y hora exacta en la que se marcó como entregado
  delivered_at:{ type: Date, required: true },

  // Estado fijo al momento de entrega (por claridad semántica)
  status_at_delivery: { type: String, default: 'entregado' },


  // stock_delta: qué se descontó del stock de cada producto

  // Esto se usa para análisis o auditorías, por ejemplo:
  //  "cuántos ítems de cada producto se entregaron en el día"
  stock_delta: [{
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    qty:        { type: Number, required: true, min: 1 }
  }],


  // Campos de fecha desnormalizados

  // Sirven para agrupar por día/mes/año sin cálculos costosos posteriores.
  day:   { type: String, required: true },  // Ejemplo: "2025-11-07"
  month: { type: String, required: true },  // Ejemplo: "2025-11"
  year:  { type: Number, required: true }   // Ejemplo: 2025
});


// Exportación del modelo
// Creamos y exportamos el modelo "Delivery" asociado a la colección "deliveries"
// Cada documento representa una entrega finalizada (histórica e inmutable)
module.exports = mongoose.model('Delivery', delivery_schema);

