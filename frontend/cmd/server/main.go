package main

import (
	"context"                                   // Para manejar cancelaciones y tiempos límite
	"fmt"                                       // Para imprimir logs formateados
	"html/template"                             // Motor de plantillas HTML (SSR nativo)
	"log"                                       // Logger básico
	"net/http"                                  // Servidor HTTP integrado en Go
	"os"                                        // Para leer variables de entorno
	"time"                                      // Para timeouts

	"github.com/joho/godotenv" 									// librería que carga variables desde el archivo .env
	"go.mongodb.org/mongo-driver/mongo"         // Driver oficial de MongoDB para Go (cliente)
	"go.mongodb.org/mongo-driver/mongo/options" // Opciones de conexión para el driver de MongoDB
)

// ✅ agregado: helper para obligar a que exista una variable en producción
// Si falta, corta la ejecución con un error claro (evita caer en "localhost" por accidente)
func mustEnv(key string) string {                     // devuelve el valor de una variable obligatoria
	v := os.Getenv(key)                               // lee del entorno
	if v == "" {                                      // si está vacía
		log.Fatalf("variable de entorno faltante: %s", key) // corta con mensaje claro
	}
	return v                                          // devuelve el valor
}

// FUNCIÓN AUXILIAR PARA LEER VARIABLES
// os.Getenv(key) busca la variable de entorno cuyo nombre es key
// v := os.Getenv(key) crea una variable local v con ese valor
func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// CONEXIÓN A MONGO
// ctx context.Context: un contexto de ejecución, usado en Go para manejar timeouts, cancelaciones y control de procesos
// uri string: la cadena de conexión a MongoDB
// Devuelve dos cosas:
// Un puntero a mongo.Client (la conexión al servidor MongoDB)
// Un error (por si algo falla)
func connectMongo(ctx context.Context, uri string) (*mongo.Client, error) {
	// options.Client() crea una estructura de configuración para el cliente Mongo
	// .ApplyURI(uri) le aplica la URI de conexión, que define a qué base y host conectarse
	opts := options.Client().ApplyURI(uri)
	// Se intenta establecer una conexión al servidor MongoDB usando las opciones opts y el contexto ctx
	client, err := mongo.Connect(ctx, opts)
	if err != nil {
		return nil, err
	}
	// Se hace un ping al servidor MongoDB, Es una forma de comprobar que la conexión realmente funciona
	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}
	return client, nil
}

// PLANTILLA HTML (inline para test Día 1)
var homeTemplate = template.Must(template.New("home").Parse(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>{{.title}}</title>
  <style>
    body { font-family: system-ui; background:#f9fbfd; margin:2rem; }
    .card { background:white; padding:1.5rem; border-radius:10px; border:1px solid #e2e8f0; }
    h1 { color:#1e293b; }
  </style>
</head>
<body>
  <div class="card">
    <h1>{{.title}}</h1>
    <p>SSR Go funcionando 🐹 y conexión a Mongo lista ✅</p>
  </div>
</body>
</html>`))

// HANDLER RAÍZ
// w http.ResponseWriter: el objeto para escribir la respuesta HTTP (por ejemplo, HTML, JSON, etc.)
// r *http.Request: el objeto con los datos del pedido del cliente, como método, URL, cabeceras, cuerpo, etc
func homeHandler(w http.ResponseWriter, r *http.Request) {
	// Este data es el contexto que se enviará al template (plantilla HTML) para que pueda renderizar dinámicamente contenido
	data := map[string]string{"title": "Penguin Store"}
	if err := homeTemplate.Execute(w, data); err != nil {
		http.Error(w, "error al renderizar", http.StatusInternalServerError)
	}
}

// MAIN
func main() {

	// ✅ ajustado: cargar el archivo .env SOLO si NO estamos en producción
	// En Docker seteamos APP_ENV=production y las variables llegan por environment (compose)
	if os.Getenv("APP_ENV") != "production" { // si no es producción, cargamos .env
		_ = godotenv.Load()                   // carga vars desde .env para desarrollo local
	}

	// Leer las variables de entorno
	port_frontend := getEnv("PORT_FRONTEND", "8080")                              // puerto HTTP (fallback 8080 en dev)
	mongo_db := getEnv("MONGO_DB", "penguin_shop")                                // nombre de la DB (fallback en dev)

	// ✅ ajustado: en producción NO usamos fallback para MONGO_URI (evita caer en localhost)
	var mongo_uri string                                                          // declaramos la variable
	if os.Getenv("APP_ENV") == "production" {                                     // si estamos en prod (Docker)
		mongo_uri = mustEnv("MONGO_URI")                                          // obligamos a que exista
	} else {                                                                      // si estamos en dev
		mongo_uri = getEnv("MONGO_URI", "mongodb://localhost:27017/penguin_shop?replicaSet=rs0") // fallback útil en local
	}

	// ✅ agregado: log de debug temporal para ver la URI efectiva (quitar luego si querés)
	log.Println("[debug] MONGO_URI =", mongo_uri)                                 // imprime la URI usada en runtime

	// context.Background() crea un contexto base vacío
	// context.WithTimeout(...) genera un contexto hijo que se cancela automáticamente si pasan 5 segundos
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)      // timeout 10s para handshake
	// defer significa “ejecutá esto al final de la función”
	// Cuando el programa termine o salga del main, se ejecuta cancel() para liberar recursos del contexto
	// Siempre que uses un WithTimeout, debés hacer defer cancel()
	defer cancel()

	// Se intenta hacer una conexion con la base de datos
	client, err := connectMongo(ctx, mongo_uri)
	// Si se encuentra un error, se imprime en pantalla
	if err != nil {
		// %v: lq hacemos es en donde se coloca el %v, cambiamos por el mensaje de error
		log.Fatalf("[mongo] error: %v", err)
	}
	// Cuando el programa termine, cerrar la onexion con la base de datos para liberar todo correctamente
	defer func() { _ = client.Disconnect(context.Background()) }()

	log.Println("✅ Conexión exitosa con MongoDB:", mongo_db)

	// Definimos la ruta
	http.HandleFunc("/", homeHandler)

	// ✅ agregado (opcional): endpoint simple de salud para debug rápido
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { // devuelve 200 OK
		w.WriteHeader(http.StatusOK)                                          // status 200
		_, _ = w.Write([]byte("OK"))                                         // cuerpo "OK"
	})

	// Armamos la direccion donde se va a escuchar el server
	addr := fmt.Sprintf(":%s", port_frontend)
	// Imprimimos en pantalla donde se va a escuchar
	log.Printf("[frontend] escuchando en http://localhost%s", addr)
	// Levantamos el servidor, si encontramos algun error, logueamos el error y termina el programa
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("error del servidor: %v", err)
	}
}
