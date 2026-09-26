"""Read-only инспекция БД EnglishPro: таблицы, пользователи, размеры блобов данных."""
import sqlite3

DB = 'file:/home/z/my-project/db/custom.db?mode=ro'  # строго read-only
con = sqlite3.connect(DB, uri=True)
cur = con.cursor()

tables = [r[0] for r in cur.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
print('tables:', tables)

for t in tables:
    if t.startswith('_') or t == 'sqlite_sequence':
        continue
    cols = [c[1] for c in cur.execute(f'PRAGMA table_info("{t}")')]
    n = cur.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
    print(f'{t}: rows={n} cols={cols}')

print('--- users ---')
try:
    for row in cur.execute("SELECT id, email, name FROM User ORDER BY createdAt"):
        print('user:', row)
except Exception as e:
    print('user query failed:', e)

# если данные учителя лежат отдельной таблицей — покажем размер блоба на пользователя
for cand in ('UserData', 'userData', 'Data'):
    if cand in tables:
        try:
            rows = cur.execute(
                f"SELECT userId, length(data) FROM {cand}").fetchall()
            print(f'--- {cand} blob sizes ---')
            for r in rows:
                print(r)
        except Exception as e:
            print(cand, 'blob query failed:', e)
