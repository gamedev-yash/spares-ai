from app.schemas.common import ORMBase


class LoginRequest(ORMBase):
    employee_code: str
    password: str


class UserOut(ORMBase):
    id: int
    employee_code: str
    name: str
    email: str
    department: str
    role: str
    plant: str
    active: bool


class TokenResponse(ORMBase):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
