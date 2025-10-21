# backend/Dockerfile

# Imagen base liviana de Node 20
FROM node:20-alpine                             
# Carpeta de trabajo dentro del contenedor
WORKDIR /app                                    

# Copiar package.json y package-lock.json
COPY package*.json ./                           
# Instalar dependencias (modo producción, rápido y reproducible)
RUN npm ci --only=production                    

# Copiar el resto del código fuente
COPY . .                                        
# Exponer puerto 4000 dentro del contenedor
EXPOSE 4000                                     

# Comando por defecto: iniciar la app (asegurate que package.json tenga "start")
# Arranca "node src/app.js" si start está definido
CMD ["npm", "start"]                            
