# frontend/Dockerfile

# Etapa 1: Build del binario
# Imagen de Go con herramientas de build
FROM golang:1.22-alpine AS builder               
# Carpeta de trabajo
WORKDIR /app                                     

# Copiar definiciones de módulos
COPY go.mod go.sum ./                            
# Descargar dependencias
RUN go mod download                              

# Copiar el resto del código del frontend
COPY . .                                         
# Deshabilitar CGO p/ binario estático
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \      
  # Compilar el binario (cmd/server -> /app/server)
  go build -o server ./cmd/server              

# Etapa 2: Imagen final mínima
# Imagen mínima para ejecutar el binario
FROM alpine:3.20                                 
# Carpeta de trabajo
WORKDIR /app                                     

# Copiar binario compilado desde la etapa builder
COPY --from=builder /app/server /app/server      
# Exponer puerto 8080 dentro del contenedor
EXPOSE 8080                                      

# Ejecutar el binario
# Arranca el servidor Go
CMD ["/app/server"]                              
