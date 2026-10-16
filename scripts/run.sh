#!/bin/sh
# usage: scripts/run.sh "/cmd" "prompt"
ID=$(curl -s -X POST localhost:3100/api/run -H 'content-type: application/json' -d "{\"prompt\":\"$2\",\"command\":\"$1\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])"); echo RUN $ID
timeout 400 curl -sN localhost:3100/api/run/$ID/stream | python3 -u -c "
import sys,json
for line in sys.stdin:
    if not line.startswith('data:'): continue
    e=json.loads(line[5:])
    if e['status'] in ('log','start'): continue
    print(e['step'], e['status'], e.get('ms'), (e.get('detail') or '')[:240])
    if e['step']=='done': print(json.dumps(e.get('data'))[:500]); break
"
