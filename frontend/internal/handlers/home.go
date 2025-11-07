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
	type viewData struct {
		Products       []models.Product
		UploadsBase    string
		DefaultName    string
		DefaultEmail   string
		DefaultAddress string
	}

	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		// ⚠️ Proyectamos también _id porque la plantilla usa .ID.Hex
		cur, err := colProducts.Find(
			ctx,
			bson.M{"is_active": true},
			options.Find().SetProjection(bson.M{
				"_id":         1,
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

		data := viewData{
			Products:       products, // 👈 Mayúscula: coincide con la plantilla
			UploadsBase:    uploadsBase,
			DefaultName:    "",
			DefaultEmail:   "",
			DefaultAddress: "",
		}

		var buf bytes.Buffer
		// Si tu template tiene varios ficheros parseados, usa ExecuteTemplate
		if err := tmpl.ExecuteTemplate(&buf, "home.tmpl", data); err != nil {
			log.Printf("[tpl] home error: %v", err)
			http.Error(w, "error al renderizar la página", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = buf.WriteTo(w)
	}
}
