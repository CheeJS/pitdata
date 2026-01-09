import sqlite3
conn = sqlite3.connect('data_pipeline/f1_data.db')
c = conn.cursor()
c.execute('SELECT id, race_name FROM races WHERE year=2025 ORDER BY round')
for row in c.fetchall():
    print(f"ID {row[0]}: {row[1]}")
conn.close()
