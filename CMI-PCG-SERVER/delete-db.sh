docker exec -it cmi-pcg-server-db-1 psql -U postgres


-- Primeiro, derrube conexões com o banco:
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE datname = 'clinicacmi' AND pid <> pg_backend_pid();

-- Apague o banco:
DROP DATABASE clinicacmi;

-- Crie de novo:
CREATE DATABASE clinicacmi;
\q
