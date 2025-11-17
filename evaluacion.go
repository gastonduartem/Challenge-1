package main

import (
	"context"      // Manejar contexto y timeout
	"fmt"          // Imprimir texto
	"log"          // Loguear errores
	"net/http"     // Servidor HTTP
	"time"         // Timeout

	"go.mongodb.org/mongo-driver/bson"   // Para filtros BSON
	"go.mongodb.org/mongo-driver/mongo"  // Driver MongoDB
	"go.mongodb.org/mongo-driver/mongo/options" // Opciones de conexión
)

// Delivery representa lo que querés mostrar
type Delivery struct {
	Product string `bson:"product"` // campo de ejemplo
	Qty     int    `bson:"qty"`     // campo de ejemplo
}

// Colección global de deliveries (la inicializamos en main)
var deliveriesCol *mongo.Collection

// findDeliveries se encarga de ir a Mongo y traer los datos
func findDeliveries(ctx context.Context) ([]Delivery, error) {
	// Creamos un contexto con timeout de 3 segundos
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	// Hacemos la consulta: filtro vacío = trae todo
	cur, err := deliveriesCol.Find(ctx, bson.M{})
	if err != nil {
		// Si hubo error al hacer la consulta, lo devolvemos
		return nil, err
	}
	// Nos aseguramos de cerrar el cursor al final
	defer cur.Close(ctx)

	// Slice donde vamos a guardar los deliveries
	var deliveries []Delivery

	// Recorremos todos los documentos del cursor
	for cur.Next(ctx) {
		var d Delivery // Variable para un delivery

		// Decodificamos el documento BSON en el struct Delivery
		if err := cur.Decode(&d); err != nil {
			return nil, err
		}

		// Agregamos el delivery al slice
		deliveries = append(deliveries, d)
	}

	// Devolvemos el slice y nil como error
	return deliveries, nil
}

// entregasHandler es el handler HTTP (no devuelve []Delivery, error)
func entregasHandler(w http.ResponseWriter, r *http.Request) {
	// Llamamos a la función que trae los datos
	deliveries, err := findDeliveries(r.Context())
	if err != nil {
		// Si hay error, devolvemos 500
		http.Error(w, "Error trayendo deliveries", http.StatusInternalServerError)
		return
	}

	// POR AHORA, solo mostramos cuántos hay (para probar)
	fmt.Fprintf(w, "Cantidad de deliveries: %d\n", len(deliveries))
}

package main

import (
	"context"      // Manejar contexto y timeout
	"fmt"          // Imprimir texto
	"log"          // Loguear errores
	"net/http"     // Servidor HTTP
	"time"         // Timeout

	"go.mongodb.org/mongo-driver/bson"   // Para filtros BSON
	"go.mongodb.org/mongo-driver/mongo"  // Driver MongoDB
	"go.mongodb.org/mongo-driver/mongo/options" // Opciones de conexión
)

// Delivery representa lo que querés mostrar
type Delivery struct {
	Product string `bson:"product"` // campo de ejemplo
	Qty     int    `bson:"qty"`     // campo de ejemplo
}

// Colección global de deliveries (la inicializamos en main)
var deliveriesCol *mongo.Collection

// findDeliveries se encarga de ir a Mongo y traer los datos
func findDeliveries(ctx context.Context) ([]Delivery, error) {
	// Creamos un contexto con timeout de 3 segundos
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	// Hacemos la consulta: filtro vacío = trae todo
	cur, err := deliveriesCol.Find(ctx, bson.M{})
	if err != nil {
		// Si hubo error al hacer la consulta, lo devolvemos
		return nil, err
	}
	// Nos aseguramos de cerrar el cursor al final
	defer cur.Close(ctx)

	// Slice donde vamos a guardar los deliveries
	var deliveries []Delivery

	// Recorremos todos los documentos del cursor
	for cur.Next(ctx) {
		var d Delivery // Variable para un delivery

		// Decodificamos el documento BSON en el struct Delivery
		if err := cur.Decode(&d); err != nil {
			return nil, err
		}

		// Agregamos el delivery al slice
		deliveries = append(deliveries, d)
	}

	// Devolvemos el slice y nil como error
	return deliveries, nil
}

// entregasHandler es el handler HTTP (no devuelve []Delivery, error)
func entregasHandler(w http.ResponseWriter, r *http.Request) {
	// Llamamos a la función que trae los datos
	deliveries, err := findDeliveries(r.Context())
	if err != nil {
		// Si hay error, devolvemos 500
		http.Error(w, "Error trayendo deliveries", http.StatusInternalServerError)
		return
	}

	// POR AHORA, solo mostramos cuántos hay (para probar)
	fmt.Fprintf(w, "Cantidad de deliveries: %d\n", len(deliveries))

	// Si querés, podés imprimir cada uno
	for _, d := range deliveries {
		fmt.Fprintf(w, "Producto: %s - Qty: %d\n", d.Product, d.Qty)
	}
}

func main() {
	// 1) Conectar a Mongo (ejemplo local)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Creamos el cliente
	client, err := mongo.Connect(ctx, options.Client().ApplyURI("mongodb://localhost:27017"))
	if err != nil {
		log.Fatal("Error al conectar a Mongo:", err)
	}

	// 2) Elegimos la base de datos y la colección
	db := client.Database("tu_base")              // Nombre de tu base
	deliveriesCol = db.Collection("deliveries")   // Colección deliveries

	// 3) Registramos la ruta y el handler
	http.HandleFunc("/entregas-productos", entregasHandler)

	// 4) Levantamos el servidor
	log.Println("Servidor escuchando en :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}