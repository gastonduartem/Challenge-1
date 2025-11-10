// checkout.go — handler SSR para crear pedidos (POST /checkout)

package handlers // Paquete donde viven los handlers (controladores HTTP)

// ====== IMPORTS ======
import (
	"context"  // context.Context: transporta deadlines, cancelaciones y metadatos entre llamadas
	"net/http" // net/http: servidor y utilidades HTTP estándar en Go
	"strconv"  // strconv: convertir strings a números (Atoi)
	"strings"  // strings: utilidades para manipular strings (TrimSpace, HasPrefix)
	"time"     // time: trabajar con tiempos, deadlines y timeouts

	// models: tus tipos de dominio (Product, Item, Order) definidos en internal/models
	"github.com/gastonduartem/Challenge-1/frontend/internal/models"

	"go.mongodb.org/mongo-driver/bson"           // bson: representación binaria JSON para Mongo (documentos y filtros)
	"go.mongodb.org/mongo-driver/bson/primitive" // primitive: tipos especiales de Mongo (ObjectID, Decimal128, etc.)
	"go.mongodb.org/mongo-driver/mongo"          // mongo: cliente/colecciones/métodos para operar con MongoDB
)

// NewCheckout devuelve un http.HandlerFunc (función que maneja una ruta HTTP)
// Recibe dos *mongo.Collection (punteros a colecciones):
//   - colProducts: colección "products" (para leer nombre/precio confiables)
//   - colOrders:   colección "orders" (para insertar el pedido nuevo)
func NewCheckout(colProducts, colOrders *mongo.Collection) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) { // w: writer de la respuesta; r: request entrante
		if r.Method != http.MethodPost { // Validamos método: sólo aceptamos POST (en SSR, viene de un <form>)
			http.Error(w, "solo se acepta POST", http.StatusMethodNotAllowed) // 405 si no es POST
			return
		}
		if err := r.ParseForm(); err != nil { // ParseForm: parsea body application/x-www-form-urlencoded
			http.Error(w, "form inválido", http.StatusBadRequest) // 400 si no se pudo parsear
			return
		}

		// Leemos campos básicos del comprador; TrimSpace elimina espacios al inicio/fin
		buyer := strings.TrimSpace(r.FormValue("buyer_name")) // nombre del comprador
		address := strings.TrimSpace(r.FormValue("address"))  // dirección/iglú
		email := strings.TrimSpace(r.FormValue("email"))      // email
		if buyer == "" || address == "" || email == "" {      // validación mínima
			http.Error(w, "completá nombre, dirección y email", http.StatusBadRequest)
			return
		}

		var items []models.Item // Slice dinámico de Items (los ítems del pedido)
		total := 0              // Total en enteros (centavos o unidades, según tu decisión)

		// context.WithTimeout crea un context.Context hijo con deadline (timeout de 5s)
		// - r.Context(): contexto que viaja con la request (se cancela si el cliente se desconecta)
		// - cancel(): función para cancelar/limpiar recursos (defer garantiza su ejecución)
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		// Recorremos todos los pares key->values del form para detectar campos qty_<productID>
		for key, vals := range r.Form {
			if !strings.HasPrefix(key, "qty_") || len(vals) == 0 { // sólo procesamos campos que empiezan con "qty_"
				continue
			}
			qty, _ := strconv.Atoi(vals[0]) // convertimos el primer valor a int (si falla, qty queda 0)
			if qty <= 0 {                   // ignoramos cantidades no positivas
				continue
			}

			// key = "qty_<idHex>" → extraemos la parte del ObjectID en hex
			idHex := strings.TrimPrefix(key, "qty_")
			// primitive.ObjectIDFromHex convierte un string hex de 24 chars al tipo ObjectID de Mongo
			oid, err := primitive.ObjectIDFromHex(idHex)
			if err != nil { // si el id no es un ObjectID válido, ignoramos este campo
				continue
			}

			// Buscamos el producto en Mongo para traer nombre y precio "confiables" (server-side)
			// Definimos un struct anónimo con sólo los campos que vamos a leer (name y price)
			var p struct {
				Name  string `bson:"name"`  // tag bson: nombre exacto del campo en el documento
				Price int    `bson:"price"` // precio entero
			}
			// colProducts.FindOne ejecuta un find con filtro; Decode rellena 'p'
			// bson.M es un alias de map[string]interface{} para armar documentos/filtros BSON
			// &: puntero
			if err := colProducts.FindOne(ctx, bson.M{"_id": oid}).Decode(&p); err != nil {
				continue // si no existe el producto (o error de DB), salteamos este ítem
			}

			sub := p.Price * qty // subtotal por ítem = precio * cantidad
			total += sub         // acumulamos al total del pedido

			// Armamos el Item con snapshot + ProductID (lo usa el admin para descontar stock)
			items = append(items, models.Item{
				ProductID: oid,     // ObjectID del producto (para auditoría/stock)
				Name:      p.Name,  // snapshot de nombre (evita lookup futuro)
				Qty:       qty,     // cantidad solicitada
				UnitPrice: p.Price, // snapshot de precio
				Subtotal:  sub,     // subtotal calculado
			})
		}

		if len(items) == 0 { // si no se eligió ningún producto válido
			http.Error(w, "elegí al menos un producto", http.StatusBadRequest)
			return
		}

		// Documento BSON que insertaremos en la colección "orders"
		// bson.M: mapa estilo JSON → Mongo guardará tipos según los valores proporcionados
		order := bson.M{
			"items":        items,      // array de subdocs (cada uno con Name/Qty/UnitPrice/Subtotal/ProductID)
			"total":        total,      // total del pedido
			"buyer_name":   buyer,      // nombre comprador
			"address":      address,    // dirección/iglú
			"igloo_sector": "",         // sector opcional (aquí vacío)
			"email":        email,      // correo
			"status":       "nuevo",    // estado inicial
			"created_at":   time.Now(), // timestamp de creación (tipo time.Time → BSON Date)
		}

		// InsertOne inserta un documento en la colección; devuelve InsertOneResult o error
		if _, err := colOrders.InsertOne(ctx, order); err != nil {
			http.Error(w, "no se pudo crear el pedido", http.StatusInternalServerError) // 500 si falla la DB
			return
		}

		// Redirigimos a /orders (listado público de pedidos con estado) — 303 See Other (PRG)
		http.Redirect(w, r, "/orders", http.StatusSeeOther)
	}
}
