// home.go — handler SSR para la página principal (GET "/") que lista productos y muestra form del comprador

package handlers // Paquete donde agrupamos los controladores HTTP

import (
	"bytes"         // bytes.Buffer: buffer en memoria para construir la respuesta antes de escribirla
	"context"       // context.Context: maneja cancelación y deadlines a través de llamadas (DB, red, etc.)
	"html/template" // html/template: motor de plantillas nativo de Go (escapa HTML → seguro para SSR)
	"log"           // log: para imprimir logs de servidor (errores, info)
	"net/http"      // net/http: servidor HTTP estándar (handlers, Request/Response)
	"time"          // time: manejar tiempos, duraciones, timeouts

	// models: tipos de dominio (Product, etc.) que mapean documentos de Mongo
	"github.com/gastonduartem/Challenge-1/frontend/internal/models"
	// Paquetes del driver oficial de MongoDB para Go
	"go.mongodb.org/mongo-driver/bson"          // bson: documento/filtro BSON (mapa estilo JSON)
	"go.mongodb.org/mongo-driver/mongo"         // mongo: tipos Client/Collection/Cursor y operaciones
	"go.mongodb.org/mongo-driver/mongo/options" // options: “builder” de opciones (FindOptions, Projection, Sort, etc.)
)

// NewHome construye y devuelve un http.HandlerFunc para GET "/"
// Recibe:
//   - colProducts: *mongo.Collection → referencia a la colección "products" (para consultar productos)
//   - uploadsBase: string → prefijo público para armar URLs de imágenes (ej: "/uploads")
//   - tmpl: *template.Template → conjunto de plantillas ya parseadas (usaremos ExecuteTemplate)
//
// Devuelve un http.HandlerFunc que el router puede montar directamente.
func NewHome(colProducts *mongo.Collection, uploadsBase string, tmpl *template.Template) http.HandlerFunc {
	// viewData: estructura local para pasar datos a la plantilla HTML
	type viewData struct {
		Products       []models.Product // Lista de productos a renderizar (slice → lista dinámica en Go)
		UploadsBase    string           // Prefijo público para imágenes
		DefaultName    string           // Valores por defecto del form (pueden venir vacíos)
		DefaultEmail   string
		DefaultAddress string
	}

	// Retornamos la función handler (implementa http.HandlerFunc)
	// w: salida → cliente, Responder (HTML, JSON, headers, código)
	// r: entrada ← cliente, nLeer método, URL, form, headers, contexto
	return func(w http.ResponseWriter, r *http.Request) {
		// Creamos un contexto con timeout de 3s a partir del contexto de la request.
		// context.Context permite: cancelar operaciones colgantes si el cliente corta,
		// propagar deadlines a llamadas de DB/red, etc. Buenas prácticas con Mongo.
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel() // Siempre liberar el contexto al salir del handler

		// Ejecutamos un Find para traer productos activos.
		// También “proyectamos” (seleccionamos) los campos que queremos para optimizar la red/decodificación.
		// options.Find() crea un *options.FindOptions (patrón builder).
		// SetProjection define la proyección (significa: decirle a Mongo qué campos quiero que me devuelvas).
		// bson.M es un map[string]interface{} usado para filtros/proyecciones BSON (estilo JSON).
		cur, err := colProducts.Find(
			ctx,                       // Contexto con timeout (si se cumple, cancela la consulta)
			bson.M{"is_active": true}, // Filtro: sólo productos activos
			options.Find().SetProjection(bson.M{ // Proyección: devolver sólo estos campos
				"_id":         1, // 1 = incluir, 0 = excluir; incluimos _id porque la plantilla usa .ID.Hex
				"name":        1,
				"price":       1,
				"description": 1,
				"image_path":  1,
			}),
		)
		if err != nil {
			// Si falla la consulta a MongoDB, devolvemos 500 (error del servidor)
			http.Error(w, "error al obtener productos", http.StatusInternalServerError)
			return
		}
		defer cur.Close(ctx) // Cerramos el cursor cuando terminamos de usarlo

		// Decodificamos todos los documentos del cursor en un slice de Product.
		// cur.All lee el cursor completo y mapea a la estructura destino (&products).
		var products []models.Product
		if err := cur.All(ctx, &products); err != nil {
			http.Error(w, "error al leer productos", http.StatusInternalServerError)
			return
		}

		// Preparamos el “view model” para la plantilla.
		data := viewData{
			Products:       products, // el nombre exportado (mayúscula) debe coincidir con el template
			UploadsBase:    uploadsBase,
			DefaultName:    "",
			DefaultEmail:   "",
			DefaultAddress: "",
		}

		// Escribimos el HTML dentro del buf en kugar de hacerlo directamente al navegador
		// Si algo falla, no enviamos HTML roto o incompleto al cliente

		// bytes.Buffer: construimos la salida en memoria primero (buena práctica)
		// Así, si la plantilla falla, no mandamos HTML a medias al cliente.
		var buf bytes.Buffer

		// ExecuteTemplate ejecuta una sub-plantilla por nombre (ej: "home.tmpl")
		// Si en tu parse sumaste varias plantillas (layout, parciales), esta llama la concreta para "home".
		if err := tmpl.ExecuteTemplate(&buf, "home.tmpl", data); err != nil {
			//%v: decime el valor como sea
			log.Printf("[tpl] home error: %v", err) // Log interno para debug
			http.Error(w, "error al renderizar la página", http.StatusInternalServerError)
			return
		}

		// Cabecera de tipo de contenido: HTML con UTF-8
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		// Escribimos el buffer al ResponseWriter (envío eficiente, evita copias extra)
		// WriteTo: copiamos el contenido de buf a otro destino (en este caso al cliente)
		// WriteTo: devuelve dos valores, los cuales ignoramos
		_, _ = buf.WriteTo(w)
	}
}
