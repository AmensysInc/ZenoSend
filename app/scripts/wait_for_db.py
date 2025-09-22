import os, time, sys
import psycopg2
from urllib.parse import urlparse

url = os.getenv("DATABASE_URL", "postgresql://sguser:sgpass@db:5432/sg_lite")
p = urlparse(url.replace("+psycopg2", ""))  # tolerate +psycopg2
host, port = p.hostname, p.port or 5432
user, pwd, db  = p.username, p.password, p.path.lstrip("/")

for i in range(30):  # ~30s max
    try:
        conn = psycopg2.connect(host=host, port=port, user=user, password=pwd, dbname=db)
        conn.close()
        print("DB is ready"); sys.exit(0)
    except Exception as e:
        print(f"DB not ready yet ({type(e).__name__}: {e}), retrying...")
        time.sleep(1 + i*0.25)

print("DB still not ready; exiting 1"); sys.exit(1)
