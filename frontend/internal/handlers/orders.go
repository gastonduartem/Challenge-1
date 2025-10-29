package handlers

import (
	"context"
	"html/template"
	"net/http"
	"time"

	"github.com/gastonduartem/Challenge-1/frontend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// NewOrders maneja GET /orders (tablero público)
func NewOrders(colOrders *mongo.Collection, tmpl *template.Template) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		cur, err := colOrders.Find(ctx, bson.M{})
		if err != nil {
			http.Error(w, "error al obtener pedidos", http.StatusInternalServerError)
			return
		}
		defer cur.Close(ctx)

		var orders []models.Order
		if err := cur.All(ctx, &orders); err != nil {
			http.Error(w, "error al leer pedidos", http.StatusInternalServerError)
			return
		}

		data := map[string]any{"orders": orders}
		if err := tmpl.Execute(w, data); err != nil {
			http.Error(w, "error al renderizar pedidos", http.StatusInternalServerError)
			return
		}
	}
}
