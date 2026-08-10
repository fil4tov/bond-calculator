from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator


Username = Annotated[
    str,
    StringConstraints(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_-]+$"),
]
Password = Annotated[str, Field(min_length=8, max_length=128)]


class Credentials(BaseModel):
    username: Username
    password: Password

    @field_validator("username", mode="before")
    @classmethod
    def trim_username(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

