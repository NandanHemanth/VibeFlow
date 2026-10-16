#!/bin/sh
# Boots the tool: embedded SurrealDB (persistent RocksDB on the sandbox disk) + the web runtime.
cd /home/daytona/app
mkdir -p /home/daytona/data
healthy() { node -e "fetch('http://127.0.0.1:8000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; }
if [ -z "$SURREAL_TOKEN" ] && ! healthy; then
  surreal start --log warn --user root --pass "$SURREAL_PASS" --bind 127.0.0.1:8000 rocksdb:/home/daytona/data/tool.db > /home/daytona/surreal.log 2>&1 &
  for i in $(seq 1 40); do healthy && break; sleep 0.25; done
fi
exec node server.mjs
