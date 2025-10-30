// orders.go
package handlers

import (
	"bytes"
	"context"
	"html/template"
	"log"
	"net/http"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// Inyecta dependencias desde main
type OrdersDeps struct {
	OrdersCol *mongo.Collection
	Tpl       *template.Template // tu template ya parseado: orders_board.tmpl
}

func (d *OrdersDeps) OrdersBoard(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	type Item struct {
		Name string `bson:"name"`
		Qty  int    `bson:"qty"`
	}
	type Order struct {
		ID        primitive.ObjectID `bson:"_id"`
		BuyerName string             `bson:"buyer_name"`
		Status    string             `bson:"status"`
		Items     []Item             `bson:"items"`
		ShortID   string
	}

	cur, err := d.OrdersCol.Find(ctx, bson.M{})
	if err != nil {
		http.Error(w, "error al obtener pedidos", http.StatusInternalServerError)
		return
	}
	defer cur.Close(ctx)

	var orders []Order
	if err := cur.All(ctx, &orders); err != nil {
		http.Error(w, "error al leer pedidos", http.StatusInternalServerError)
		return
	}
	for i := range orders {
		hex := orders[i].ID.Hex()
		if len(hex) > 4 {
			orders[i].ShortID = hex[len(hex)-4:]
		} else {
			orders[i].ShortID = hex
		}
	}

	// 👉 Renderiza a buffer: si falla, todavía no escribiste nada
	var buf bytes.Buffer
	if err := d.Tpl.Execute(&buf, map[string]any{"orders": orders}); err != nil {
		log.Printf("[tpl] orders_board error: %v", err)
		http.Error(w, "error al renderizar pedidos", http.StatusInternalServerError)
		return
	}

	// 👉 Solo acá escribís headers y cuerpo
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = buf.WriteTo(w)
}
