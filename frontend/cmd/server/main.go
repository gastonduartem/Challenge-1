// main.go — punto de arranque del frontend SSR en Go (tienda de los pingüinos)

package main // paquete principal: obligatorio para programas ejecutables en Go

import (
	"context"       // context.Context: manejar cancelaciones y timeouts
	"fmt"           // fmt: formatear strings (usado para números en templates)
	"html/template" // html/template: motor SSR nativo, seguro ante inyección HTML
	"log"           // log: registro de eventos y errores
	"net/http"      // net/http: servidor HTTP estándar
	"os"            // os: leer variables de entorno (APP_ENV, etc.)
	"time"          // time: duraciones, timeouts y timestamps

	// Paquetes internos del proyecto
	"github.com/gastonduartem/Challenge-1/frontend/internal/db"       // conexión a MongoDB
	"github.com/gastonduartem/Challenge-1/frontend/internal/handlers" // controladores HTTP (home, checkout, etc.)
	"github.com/joho/godotenv"                                        // carga variables desde archivo .env
	"go.mongodb.org/mongo-driver/bson/primitive"                      // tipos especiales de Mongo (ObjectID)
)

// FUNCIONES AUXILIARES

// mustEnv → lee una variable de entorno y falla (log.Fatal) si no existe.
// Se usa para variables que son OBLIGATORIAS en producción.
func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("variable de entorno faltante: %s", key)
	}
	return v
}

// getEnv → lee una variable de entorno y, si no existe, devuelve un valor por defecto.
// Muy útil en desarrollo (para no romper si falta el .env).
func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// FUNCIÓN MAIN

func main() {
	// Si no estamos en producción, cargamos el archivo .env
	// (en Docker las variables vienen del entorno, así que no hace falta cargarlo)
	if os.Getenv("APP_ENV") != "production" {
		_ = godotenv.Load() // ignora el error si el archivo no existe
	}

	// CONFIGURACIÓN

	portFrontend := getEnv("PORT_FRONTEND", "8081")                // Puerto del servidor (por defecto 8081)
	mongoDB := getEnv("MONGO_DB", "penguin_shop")                  // Nombre de la base de datos
	uploadsBase := getEnv("UPLOADS_BASE", "http://localhost:4100") // URL base para imágenes

	var mongoURI string
	if os.Getenv("APP_ENV") == "production" {
		mongoURI = mustEnv("MONGO_URI") // obligatorio en producción
	} else {
		mongoURI = getEnv("MONGO_URI", "mongodb://localhost:27017/penguin_shop?replicaSet=rs0")
	}
	log.Println("[debug] MONGO_URI =", mongoURI) // Log de depuración

	// CONEXIÓN A MONGODB

	// Creamos un contexto con timeout de 10 segundos para el handshake inicial
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// db.Connect encapsula mongo.Connect + Ping
	client, err := db.Connect(ctx, mongoURI)
	if err != nil {
		log.Fatalf("[mongo] error: %v", err) // Fatal → corta la ejecución
	}
	// Al salir, desconectamos para liberar recursos
	defer func() { _ = client.Disconnect(context.Background()) }()
	log.Println("✅ Conexión exitosa con MongoDB:", mongoDB)

	// Obtenemos las colecciones de la base de datos
	database := client.Database(mongoDB)
	colProducts := database.Collection("products")
	colOrders := database.Collection("orders")
	colDeliveries := database.Collection("deliveries")

	// TEMPLATE FUNC MAP

	// FuncMap: mapa de funciones que podemos usar dentro de los templates HTML
	funcs := template.FuncMap{
		// "hex": convierte un ObjectID en su representación hexadecimal (24 chars)
		"hex": func(id primitive.ObjectID) string { return id.Hex() },

		// "fmtNumber": formatea un número como string (para mostrar precios)
		"fmtNumber": func(n int) string { return fmt.Sprintf("%d", n) },

		// "last4": devuelve los últimos 4 caracteres del ObjectID (ID corto visual)
		"last4": func(id primitive.ObjectID) string {
			h := id.Hex()
			if len(h) >= 4 {
				return h[len(h)-4:]
			}
			return h
		},
	}

	// PARSEO DE TEMPLATES

	// ParseFiles: carga y analiza múltiples archivos de plantilla.
	// template.Must → paniquea si hay error al parsear (útil para detectar errores al inicio).
	tmpls := template.Must(template.New("").Funcs(funcs).ParseFiles(
		"internal/templates/home.tmpl",
		"internal/templates/orders_board.tmpl",
		"internal/templates/order_status.tmpl",
		"internal/templates/edit.tmpl",
	))

	// Lookup obtiene cada subplantilla por nombre exacto
	homeTmpl := tmpls.Lookup("home.tmpl")
	ordersTmpl := tmpls.Lookup("orders_board.tmpl")
	statusTmpl := tmpls.Lookup("order_status.tmpl")
	editTmpl := tmpls.Lookup("edit.tmpl")
	// INYECCIÓN DE DEPENDENCIAS

	// Creamos una estructura que agrupa lo que el handler de /orders necesita.
	deps := &handlers.OrdersDeps{
		OrdersCol: colOrders,
		Tpl:       ordersTmpl,
	}

	// DEFINICIÓN DE RUTAS

	http.HandleFunc("/", handlers.NewHome(colProducts, uploadsBase, homeTmpl))
	http.HandleFunc("/checkout", handlers.NewCheckout(colProducts, colOrders))
	http.HandleFunc("/orders", deps.OrdersBoard) // handler de panel público de pedidos
	http.HandleFunc("/status/", handlers.NewStatus(colOrders, colDeliveries, statusTmpl))
	http.HandleFunc("/edit", handlers.NewEdit(colOrders, editTmpl))

	// Health check → endpoint simple para verificar si el servidor responde
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	// ARRANQUE DEL SERVIDOR

	addr := ":" + portFrontend
	log.Printf("[frontend] escuchando en http://localhost%s", addr)

	// http.ListenAndServe bloquea y atiende todas las requests entrantes.
	// El segundo parámetro nil usa el DefaultServeMux (donde registramos las rutas).
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("error del servidor: %v", err)
	}
}
