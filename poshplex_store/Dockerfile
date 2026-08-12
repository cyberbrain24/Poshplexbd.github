FROM node:20-alpine

WORKDIR /app

# Copy package files first for Docker cache layer efficiency
COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start", "--", "-p", "3000"]
