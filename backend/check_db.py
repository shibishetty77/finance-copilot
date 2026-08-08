import sqlite3

conn = sqlite3.connect('financecopilot.db')
cursor = conn.cursor()

tables = cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("Tables:", tables)

print("\nTransactions columns:")
cols = cursor.execute("PRAGMA table_info(transactions)").fetchall()
for col in cols:
    print(" ", col)

print("\nGmail credentials columns:")
cols2 = cursor.execute("PRAGMA table_info(gmail_credentials)").fetchall()
for col in cols2:
    print(" ", col)

conn.close()
