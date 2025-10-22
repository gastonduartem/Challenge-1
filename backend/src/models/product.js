// Product.js — Modelo de producto (catálogo)

const mongoose = require('mongoose');                 // ODM para MongoDB

// Definimos el esquema usando snake_case y mezcla esp/ing
const product_schema = new mongoose.Schema({
  name: { type: String, required: true },             // Nombre del producto
  description: { type: String, default: '' },         // Descripción breve
  price: { type: Number, required: true, min: 0 },    // Precio en moneda local (entero/centavos)
  stock: { type: Number, required: true, min: 0 },    // Stock actual
  image_path: { type: String, default: '' },          // Ruta pública de la imagen (si existe)
  is_active: { type: Boolean, default: true },        // Producto activo o oculto
  created_at: { type: Date, default: Date.now },      // Fecha de creación
  updated_at: { type: Date, default: Date.now }       // Fecha de última actualización
});

// Hook: antes de guardar actualizamos updated_at
product_schema.pre('save', function(next){
  this.updated_at = new Date();                       // Seteamos updated_at al tiempo actual
  next();                                             // Continuamos el flujo
});

module.exports = mongoose.model('Product', product_schema); // Exportamos el modelo
