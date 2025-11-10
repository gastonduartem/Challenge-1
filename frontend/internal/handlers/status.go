// status.go — handler SSR para consultar el estado de un pedido (GET /status/:id)

package handlers // Paquete donde agrupamos los controladores HTTP del front

import (
	"context"       // context.Context: controla cancelación/timeouts que viajan con la request
	"html/template" // html/template: motor de plantillas SSR seguro (escapa HTML)
	"net/http"      // net/http: servidor HTTP estándar (Request/Response)
	"time"          // time: duraciones y deadlines (timeouts en DB)

	"go.mongodb.org/mongo-driver/bson"           // bson: documento estilo JSON para filtros/decodificación
	"go.mongodb.org/mongo-driver/bson/primitive" // primitive: tipos especiales (ObjectID, etc.) de Mongo
	"go.mongodb.org/mongo-driver/mongo"          // mongo: cliente/colección/métodos
)

// NewStatus construye un handler para GET /status/:id
// Recibe:
//   - colOrders: colección "orders" (pedidos activos)
//   - colDeliveries: colección "deliveries" (pedidos entregados/histórico)
//   - tmpl: plantilla HTML ya parseada (usada para renderizar el estado)
func NewStatus(colOrders, colDeliveries *mongo.Collection, tmpl *template.Template) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) { // w: respuesta al cliente | r: request entrante
		// Validación básica de ruta sin router: chequeamos que empiece con "/status/"
		if len(r.URL.Path) < len("/status/") || r.URL.Path[:8] != "/status/" {
			http.NotFound(w, r) // 404 si la ruta no cumple el patrón esperado
			return
		}
		// Extraemos la parte de la URL que viene después de "/status/" → el id en hex
		idHex := r.URL.Path[len("/status/"):]
		// Convertimos el id hex a ObjectID real de Mongo (24 chars hex → ObjectID binario)
		oid, err := primitive.ObjectIDFromHex(idHex)
		if err != nil {
			http.Error(w, "ID de pedido inválido", http.StatusBadRequest) // 400 si el formato no es válido
			return
		}

		// Contexto con timeout de 3s (si la DB tarda más, se cancela)
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		// Intentamos encontrar el pedido en la colección de "orders" (activos)
		var order bson.M // bson.M = map[string]interface{} → documento genérico
		if err := colOrders.FindOne(ctx, bson.M{"_id": oid}).Decode(&order); err == nil {
			// Si existe como pedido activo, armamos el "view model" para el template
			data := map[string]any{ // any (alias de interface{}) acepta cualquier tipo
				"order_id":     idHex,           // mostramos el id en hex (amigable para la URL)
				"status":       order["status"], // estado actual (nuevo/preparando/en_camino)
				"items":        order["items"],  // array de items (vendrá como []interface{} con subdocs)
				"total":        order["total"],  // total del pedido
				"buyer_name":   order["buyer_name"],
				"address":      order["address"],
				"email":        order["email"],
				"auto_refresh": true, // mientras esté activo, habilitamos auto-refresh en la vista
			}
			_ = tmpl.Execute(w, data) // Renderizamos la plantilla directamente al ResponseWriter
			return                    // Listo: ya respondimos
		}

		// Si NO está en "orders", buscamos en "deliveries" por order_id (lo guardamos al entregar)
		var delivered bson.M
		if err := colDeliveries.FindOne(ctx, bson.M{"order_id": oid}).Decode(&delivered); err != nil {
			http.Error(w, "pedido no encontrado", http.StatusNotFound) // 404 si no existe en ningún lado
			return
		}
		// Si está en deliveries, el estado es "entregado" y ya no auto-refrescamos
		data := map[string]any{
			"order_id":     idHex,
			"status":       "entregado",
			"items":        delivered["items"],
			"total":        delivered["total"],
			"buyer_name":   delivered["buyer_name"],
			"address":      delivered["address"],
			"email":        delivered["email"],
			"auto_refresh": false,
		}
		_ = tmpl.Execute(w, data) // Render SSR final
	}
}
