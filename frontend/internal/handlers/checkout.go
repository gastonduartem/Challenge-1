package handlers

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gastonduartem/Challenge-1/frontend/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// NewCheckout maneja POST /checkout (crea pedido con múltiples ítems)
func NewCheckout(colProducts, colOrders *mongo.Collection) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "solo se acepta POST", http.StatusMethodNotAllowed)
			return
		}
		if err := r.ParseForm(); err != nil {
			http.Error(w, "form inválido", http.StatusBadRequest)
			return
		}

		buyer := strings.TrimSpace(r.FormValue("buyer_name"))
		address := strings.TrimSpace(r.FormValue("address"))
		email := strings.TrimSpace(r.FormValue("email"))
		if buyer == "" || address == "" || email == "" {
			http.Error(w, "completá nombre, dirección y email", http.StatusBadRequest)
			return
		}

		var items []models.Item
		total := 0

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		for key, vals := range r.Form {
			if !strings.HasPrefix(key, "qty_") || len(vals) == 0 {
				continue
			}
			qty, _ := strconv.Atoi(vals[0])
			if qty <= 0 {
				continue
			}

			idHex := strings.TrimPrefix(key, "qty_")
			oid, err := primitive.ObjectIDFromHex(idHex)
			if err != nil {
				continue
			}

			// Traemos nombre y precio confiables desde la DB
			var p struct {
				Name  string `bson:"name"`
				Price int    `bson:"price"`
			}
			if err := colProducts.FindOne(ctx, bson.M{"_id": oid}).Decode(&p); err != nil {
				continue
			}

			sub := p.Price * qty
			total += sub

			// ✅ Guardamos también el ID del producto que pide el backend del admin
			items = append(items, models.Item{
				ProductID: oid,
				Name:      p.Name,
				Qty:       qty,
				UnitPrice: p.Price,
				Subtotal:  sub,
			})
		}

		if len(items) == 0 {
			http.Error(w, "elegí al menos un producto", http.StatusBadRequest)
			return
		}

		order := bson.M{
			"items":        items,
			"total":        total,
			"buyer_name":   buyer,
			"address":      address,
			"igloo_sector": "",
			"email":        email,
			"status":       "nuevo",
			"created_at":   time.Now(),
		}

		if _, err := colOrders.InsertOne(ctx, order); err != nil {
			http.Error(w, "no se pudo crear el pedido", http.StatusInternalServerError)
			return
		}

		http.Redirect(w, r, "/orders", http.StatusSeeOther)
	}
}
