package main

import (
	"context"       // Para manejar cancelaciones y tiempos límite
	"fmt"           // Para imprimir logs formateados
	"html/template" // Motor de plantillas HTML (SSR nativo)
	"log"           // Logger básico
	"net/http"      // Servidor HTTP integrado en Go
	"os"            // Para leer variables de entorno
	"strconv"       // Para convertir strings a números
	"strings"       // Para manipular textos
	"time"          // Para timeouts y fechas

	"bytes"

	"github.com/joho/godotenv"                   // Librería que carga variables desde el archivo .env
	"go.mongodb.org/mongo-driver/bson"           // BSON: formato usado por MongoDB
	"go.mongodb.org/mongo-driver/bson/primitive" // Para usar ObjectIDs de Mongo
	"go.mongodb.org/mongo-driver/mongo"          // Driver oficial de MongoDB para Go (cliente)
	"go.mongodb.org/mongo-driver/mongo/options"  // Opciones de conexión para el driver de MongoDB
)

//
// UTILIDADES Y CONFIGURACIÓN BASE
//

// mustEnv: fuerza que una variable exista (útil en producción)
func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("variable de entorno faltante: %s", key)
	}
	return v
}

// getEnv: lee una variable del entorno, con valor por defecto si no existe
func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// connectMongo: conecta al servidor MongoDB y verifica con ping
func connectMongo(ctx context.Context, uri string) (*mongo.Client, error) {
	opts := options.Client().ApplyURI(uri)  // Aplica la URI (host, puerto, base, etc.)
	client, err := mongo.Connect(ctx, opts) // Crea la conexión
	if err != nil {
		return nil, err
	}
	if err := client.Ping(ctx, nil); err != nil { // Verifica que el servidor responda
		return nil, err
	}
	return client, nil
}

//
// VARIABLES GLOBALES (COLECCIONES Y CONFIG)
//

var (
	mongo_client   *mongo.Client
	col_products   *mongo.Collection
	col_orders     *mongo.Collection
	col_deliveries *mongo.Collection
	uploadsBase    string
	// ✅ URL base para archivos subidos (backend Node en :4100)
)

type Product struct {
	ID          primitive.ObjectID `bson:"_id"`
	Name        string             `bson:"name"`
	Price       int                `bson:"price"`
	Description string             `bson:"description"`
	ImagePath   string             `bson:"image_path"`
}

//
// TEMPLATES HTML (SSR SIN JS)
//

// FuncMap para los templates (convierte ObjectID a Hex y formatea números)
var tmplFuncs = template.FuncMap{
	"hex":       func(id primitive.ObjectID) string { return id.Hex() },
	"fmtNumber": func(n int) string { return fmt.Sprintf("%d", n) },
}

// Página principal: lista de productos
var homeTemplate = template.Must(
	template.New("home.tmpl").Funcs(tmplFuncs).ParseFiles("internal/templates/home.tmpl"),
)

// Pantalla pública con todos los pedidos activos
var ordersBoardTemplate = template.Must(
	template.New("orders_board.tmpl").Funcs(tmplFuncs).ParseFiles("internal/templates/orders_board.tmpl"),
)

// Estado individual de un pedido (con o sin auto-refresh)
var orderStatusTemplate = template.Must(
	template.New("order_status.tmpl").Funcs(tmplFuncs).ParseFiles("internal/templates/order_status.tmpl"),
)

//
// HANDLERS HTTP
//

// Handler raíz (home)
// Muestra la lista de productos disponibles para pedir
// Handler raíz (home)
// Muestra la lista de productos disponibles para pedir
func homeHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	// proyección: solo lo que necesitamos
	cur, err := col_products.Find(
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

	var products []Product
	if err := cur.All(ctx, &products); err != nil {
		http.Error(w, "error al leer productos", http.StatusInternalServerError)
		return
	}

	data := map[string]any{
		"products":    products,
		"uploadsBase": uploadsBase,
		// Defaults para el bloque de “Datos del comprador”
		"defaultName":    " ",
		"defaultAddress": " ",
		"defaultEmail":   " ",
	}

	// Render a un buffer para evitar “superfluous WriteHeader”
	var buf bytes.Buffer
	if err := homeTemplate.Execute(&buf, data); err != nil {
		log.Printf("[tpl] home error: %v", err)
		http.Error(w, "error al renderizar la página", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = buf.WriteTo(w)
}

// POST /checkout
// Crea un nuevo pedido en la colección "orders"
func checkoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "solo se acepta POST", http.StatusMethodNotAllowed)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "form inválido", http.StatusBadRequest)
		return
	}

	// Datos del comprador (una sola vez)
	buyer := strings.TrimSpace(r.FormValue("buyer_name"))
	address := strings.TrimSpace(r.FormValue("address"))
	email := strings.TrimSpace(r.FormValue("email"))
	if buyer == "" || address == "" || email == "" {
		http.Error(w, "completá nombre, dirección y email", http.StatusBadRequest)
		return
	}

	// Recorremos todas las cantidades: esperan name="qty_<productID>"
	type Item struct {
		Name      string `bson:"name"`
		Qty       int    `bson:"qty"`
		UnitPrice int    `bson:"unit_price"`
		Subtotal  int    `bson:"subtotal"`
	}
	var items []Item
	total := 0

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	for key, vals := range r.Form {
		if !strings.HasPrefix(key, "qty_") {
			continue
		}
		if len(vals) == 0 {
			continue
		}
		qty, _ := strconv.Atoi(vals[0])
		if qty <= 0 {
			continue // 0 = no lo incluye
		}

		idHex := strings.TrimPrefix(key, "qty_")
		oid, err := primitive.ObjectIDFromHex(idHex)
		if err != nil {
			continue
		}

		// Traemos el producto para obtener nombre y precio confiables
		var p struct {
			Name  string `bson:"name"`
			Price int    `bson:"price"`
		}
		if err := col_products.FindOne(ctx, bson.M{"_id": oid}).Decode(&p); err != nil {
			continue
		}

		sub := p.Price * qty
		total += sub
		items = append(items, Item{
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

	if _, err := col_orders.InsertOne(ctx, order); err != nil {
		http.Error(w, "no se pudo crear el pedido", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/orders", http.StatusSeeOther)
}

// GET /orders
// Muestra todos los pedidos activos (que aún no fueron entregados)
func ordersBoardHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	// Buscamos todos los pedidos activos
	cur, err := col_orders.Find(ctx, bson.M{})
	if err != nil {
		http.Error(w, "error al obtener pedidos", http.StatusInternalServerError)
		return
	}
	defer cur.Close(ctx)

	// Estructura local para el render
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

	var orders []Order
	if err := cur.All(ctx, &orders); err != nil {
		http.Error(w, "error al leer pedidos", http.StatusInternalServerError)
		return
	}

	// Creamos un ID corto visual (últimos 4 chars)
	for i := range orders {
		hex := orders[i].ID.Hex()
		if len(hex) > 4 {
			orders[i].ShortID = hex[len(hex)-4:]
		} else {
			orders[i].ShortID = hex
		}
	}

	// Renderizamos la tabla pública
	if err := ordersBoardTemplate.Execute(w, map[string]any{"orders": orders}); err != nil {
		http.Error(w, "error al renderizar pedidos", http.StatusInternalServerError)
	}
}

// GET /status/:id
// Muestra el estado de un pedido individual (se auto-actualiza hasta que sea entregado)
func orderStatusHandler(w http.ResponseWriter, r *http.Request) {
	// Extraemos el ID del pedido desde la URL
	if !strings.HasPrefix(r.URL.Path, "/status/") {
		http.NotFound(w, r)
		return
	}
	id_hex := strings.TrimPrefix(r.URL.Path, "/status/")
	oid, err := primitive.ObjectIDFromHex(id_hex)
	if err != nil {
		http.Error(w, "ID de pedido inválido", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	// Primero buscamos en "orders" (activos)
	var order bson.M
	err = col_orders.FindOne(ctx, bson.M{"_id": oid}).Decode(&order)
	if err == nil {
		// Si lo encontramos activo, seguimos refrescando
		short := oid.Hex()
		if len(short) >= 4 {
			short = short[len(short)-4:]
		}
		data := map[string]any{
			"order_id":     id_hex,
			"short_id":     short,
			"status":       order["status"],
			"items":        order["items"],
			"total":        order["total"],
			"buyer_name":   order["buyer_name"],
			"address":      order["address"],
			"email":        order["email"],
			"auto_refresh": true,
		}
		if err := orderStatusTemplate.Execute(w, data); err != nil {
			http.Error(w, "error al renderizar estado", http.StatusInternalServerError)
		}
		return
	}

	// Si no está activo, lo buscamos en "deliveries" (entregado)
	var delivered bson.M
	err = col_deliveries.FindOne(ctx, bson.M{"order_id": oid}).Decode(&delivered)
	if err != nil {
		http.Error(w, "pedido no encontrado", http.StatusNotFound)
		return
	}

	// Renderizamos como entregado (sin auto-refresh)
	short := oid.Hex()
	if len(short) >= 4 {
		short = short[len(short)-4:]
	}
	data := map[string]any{
		"order_id":     id_hex,
		"short_id":     short,
		"status":       "entregado",
		"items":        delivered["items"],
		"total":        delivered["total"],
		"buyer_name":   delivered["buyer_name"],
		"address":      delivered["address"],
		"email":        delivered["email"],
		"auto_refresh": false,
	}
	if err := orderStatusTemplate.Execute(w, data); err != nil {
		http.Error(w, "error al renderizar entregado", http.StatusInternalServerError)
	}
}

//
// MAIN: PUNTO DE ENTRADA DEL PROGRAMA
//

func main() {
	// Cargamos .env solo si NO estamos en producción
	if os.Getenv("APP_ENV") != "production" {
		_ = godotenv.Load() // carga variables de entorno desde .env
	}

	// Leemos variables de entorno
	port_frontend := getEnv("PORT_FRONTEND", "8080") // puerto por defecto
	mongo_db := getEnv("MONGO_DB", "penguin_shop")   // nombre DB

	// ✅ URL base para archivos subidos (los sirve el backend Node en :4100)
	uploadsBase = getEnv("UPLOADS_BASE", "http://localhost:4100")

	// Si estamos en producción, forzamos que exista MONGO_URI
	var mongo_uri string
	if os.Getenv("APP_ENV") == "production" {
		mongo_uri = mustEnv("MONGO_URI")
	} else {
		mongo_uri = getEnv("MONGO_URI", "mongodb://localhost:27017/penguin_shop?replicaSet=rs0")
	}

	log.Println("[debug] MONGO_URI =", mongo_uri) // log temporal (solo dev)

	// Conectamos a Mongo
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client, err := connectMongo(ctx, mongo_uri)
	if err != nil {
		log.Fatalf("[mongo] error: %v", err)
	}
	defer func() { _ = client.Disconnect(context.Background()) }()

	log.Println("✅ Conexión exitosa con MongoDB:", mongo_db)

	// Inicializamos las colecciones que usaremos
	db := client.Database(mongo_db)
	col_products = db.Collection("products")
	col_orders = db.Collection("orders")
	col_deliveries = db.Collection("deliveries")

	// Definimos las rutas del servidor
	http.HandleFunc("/", homeHandler)
	http.HandleFunc("/checkout", checkoutHandler)
	http.HandleFunc("/orders", ordersBoardHandler)
	http.HandleFunc("/status/", orderStatusHandler)

	// Endpoint de salud (para Docker / pruebas)
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	// Armamos la dirección de escucha y levantamos el servidor
	addr := fmt.Sprintf(":%s", port_frontend)
	log.Printf("[frontend] escuchando en http://localhost%s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("error del servidor: %v", err)
	}
}
