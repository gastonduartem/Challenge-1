package handlers

import (
	"context"
	"html/template"
	"net/http"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// NewStatus maneja GET /status/:id (estado de un pedido)
func NewStatus(colOrders, colDeliveries *mongo.Collection, tmpl *template.Template) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if len(r.URL.Path) < len("/status/") || r.URL.Path[:8] != "/status/" {
			http.NotFound(w, r)
			return
		}
		idHex := r.URL.Path[len("/status/"):]
		oid, err := primitive.ObjectIDFromHex(idHex)
		if err != nil {
			http.Error(w, "ID de pedido inválido", http.StatusBadRequest)
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		var order bson.M
		if err := colOrders.FindOne(ctx, bson.M{"_id": oid}).Decode(&order); err == nil {
			data := map[string]any{
				"order_id":     idHex,
				"status":       order["status"],
				"items":        order["items"],
				"total":        order["total"],
				"buyer_name":   order["buyer_name"],
				"address":      order["address"],
				"email":        order["email"],
				"auto_refresh": true,
			}
			_ = tmpl.Execute(w, data)
			return
		}

		var delivered bson.M
		if err := colDeliveries.FindOne(ctx, bson.M{"order_id": oid}).Decode(&delivered); err != nil {
			http.Error(w, "pedido no encontrado", http.StatusNotFound)
			return
		}
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
		_ = tmpl.Execute(w, data)
	}
}
