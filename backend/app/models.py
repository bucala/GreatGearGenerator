"""Bounded inputs keep invalid geometry and unbounded CAD work out of the kernel."""

from pydantic import BaseModel, ConfigDict, Field


class Design(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    module: float = Field(default=2, ge=0.2, le=10)
    teeth1: int = Field(default=24, ge=8, le=120, strict=True)
    teeth2: int = Field(default=48, ge=8, le=120, strict=True)
    pressure_angle: float = Field(default=20, ge=14.5, le=30)
    profile1: float = Field(default=0, ge=-0.5, le=0.8)
    profile2: float = Field(default=0, ge=-0.5, le=0.8)
    width: float = Field(default=16, ge=1, le=100)
    bore1: float = Field(default=10, ge=0, le=300)
    bore2: float = Field(default=16, ge=0, le=300)
    torque: float = Field(default=10, ge=0, le=10000, description="Input torque in N m")
    rpm: float = Field(default=600, ge=0, le=30000)
    elastic_modulus: float = Field(default=210000, ge=100, le=500000, description="MPa")
    poisson_ratio: float = Field(default=0.3, ge=0, le=0.49)


class StepRequest(Design):
    # The default honors the brief: never silently replace exact curves with splines.
    allow_approximation: bool = False
