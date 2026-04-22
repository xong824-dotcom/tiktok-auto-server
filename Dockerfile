FROM ghcr.io/puppeteer/puppeteer:21.0.0

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Railway 환경변수에서 포트를 가져오기 위함
ENV PORT=3000

CMD ["node", "index.js"]
