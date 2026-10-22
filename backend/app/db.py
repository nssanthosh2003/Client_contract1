from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

from .config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)

    contracts: Mapped[list["Contract"]] = relationship(back_populates="client")


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), index=True)
    file_path: Mapped[str] = mapped_column(String(500), unique=True)  # relative to inbox_dir
    file_hash: Mapped[str] = mapped_column(String(64), index=True)

    title: Mapped[str | None] = mapped_column(String(300))
    contract_type: Mapped[str | None] = mapped_column(String(80), index=True)
    parties: Mapped[list] = mapped_column(JSON, default=list)
    value: Mapped[float | None] = mapped_column(Float)
    value_basis: Mapped[str | None] = mapped_column(String(16))  # total | annual | monthly | other
    currency: Mapped[str | None] = mapped_column(String(8))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date, index=True)
    renewal_terms: Mapped[str | None] = mapped_column(Text)
    governing_law: Mapped[str | None] = mapped_column(String(200))
    payment_terms: Mapped[str | None] = mapped_column(String(300))
    slas: Mapped[list] = mapped_column(JSON, default=list)

    # Pipeline metadata
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    field_confidence: Mapped[dict] = mapped_column(JSON, default=dict)
    warnings: Mapped[list] = mapped_column(JSON, default=list)
    agent_trace: Mapped[list] = mapped_column(JSON, default=list)
    extractor_mode: Mapped[str | None] = mapped_column(String(20))
    processing_status: Mapped[str] = mapped_column(String(20), default="processed")  # processed | failed
    error: Mapped[str | None] = mapped_column(Text)
    raw_text_preview: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client: Mapped[Client | None] = relationship(back_populates="contracts")


def init_db() -> None:
    Base.metadata.create_all(engine)
