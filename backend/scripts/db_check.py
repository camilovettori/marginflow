from app.db.session import engine

def main() -> None:
    with engine.connect() as conn:
        result = conn.exec_driver_sql("SELECT 1").scalar()
        print("DB OK:", result)

if __name__ == "__main__":
    main()