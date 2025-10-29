package handlers

import (
	"bytes"
	"context"
	"html/template"
	"log"
	"net/http"
	"time"

	"github.com/gastonduartem/Challenge-1/frontend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// NewHome devuelve el handler GET "/" (lista de productos + datos del comprador)
func NewHome(colProducts *mongo.Collection, uploadsBase string, tmpl *template.Template) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		cur, err := colProducts.Find(
			ctx,
			bson.M{"is_active": true},
			options.Find().SetProjection(bson.M{
				"name":        1,
				"price":       1,
				"description": 1,
				"image_path":  1,
			}),
		)
		if err != nil {
			http.Error(w, "error al obtener productos", http.StatusInternalServerError)
			return
		}
		defer cur.Close(ctx)

		var products []models.Product
		if err := cur.All(ctx, &products); err != nil {
			http.Error(w, "error al leer productos", http.StatusInternalServerError)
			return
		}

		data := map[string]any{
			"products":       products,
			"uploadsBase":    uploadsBase,
			"defaultName":    "",
			"defaultEmail":   "",
			"defaultAddress": "",
		}

		var buf bytes.Buffer
		if err := tmpl.Execute(&buf, data); err != nil {
			log.Printf("[tpl] home error: %v", err)
			http.Error(w, "error al renderizar la página", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = buf.WriteTo(w)
	}
}
