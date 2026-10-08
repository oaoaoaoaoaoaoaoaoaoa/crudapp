FROM mysql:8.0.19
COPY ./dump/db.sql /docker-entrypoint-initdb.d/init.sql