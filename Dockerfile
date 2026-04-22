FROM ghcr.io/puppeteer/puppeteer:21.0.0

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Set environment variables
ENV PORT=3000

CMD ["node", "index.js"]
