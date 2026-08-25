FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
ENV PORT=8787
EXPOSE 8787
CMD ["node", "src/server.mjs"]
