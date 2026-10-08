FROM node:18

WORKDIR /app

COPY ./api/package*.json ./
RUN npm install

COPY ./api/ ./
COPY ./html/ /var/www/html/

RUN chmod -R 755 /app/uploads
RUN openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout /app/server.key \
    -out /app/server.crt \
    -days 365 \
    -subj "/CN=localhost"
#EXPOSE 5000
EXPOSE 80 443
CMD ["node", "server.js"]