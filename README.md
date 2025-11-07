# 🐧 Penguin Store

Tienda online para los pingüinos de la Antártida.  
Proyecto dividido en dos partes:

- `/backend`: Panel de Administración (Node.js + Express + MongoDB + Pug)
- `/frontend`: Tienda Online (Go + MongoDB + html/template)

---

## Descripción

Larry se retiró. Paula necesitaba un sistema moderno para vender pescado sin gritar.  
Este proyecto cumple con los requisitos del challenge:

### Panel de Administración (Node.js)

- CRUD completo de productos (nombre, precio, stock, imagen).
- Visualización de pedidos con datos del cliente.
- Cambio de estado (“nuevo”, “en_camino”, “entregado”).
- Inicio de sesión solo para Paula 🐟 (JWT).
- Renderizado en servidor con Pug (sin JavaScript).

### Tienda Online (Go)

- Muestra todos los productos activos desde MongoDB.
- Permite crear pedidos (checkout).
- Calcula precios y totales **en el servidor**.
- Renderizado con `html/template`, sin JS.
- Tablero público `/orders` y estado individual `/status/:id` (opcional).

---

## Tecnologías

- **Backend:** Node.js, Express, MongoDB, JWT, Pug
- **Frontend:** Go (net/http, html/template), MongoDB driver
- **Base de datos:** MongoDB con Replica Set `rs0`
- **Estilo:** HTML5 + CSS puro (sin frameworks, sin JS)

---

## Estructura del proyecto

PenguinStore/
├── backend/ → Panel Admin (Node.js)
│ ├── controllers/
│ ├── models/
│ ├── routes/
│ ├── views/ → Plantillas Pug
│ ├── src/uploads/→ Imágenes subidas
│ └── .env
│
├── frontend/ → Tienda pública (Go)
│ ├── cmd/server/ → main.go
│ ├── templates/ → Plantillas HTML
│ └── .env
│
└── docker-compose.yml (opcional)

---

## 🚀 Instrucciones para correrlo

### Clonar el repositorio

```bash
git clone https://github.com/tuusuario/penguin-store.git
cd penguin-store
```

### Iniciar MongoDB (Replica Set)

```bash
docker compose up -d
```

### Backend (Panel Admin)

```bash
cd backend
npm install
npm run dev
```

Abrir en: http://localhost:4100
Paula puede iniciar sesión con:
email: paula@penguin.com
password: paula123

### Frontend (Tienda)

```bash
cd frontend
go run ./cmd/server
```

Abrir en: http://localhost:8081

## Variables de entorno

/backend/.env.example

```bash
APP_ENV=development
PORT_BACKEND=4000
MONGO_URI=mongodb://localhost:27017/penguin_shop?replicaSet=rs0
MONGO_DB=penguin_shop
JWT_SECRET=mi_clave_segura
UPLOADS_BASE=http://localhost:4000
FRONTEND_UPLOADS_BASE=http://localhost:4000
ADMIN_EMAIL=paula@penguin.com
ADMIN_PASSWORD=paula123
```

/frontend/.env.example

```bash
APP_ENV=development
PORT_FRONTEND=3000
MONGO_URI=mongodb://localhost:27017/penguin_shop?replicaSet=rs0
MONGO_DB=penguin_shop
```

## Flujo general

1. Paula inicia sesión → gestiona productos y pedidos.
2. Los pingüinos visitan la tienda → compran productos.
3. Los pedidos aparecen en el panel de Paula.
4. Al marcar “entregado”, el stock se actualiza.
5. Todo se muestra sin JavaScript, 100% renderizado en servidor.

Hecho por Gastón Duarte.
Desafío “Larry el Pingüino” — Penguin Academy.
