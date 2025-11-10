// mongo.go — Módulo para conectar a MongoDB

package db // Paquete 'db' → se usa para agrupar funciones relacionadas a la base de datos

import (
	"context" // Manejo de cancelación y timeouts para llamadas externas (como conexiones de red)
	// Driver oficial de MongoDB para Go
	"go.mongodb.org/mongo-driver/mongo"         // Contiene los tipos Client, Collection, Cursor, etc.
	"go.mongodb.org/mongo-driver/mongo/options" // Permite construir estructuras de configuración (ApplyURI, SetAuth, etc.)
)

// Connect establece una conexión con MongoDB y devuelve un *mongo.Client listo para usar.
// Parámetros:
//
//	ctx  → contexto (controla timeout o cancelación).
//	uri  → cadena de conexión completa (ej: "mongodb://localhost:27017").
//
// Devuelve:
//   - *mongo.Client  → puntero al cliente conectado (es el objeto principal para operar con Mongo).
//   - error          → error si algo falla al conectar o al hacer ping.
func Connect(ctx context.Context, uri string) (*mongo.Client, error) {
	// options.Client() crea una estructura vacía de configuración para el cliente MongoDB.
	// ApplyURI(uri) "inyecta" la cadena de conexión (con host, puerto, credenciales, etc.)
	opts := options.Client().ApplyURI(uri)

	// mongo.Connect crea la conexión a MongoDB usando el contexto (ctx) y las opciones (opts).
	// No es un simple "abrir socket": internamente inicializa conexiones en un pool.
	client, err := mongo.Connect(ctx, opts)
	if err != nil {
		// Si ocurre un error (por ejemplo, URI inválida o conexión rechazada),
		// devolvemos nil (sin cliente) y el error.
		return nil, err
	}

	// Hacemos un ping para verificar que realmente la conexión es válida y el servidor responde.
	// client.Ping envía un comando interno 'ping' al servidor MongoDB.
	if err := client.Ping(ctx, nil); err != nil {
		// Si el servidor no responde, cerramos devolviendo el error.
		return nil, err
	}

	// Si todo salió bien, devolvemos el cliente conectado.
	return client, nil
}
