FROM node:22.14.0

WORKDIR /usr/src

# Copiar solo los archivos de dependencias primero para aprovechar la caché de Docker
COPY package*.json ./

RUN npm install 

COPY . .

EXPOSE 8080

CMD ["npm", "run", "start:dev"]