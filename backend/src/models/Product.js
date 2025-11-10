// Product.js — Modelo de producto (catálogo)

// Importamos Mongoose, que nos permite definir esquemas (schemas)
// y modelos para interactuar con MongoDB de forma estructurada.
const mongoose = require('mongoose');


// Definición del esquema de producto
// Este esquema define cómo se guarda cada producto en la base de datos.
// Se usa snake_case en los nombres para mantener consistencia.
const product_schema = new mongoose.Schema({
  // Nombre del producto (obligatorio)
  name: { type: String, required: true },

  // Descripción breve o detalle adicional del producto
  description: { type: String, default: '' },

  // Precio en la moneda local. Puede ser entero o decimal (centavos)
  // Se valida que no sea negativo.
  price: { type: Number, required: true, min: 0 },

  // Stock disponible actualmente
  stock: { type: Number, required: true, min: 0 },

  // Ruta pública a la imagen (por ejemplo: "/uploads/pescado-fresco.png")
  image_path: { type: String, default: '' },

  // Flag que indica si el producto está activo (visible en la tienda)
  // Si es false, se oculta del catálogo público.
  is_active: { type: Boolean, default: true },

  // Fecha de creación (se asigna automáticamente al crear el documento)
  created_at: { type: Date, default: Date.now },

  // Fecha de última modificación (se actualiza en cada guardado)
  updated_at: { type: Date, default: Date.now }
});


// Hook pre-save
// Este "hook" (middleware interno de Mongoose) se ejecuta
// automáticamente antes de guardar un documento en la base de datos.
// Sirve para actualizar el campo `updated_at` cada vez que se modifica el producto.
product_schema.pre('save', function(next) {
  this.updated_at = new Date(); // Actualizamos la fecha
  next();                       // Continuamos con el guardado
});


// Exportación del modelo
// Creamos el modelo "Product" basado en el esquema definido.
// Esto genera (si no existe) la colección "products" en MongoDB.
// Luego se usa en controladores para crear, leer, editar o eliminar productos.
module.exports = mongoose.model('Product', product_schema);
