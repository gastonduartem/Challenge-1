package main

import (
	"context"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gastonduartem/Challenge-1/frontend/internal/db"
	"github.com/gastonduartem/Challenge-1/frontend/internal/handlers"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("variable de entorno faltante: %s", key)
	}
	return v
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	// Cargar .env en desarrollo
	if os.Getenv("APP_ENV") != "production" {
		_ = godotenv.Load()
	}

	// Config
	portFrontend := getEnv("PORT_FRONTEND", "8081")
	mongoDB := getEnv("MONGO_DB", "penguin_shop")
	uploadsBase := getEnv("UPLOADS_BASE", "http://localhost:4100")

	var mongoURI string
	if os.Getenv("APP_ENV") == "production" {
		mongoURI = mustEnv("MONGO_URI")
	} else {
		mongoURI = getEnv("MONGO_URI", "mongodb://localhost:27017/penguin_shop?replicaSet=rs0")
	}
	log.Println("[debug] MONGO_URI =", mongoURI)

	// Conexión Mongo
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client, err := db.Connect(ctx, mongoURI)
	if err != nil {
		log.Fatalf("[mongo] error: %v", err)
	}
	defer func() { _ = client.Disconnect(context.Background()) }()
	log.Println("✅ Conexión exitosa con MongoDB:", mongoDB)

	// Colecciones
	database := client.Database(mongoDB)
	colProducts := database.Collection("products")
	colOrders := database.Collection("orders")
	colDeliveries := database.Collection("deliveries")

	// FuncMap compartido para templates
	funcs := template.FuncMap{
		"hex":       func(id primitive.ObjectID) string { return id.Hex() },
		"fmtNumber": func(n int) string { return fmt.Sprintf("%d", n) },
		"last4": func(id primitive.ObjectID) string {
			h := id.Hex()
			if len(h) >= 4 {
				return h[len(h)-4:]
			}
			return h
		},
	}

	// Parseo de templates (una sola vez, ANTES de usarlos)
	tmpls := template.Must(template.New("").Funcs(funcs).ParseFiles(
		"internal/templates/home.tmpl",
		"internal/templates/orders_board.tmpl",
		"internal/templates/order_status.tmpl",
	))
	homeTmpl := tmpls.Lookup("home.tmpl")
	ordersTmpl := tmpls.Lookup("orders_board.tmpl")
	statusTmpl := tmpls.Lookup("order_status.tmpl")

	// Inyección de dependencias para /orders (usa el template ya parseado)
	deps := &handlers.OrdersDeps{
		OrdersCol: colOrders,
		Tpl:       ordersTmpl,
	}

	// Rutas
	http.HandleFunc("/", handlers.NewHome(colProducts, uploadsBase, homeTmpl))
	http.HandleFunc("/checkout", handlers.NewCheckout(colProducts, colOrders))
	http.HandleFunc("/orders", deps.OrdersBoard) // ← ÚNICA definición de /orders
	http.HandleFunc("/status/", handlers.NewStatus(colOrders, colDeliveries, statusTmpl))

	// Health
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	addr := ":" + portFrontend
	log.Printf("[frontend] escuchando en http://localhost%s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("error del servidor: %v", err)
	}
}
