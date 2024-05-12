FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm i && npm cache clean --force
COPY . .
CMD ["npm", "run", "dev"]