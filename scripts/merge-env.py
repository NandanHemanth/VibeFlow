import sys
src, dst = sys.argv[1], sys.argv[2]
def parse(p):
    d = {}
    try:
        for line in open(p):
            line = line.rstrip("\n")
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1); v = v.split(" #")[0].strip().strip('"').strip("'"); d[k.strip()] = v
    except FileNotFoundError: pass
    return d
a, b = parse(src), parse(dst)
for k, v in a.items():
    if v: b[k] = v
    elif k not in b: b[k] = ""
open(dst, "w").write("\n".join(f"{k}={v}" for k, v in b.items()) + "\n")
for k, v in b.items(): print(f"{k:24} {'set' if v else 'EMPTY'}")
