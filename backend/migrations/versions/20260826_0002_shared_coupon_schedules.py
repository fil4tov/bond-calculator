"""Share coupon schedules by instrument UID and backfill complete schedules.

Revision ID: 20260826_0002
Revises: 20260813_0001
Create Date: 2026-08-26
"""

from collections.abc import Sequence
from datetime import UTC, date, datetime, time
from decimal import Decimal
from typing import Any
from uuid import uuid4

from alembic import op
import sqlalchemy as sa

from app.config import get_settings

revision: str = "20260826_0002"
down_revision: str | None = "20260813_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _money_value_to_decimal(value: Any) -> Decimal:
    return Decimal(value.units) + Decimal(value.nano).scaleb(-9)


def _as_date(value: datetime | None) -> date | None:
    return value.date() if value is not None else None


def _fetch_coupon_schedules(
    instruments: list[dict[str, Any]], token: str
) -> dict[str, tuple[datetime, list[dict[str, Any]]]]:
    from t_tech.invest import Client

    schedules: dict[str, tuple[datetime, list[dict[str, Any]]]] = {}
    try:
        with Client(token) as client:
            for instrument in instruments:
                response = client.instruments.get_bond_coupons(
                    instrument_id=instrument["instrument_uid"],
                    from_=datetime.combine(
                        instrument["placement_date"], time.min, tzinfo=UTC
                    ),
                    to=datetime.combine(
                        instrument["maturity_date"], time.max, tzinfo=UTC
                    ),
                )
                events = [
                    {
                        "figi": event.figi,
                        "coupon_date": event.coupon_date.date(),
                        "coupon_number": event.coupon_number,
                        "fix_date": _as_date(event.fix_date),
                        "pay_one_bond_amount": _money_value_to_decimal(event.pay_one_bond),
                        "pay_one_bond_currency": event.pay_one_bond.currency,
                        "coupon_type": int(event.coupon_type),
                        "coupon_start_date": event.coupon_start_date.date(),
                        "coupon_end_date": event.coupon_end_date.date(),
                        "coupon_period": event.coupon_period,
                    }
                    for event in response.events
                ]
                schedules[instrument["instrument_uid"]] = (datetime.now(UTC), events)
    except Exception as error:
        raise RuntimeError("Unable to backfill coupon schedules from T-Invest") from error
    return schedules


def _validate_schedule(
    instrument: dict[str, Any],
    events: list[dict[str, Any]],
    historical_identities: set[tuple[int, date]],
) -> None:
    if instrument["payments_per_year"] > 0 and not events:
        raise RuntimeError(
            f"T-Invest returned an empty coupon schedule for {instrument['instrument_uid']}"
        )
    identities: set[tuple[int, date]] = set()
    for event in events:
        identity = (event["coupon_number"], event["coupon_date"])
        if (
            identity in identities
            or event["pay_one_bond_amount"] < 0
            or event["coupon_period"] < 0
            or event["coupon_start_date"] > event["coupon_end_date"]
        ):
            raise RuntimeError(
                f"T-Invest returned an invalid coupon schedule for {instrument['instrument_uid']}"
            )
        identities.add(identity)
    if not historical_identities.issubset(identities):
        raise RuntimeError(
            f"T-Invest omitted historical coupons for {instrument['instrument_uid']}"
        )


def upgrade() -> None:
    connection = op.get_bind()
    instruments = [
        dict(row)
        for row in connection.execute(
            sa.text(
                """
                SELECT instrument_uid,
                       min(placement_date) AS placement_date,
                       max(maturity_date) AS maturity_date,
                       max(payments_per_year) AS payments_per_year
                FROM bonds
                GROUP BY instrument_uid
                ORDER BY instrument_uid
                """
            )
        ).mappings()
    ]
    historical_by_uid: dict[str, set[tuple[int, date]]] = {
        instrument["instrument_uid"]: set() for instrument in instruments
    }
    for row in connection.execute(
        sa.text(
            """
            SELECT DISTINCT b.instrument_uid, c.coupon_number, c.coupon_date
            FROM bond_coupon_schedules AS c
            JOIN bonds AS b ON b.id = c.bond_id
            WHERE c.coupon_date <= CURRENT_DATE
            """
        )
    ).mappings():
        historical_by_uid[row["instrument_uid"]].add(
            (row["coupon_number"], row["coupon_date"])
        )

    schedules: dict[str, tuple[datetime, list[dict[str, Any]]]] = {}
    if instruments:
        token = get_settings().t_invest_api_key
        if not token:
            raise RuntimeError(
                "T_INVEST_API_KEY is required to migrate existing coupon schedules"
            )
        schedules = _fetch_coupon_schedules(instruments, token)
        for instrument in instruments:
            _updated_at, events = schedules[instrument["instrument_uid"]]
            _validate_schedule(
                instrument,
                events,
                historical_by_uid[instrument["instrument_uid"]],
            )

    op.create_table(
        "bond_coupon_schedule_syncs",
        sa.Column("instrument_uid", sa.String(length=64), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("instrument_uid"),
    )
    op.add_column(
        "bond_coupon_schedules",
        sa.Column("instrument_uid", sa.String(length=64), nullable=True),
    )
    op.drop_index(
        "ix_bond_coupon_schedules_bond_id_coupon_date",
        table_name="bond_coupon_schedules",
    )
    op.drop_constraint(
        "uq_bond_coupon_schedule_event",
        "bond_coupon_schedules",
        type_="unique",
    )
    op.drop_constraint(
        "bond_coupon_schedules_bond_id_fkey",
        "bond_coupon_schedules",
        type_="foreignkey",
    )
    op.alter_column(
        "bond_coupon_schedules",
        "bond_id",
        existing_type=sa.Uuid(),
        nullable=True,
    )
    connection.execute(sa.text("DELETE FROM bond_coupon_schedules"))

    sync_table = sa.table(
        "bond_coupon_schedule_syncs",
        sa.column("instrument_uid", sa.String()),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    schedule_table = sa.table(
        "bond_coupon_schedules",
        sa.column("id", sa.Uuid()),
        sa.column("bond_id", sa.Uuid()),
        sa.column("instrument_uid", sa.String()),
        sa.column("figi", sa.String()),
        sa.column("coupon_date", sa.Date()),
        sa.column("coupon_number", sa.BigInteger()),
        sa.column("fix_date", sa.Date()),
        sa.column("pay_one_bond_amount", sa.Numeric(28, 9)),
        sa.column("pay_one_bond_currency", sa.String()),
        sa.column("coupon_type", sa.Integer()),
        sa.column("coupon_start_date", sa.Date()),
        sa.column("coupon_end_date", sa.Date()),
        sa.column("coupon_period", sa.Integer()),
    )
    for instrument in instruments:
        instrument_uid = instrument["instrument_uid"]
        updated_at, events = schedules[instrument_uid]
        op.bulk_insert(
            sync_table,
            [{"instrument_uid": instrument_uid, "updated_at": updated_at}],
        )
        if events:
            op.bulk_insert(
                schedule_table,
                [
                    {
                        "id": uuid4(),
                        "bond_id": None,
                        "instrument_uid": instrument_uid,
                        **event,
                    }
                    for event in events
                ],
            )

    op.alter_column(
        "bond_coupon_schedules",
        "instrument_uid",
        existing_type=sa.String(length=64),
        nullable=False,
    )
    op.drop_column("bond_coupon_schedules", "bond_id")
    op.create_foreign_key(
        "fk_bond_coupon_schedules_instrument_uid",
        "bond_coupon_schedules",
        "bond_coupon_schedule_syncs",
        ["instrument_uid"],
        ["instrument_uid"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint(
        "uq_bond_coupon_schedule_event",
        "bond_coupon_schedules",
        ["instrument_uid", "coupon_number", "coupon_date"],
    )
    op.create_index(
        "ix_bond_coupon_schedules_instrument_uid_coupon_date",
        "bond_coupon_schedules",
        ["instrument_uid", "coupon_date"],
    )


def downgrade() -> None:
    connection = op.get_bind()
    restored_events = [
        dict(row)
        for row in connection.execute(
            sa.text(
                """
                SELECT b.id AS bond_id,
                       c.figi,
                       c.coupon_date,
                       c.coupon_number,
                       c.fix_date,
                       c.pay_one_bond_amount,
                       c.pay_one_bond_currency,
                       c.coupon_type,
                       c.coupon_start_date,
                       c.coupon_end_date,
                       c.coupon_period
                FROM bonds AS b
                JOIN bond_coupon_schedules AS c
                  ON c.instrument_uid = b.instrument_uid
                ORDER BY b.id, c.coupon_date, c.coupon_number
                """
            )
        ).mappings()
    ]

    op.drop_index(
        "ix_bond_coupon_schedules_instrument_uid_coupon_date",
        table_name="bond_coupon_schedules",
    )
    op.drop_constraint(
        "uq_bond_coupon_schedule_event",
        "bond_coupon_schedules",
        type_="unique",
    )
    op.drop_constraint(
        "fk_bond_coupon_schedules_instrument_uid",
        "bond_coupon_schedules",
        type_="foreignkey",
    )
    op.add_column(
        "bond_coupon_schedules",
        sa.Column("bond_id", sa.Uuid(), nullable=True),
    )
    op.alter_column(
        "bond_coupon_schedules",
        "instrument_uid",
        existing_type=sa.String(length=64),
        nullable=True,
    )
    connection.execute(sa.text("DELETE FROM bond_coupon_schedules"))

    schedule_table = sa.table(
        "bond_coupon_schedules",
        sa.column("id", sa.Uuid()),
        sa.column("bond_id", sa.Uuid()),
        sa.column("instrument_uid", sa.String()),
        sa.column("figi", sa.String()),
        sa.column("coupon_date", sa.Date()),
        sa.column("coupon_number", sa.BigInteger()),
        sa.column("fix_date", sa.Date()),
        sa.column("pay_one_bond_amount", sa.Numeric(28, 9)),
        sa.column("pay_one_bond_currency", sa.String()),
        sa.column("coupon_type", sa.Integer()),
        sa.column("coupon_start_date", sa.Date()),
        sa.column("coupon_end_date", sa.Date()),
        sa.column("coupon_period", sa.Integer()),
    )
    if restored_events:
        op.bulk_insert(
            schedule_table,
            [
                {
                    "id": uuid4(),
                    "instrument_uid": None,
                    **event,
                }
                for event in restored_events
            ],
        )
    op.alter_column(
        "bond_coupon_schedules",
        "bond_id",
        existing_type=sa.Uuid(),
        nullable=False,
    )
    op.drop_column("bond_coupon_schedules", "instrument_uid")
    op.create_foreign_key(
        "bond_coupon_schedules_bond_id_fkey",
        "bond_coupon_schedules",
        "bonds",
        ["bond_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint(
        "uq_bond_coupon_schedule_event",
        "bond_coupon_schedules",
        ["bond_id", "coupon_number", "coupon_date"],
    )
    op.create_index(
        "ix_bond_coupon_schedules_bond_id_coupon_date",
        "bond_coupon_schedules",
        ["bond_id", "coupon_date"],
    )
    op.drop_table("bond_coupon_schedule_syncs")
