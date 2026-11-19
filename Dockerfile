FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 3000
ENV HOST=0.0.0.0
CMD ["npm", "start"]
