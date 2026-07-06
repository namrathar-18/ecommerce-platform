FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 4000
# db push + seed on boot for demo convenience, then start
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm run seed && npm start"]
