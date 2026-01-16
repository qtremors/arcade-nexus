import sqlite3

def migrate():
    try:
        conn = sqlite3.connect('arcade_nexus.db')
        cursor = conn.cursor()
        
        # Check if column exists
        cursor.execute("PRAGMA table_info(game_sessions)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'difficulty' not in columns:
            print("Adding difficulty column...")
            cursor.execute("ALTER TABLE game_sessions ADD COLUMN difficulty VARCHAR(20)")
            conn.commit()
            print("Migration successful.")
        else:
            print("Column header 'difficulty' already exists.")
            
        conn.close()
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
