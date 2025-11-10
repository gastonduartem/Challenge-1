// types.go — Definición de estructuras (modelos de datos)
// Este archivo define las "estructuras" (structs) que representan
// las colecciones de MongoDB en Go: Product, Item y Order.

package models

// "package models" indica que este archivo pertenece al paquete models.
// En Go, los archivos se agrupan por paquetes (como módulos o namespaces).

// Importaciones
import "go.mongodb.org/mongo-driver/bson/primitive"

// Importamos el paquete `primitive` del driver oficial de MongoDB para Go.
// Este paquete provee tipos especiales compatibles con MongoDB.
// Por ejemplo: `primitive.ObjectID` representa el tipo `_id` de MongoDB (el identificador único).

// STRUCT: Product — representa un documento en la colección "products"
type Product struct {
	ID primitive.ObjectID `bson:"_id"`
	// `primitive.ObjectID` es un tipo especial que Mongo usa como clave primaria.
	// Cada documento tiene un `_id` único, y este tipo lo representa en Go.
	// `bson:"_id"` es una etiqueta ("tag") que indica cómo se llama el campo en MongoDB.

	Name string `bson:"name"`
	// string normal (texto).
	// La etiqueta `bson:"name"` indica el nombre del campo en MongoDB.
	// Si no se pone etiqueta, Go usaría "Name" (con mayúscula), pero en Mongo las keys suelen ser minúsculas.

	Price int `bson:"price"`
	// int → número entero. Representa el precio del producto (en centavos o unidades).

	Description string `bson:"description"`
	// Texto descriptivo del producto.

	ImagePath string `bson:"image_path"`
	// Ruta pública a la imagen (por ejemplo: "/uploads/pescado.png").
	// MongoDB la guarda como texto simple.
}

// STRUCT: Item — representa un ítem dentro de un pedido
type Item struct {
	ProductID primitive.ObjectID `bson:"product_id,omitempty"`
	// `product_id` es el ID del producto asociado a este ítem.
	// `omitempty` significa: "si el valor está vacío, no lo guardes en Mongo".
	// Esto sirve para casos donde se guarda un pedido viejo sin ID.

	Name string `bson:"name"`
	// Nombre del producto (snapshot). Se guarda por redundancia para evitar lookup.

	Qty int `bson:"qty"`
	// Cantidad pedida de este producto.

	UnitPrice int `bson:"unit_price"`
	// Precio unitario al momento de hacer el pedido.

	Subtotal int `bson:"subtotal"`
	// qty * unit_price → total por este ítem.
}

// STRUCT: Order — representa un pedido completo
type Order struct {
	ID primitive.ObjectID `bson:"_id"`
	// ID único del pedido (generado por MongoDB automáticamente).

	BuyerName string `bson:"buyer_name"`
	// Nombre de quien hace el pedido (campo tipo string).

	Address string `bson:"address"`
	// Dirección o iglú donde se entregará el pedido.

	Email string `bson:"email"`
	// Correo del comprador.

	Status string `bson:"status"`
	// Estado actual del pedido: "nuevo", "preparando", "en_camino", etc.

	Items []Item `bson:"items"`
	// Slice (lista dinámica en Go) de `Item`.
	// Cada elemento representa un producto del pedido.
	// En Mongo se guarda como un array de subdocumentos.

	Total int `bson:"total"`
	// Total general del pedido (suma de todos los subtotales).
}
