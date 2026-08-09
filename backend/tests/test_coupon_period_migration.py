from importlib import import_module
from unittest.mock import Mock

from pytest import MonkeyPatch


def test_upgrade_backfills_coupon_period_without_deleting_portfolio_data(
    monkeypatch: MonkeyPatch,
) -> None:
    migration = import_module(
        "migrations.versions.20260810_0004_add_coupon_period_days"
    )
    operations = Mock()
    monkeypatch.setattr(migration, "op", operations)

    migration.upgrade()

    assert [call[0] for call in operations.method_calls] == [
        "add_column",
        "execute",
        "create_check_constraint",
        "alter_column",
    ]
    column = operations.add_column.call_args.args[1]
    assert column.name == "coupon_period_days"
    assert column.nullable is True
    assert str(operations.execute.call_args.args[0]).strip() == (
        "UPDATE bonds\n"
        "    SET coupon_period_days = CASE payments_per_year\n"
        "        WHEN 1 THEN 365 WHEN 2 THEN 182 WHEN 3 THEN 122\n"
        "        WHEN 4 THEN 91 WHEN 6 THEN 61 WHEN 12 THEN 30\n"
        "    END"
    )
    assert operations.create_check_constraint.call_args.args == (
        "ck_bonds_coupon_period_days",
        "bonds",
        "coupon_period_days BETWEEN 1 AND 366",
    )
    assert operations.alter_column.call_args.args == ("bonds", "coupon_period_days")
    assert operations.alter_column.call_args.kwargs == {"nullable": False}
    assert all("DELETE" not in str(call).upper() for call in operations.method_calls)
