package handlers // paquete donde viven tus handlers HTTP

import (
	"context"       // manejar contexto y timeout
	"html/template" // tipo *template.Template
	"net/http"      // servidor y tipos HTTP
	"time"          // timeout para operaciones con la DB

	"go.mongodb.org/mongo-driver/bson"           // filtros BSON para Mongo
	"go.mongodb.org/mongo-driver/bson/primitive" // ObjectID de Mongo
	"go.mongodb.org/mongo-driver/mongo"          // tipo *mongo.Collection
)

// Item representa un item dentro de una orden (simplificado para el form)
type Item struct {
	ProductID primitive.ObjectID `bson:"product_id,omitempty"` // id del producto
	Name      string             `bson:"name"`                 // nombre del producto
	Qty       int                `bson:"qty"`                  // cantidad
	UnitPrice int                `bson:"unit_price"`           // precio unitario
	Subtotal  int                `bson:"subtotal"`             // subtotal
}

// Order representa el documento en la colección "orders"
type Order struct {
	ID        primitive.ObjectID `bson:"_id"`        // id de la orden
	BuyerName string             `bson:"buyer_name"` // nombre del cliente
	Address   string             `bson:"address"`    // dirección
	Email     string             `bson:"email"`      // email
	Status    string             `bson:"status"`     // estado (nuevo, en_proceso, etc.)
	Items     []Item             `bson:"items"`      // listado de items
	Total     int                `bson:"total"`      // total del pedido
}

// NewEdit arma el handler para GET/POST /edit?id=<id_orden>
// - ordersCol: colección "orders" de Mongo
// - tpl: template HTML para la vista de edición
func NewEdit(ordersCol *mongo.Collection, tpl *template.Template) http.HandlerFunc {
	// devolvemos una función que cumple con http.HandlerFunc
	return func(w http.ResponseWriter, r *http.Request) {
		// 1) Leer id del query: /edit?id=...
		idStr := r.URL.Query().Get("id") // obtenemos el valor de ?id=...
		if idStr == "" {
			// si no vino id, devolvemos error 400
			http.Error(w, "falta parámetro id", http.StatusBadRequest)
			return
		}

		// 2) Convertir el id string (hex) a ObjectID
		objID, err := primitive.ObjectIDFromHex(idStr) // parsea el string a ObjectID
		if err != nil {
			// si el formato no es válido, devolvemos error 400
			http.Error(w, "id inválido", http.StatusBadRequest)
			return
		}

		// 3) Crear contexto con timeout de 3 segundos
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second) // contexto con timeout
		defer cancel()                                                 // liberamos el contexto al salir

		// 4) Buscar la orden en Mongo por _id
		var order Order
		err = ordersCol.FindOne(ctx, bson.M{"_id": objID}).Decode(&order) // busca y decodifica en order
		if err != nil {
			// si no se encuentra o hay error, devolvemos 404
			http.Error(w, "pedido no encontrado", http.StatusNotFound)
			return
		}

		// 5) Regla de negocio: solo se puede editar si el estado es "nuevo"
		if order.Status != "nuevo" {
			// devolvemos 400 si el pedido no está en estado editable
			http.Error(w, "solo se pueden editar pedidos con estado 'nuevo'", http.StatusBadRequest)
			return
		}

		// 6) Si es GET → mostramos el formulario con los datos actuales
		if r.Method == http.MethodGet {
			// indicamos que vamos a devolver HTML
			w.Header().Set("Content-Type", "text/html; charset=utf-8")

			// ejecutamos el template pasando la order como data
			if err := tpl.Execute(w, order); err != nil {
				// si el template falla, devolvemos 500
				http.Error(w, "error al renderizar plantilla", http.StatusInternalServerError)
			}
			// salimos del handler
			return
		}

		// 7) Si es POST → procesamos el formulario y actualizamos la orden
		if r.Method == http.MethodPost {
			// parseamos el body del form (application/x-www-form-urlencoded)
			if err := r.ParseForm(); err != nil {
				// si falla el parse, devolvemos 400
				http.Error(w, "error al leer formulario", http.StatusBadRequest)
				return
			}

			// leemos los campos que permitimos editar
			newBuyerName := r.FormValue("buyer_name") // nuevo nombre
			newAddress := r.FormValue("address")      // nueva dirección

			// armamos el documento de actualización con $set
			update := bson.M{
				"$set": bson.M{
					"buyer_name": newBuyerName, // actualizamos nombre del comprador
					"address":    newAddress,   // actualizamos dirección
					// si quisieras, acá se agregan más campos editables
				},
			}

			// ejecutamos la actualización por _id
			_, err := ordersCol.UpdateByID(ctx, objID, update) // update de la orden
			if err != nil {
				// si hay error al actualizar, devolvemos 500
				http.Error(w, "error al actualizar pedido", http.StatusInternalServerError)
				return
			}

			// después de actualizar, redirigimos al panel de pedidos
			http.Redirect(w, r, "/orders", http.StatusFound) // 302 redirect
			return
		}

		// 8) Si el método no es GET ni POST → devolvemos 405
		http.Error(w, "método no permitido", http.StatusMethodNotAllowed)
	}
}
