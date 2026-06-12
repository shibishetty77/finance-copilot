from pydantic import BaseModel, ConfigDict, field_validator
import json

class HoldingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    tags: list[str] | None = None

    @field_validator('tags', mode='before')
    @classmethod
    def parse_tags(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except:
                return None
        return v

class MockORM:
    def __init__(self):
        self.tags = '["test", "tag"]'

try:
    m = MockORM()
    res = HoldingResponse.model_validate(m)
    print("Success:", res)
except Exception as e:
    print("Error:", repr(e))
