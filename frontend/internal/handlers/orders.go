// orders.go
package handlers // Paquete donde viven los handlers HTTP (controladores SSR del front)

import (
	"bytes"         // bytes.Buffer: buffer en memoria para construir HTML antes de enviarlo
	"context"       // context.Context: permite timeouts/cancelación que viajan con la request
	"html/template" // html/template: motor de plantillas nativo (escapa HTML → seguro)
	"log"           // log: para loguear errores/diagnóstico en el servidor
	"net/http"      // net/http: servidor HTTP estándar (Request/Response)
	"time"          // time: manejar duraciones y deadlines (timeouts)

	"go.mongodb.org/mongo-driver/bson"           // bson: documento estilo JSON para filtros/proyecciones/updates
	"go.mongodb.org/mongo-driver/bson/primitive" // primitive: tipos especiales de Mongo (ObjectID, etc.)
	"go.mongodb.org/mongo-driver/mongo"          // mongo: cliente, colección, cursor y operaciones con MongoDB
)

// Inyecta dependencias desde main
type OrdersDeps struct {
	OrdersCol *mongo.Collection  // *mongo.Collection: referencia a la colección "orders" (DB)
	Tpl       *template.Template // Plantillas ya parseadas (incluye "orders_board.tmpl")
}

// OrdersBoard maneja la vista pública de pedidos (GET /orders)
func (d *OrdersDeps) OrdersBoard(w http.ResponseWriter, r *http.Request) {
	// context.WithTimeout: crea un contexto con deadline de 3s a partir de r.Context()
	// - Si el cliente se desconecta o el tiempo expira, las operaciones con este ctx se cancelan.
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel() // Liberamos recursos del contexto al salir

	// Tipos internos usados solo para mapear la consulta (proyección implícita por tags bson)
	type Item struct {
		Name string `bson:"name"` // Tag bson: nombre exacto del campo en el documento Mongo
		Qty  int    `bson:"qty"`  // Cantidad pedida de ese producto
	}
	type Order struct {
		ID        primitive.ObjectID `bson:"_id"`        // ObjectID de Mongo para el pedido
		BuyerName string             `bson:"buyer_name"` // Nombre del comprador
		Status    string             `bson:"status"`     // Estado: nuevo/preparando/en_camino
		Items     []Item             `bson:"items"`      // Slice (lista) de ítems
		ShortID   string             // Campo derivado (no en DB): últimas 4 chars del _id
	}

	// d.OrdersCol.Find: consulta todos los pedidos (filtro vacío bson.M{})
	// bson.M es map[string]interface{} → documento estilo JSON
	cur, err := d.OrdersCol.Find(ctx, bson.M{})
	if err != nil {
		http.Error(w, "error al obtener pedidos", http.StatusInternalServerError)
		return
	}
	defer cur.Close(ctx) // Siempre cerrar el cursor

	// cur.All: decodifica todos los documentos del cursor en el slice destino (&orders)
	var orders []Order
	if err := cur.All(ctx, &orders); err != nil {
		http.Error(w, "error al leer pedidos", http.StatusInternalServerError)
		return
	}

	// Post-proceso: generamos ShortID con las últimas 4 letras del ObjectID en hex
	for i := range orders {
		hex := orders[i].ID.Hex() // .Hex(): representación string hexadecimal del ObjectID
		if len(hex) > 4 {
			orders[i].ShortID = hex[len(hex)-4:] // últimas 4
		} else {
			orders[i].ShortID = hex // fallback si algo raro
		}
	}

	// Estructura con campo exportado (mayúscula) que la plantilla espera: .Orders
	data := struct {
		Orders []Order // Nombre exportado → accesible en template como {{ range .Orders }}
	}{
		Orders: orders,
	}

	// Render SSR en buffer: si falla, no enviamos HTML roto al cliente
	var buf bytes.Buffer
	// ExecuteTemplate: ejecuta por nombre exacto la sub-plantilla "orders_board.tmpl"
	if err := d.Tpl.ExecuteTemplate(&buf, "orders_board.tmpl", data); err != nil {
		log.Printf("[tpl] orders_board error: %v", err) // %v: imprime el valor del error en formato por defecto
		http.Error(w, "error al renderizar pedidos", http.StatusInternalServerError)
		return
	}

	// Cabecera de contenido y write del buffer a la respuesta
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = buf.WriteTo(w) // WriteTo copia el contenido del buffer a w; descartamos (n, err) con identificador en blanco
}
