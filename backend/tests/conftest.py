import os
import tempfile

os.environ["MEDCORE_DATABASE_URL"] = f"sqlite:///{tempfile.gettempdir()}/medcore_test_{os.getpid()}.db"
os.environ["MEDCORE_SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-hs256"
os.environ["MEDCORE_AUTO_SEED"] = "true"

import pytest
from fastapi.testclient import TestClient

from app.db.session import Base, SessionLocal, engine
from app.main import app
from app.seed import run_seed


@pytest.fixture(scope="session", autouse=True)
def database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        run_seed(db)
    finally:
        db.close()
    yield
    engine.dispose()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def login(client: TestClient, username: str, password: str) -> dict:
    res = client.post("/api/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, res.text
    return res.json()


def auth_client(username: str, password: str) -> TestClient:
    c = TestClient(app)
    data = login(c, username, password)
    c.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    return c


@pytest.fixture
def admin():
    return auth_client("admin", "Admin@123")


@pytest.fixture
def receptionist():
    return auth_client("reception.rekha", "Reception@123")


@pytest.fixture
def cashier():
    return auth_client("cashier.amit", "Cashier@123")


@pytest.fixture
def doctor():
    return auth_client("dr.house", "Doctor@123")


@pytest.fixture
def nurse():
    return auth_client("nurse.priya", "Nurse@123")


@pytest.fixture
def pharmacist():
    return auth_client("pharm.suresh", "Pharma@123")


@pytest.fixture
def labtech():
    return auth_client("lab.vikram", "Lab@12345")


@pytest.fixture
def radiologist():
    return auth_client("dr.rao", "Radiologist@123")


@pytest.fixture
def radtech():
    return auth_client("rad.farah", "RadTech@123")
