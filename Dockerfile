FROM node:8.11

HEALTHCHECK CMD curl -f http://localhost:3000/ || exit 1
WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY Frontend Frontend
COPY Backend Backend

EXPOSE 3000

CMD ["npm", "start"]