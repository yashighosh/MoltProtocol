#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ ! -f my_database ]; then
  echo "my_database was not found in the MoltProtocol folder" >&2
  exit 1
fi
docker rm -f molt-postgres >/dev/null 2>&1 || true
docker run -d --name molt-postgres --restart unless-stopped \
  -e POSTGRES_PASSWORD=molt \
  -e POSTGRES_DB=molt \
  -p 55432:5432 \
  postgres:18 >/dev/null
ready=0
i=0
while [ "$i" -lt 30 ]; do
  if docker exec molt-postgres pg_isready -U postgres >/dev/null 2>&1; then
    ready=1
    break
  fi
  i=$((i + 1))
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "PostgreSQL did not become ready" >&2
  exit 1
fi
docker cp my_database molt-postgres:/tmp/my_database
docker exec molt-postgres pg_restore -U postgres -d molt --no-owner --no-privileges /tmp/my_database
echo "Restored my_database into postgres://postgres:molt@127.0.0.1:55432/molt"
