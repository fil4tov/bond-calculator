from importlib import import_module
from unittest.mock import Mock

from pytest import MonkeyPatch


def test_0004_upgrade_backfills_coupon_period_without_deleting_portfolio_data(
    monkeypatch: MonkeyPatch,
) -> None:
    migration = import_module("migrations.versions.20260810_0004_add_coupon_period_days")
    operations = Mock()
    monkeypatch.setattr(migration, "op", operations)

    migration.upgrade()

    assert [call[0] for call in operations.method_calls] == [
        "add_column",
        "execute",
        "create_check_constraint",
        "alter_column",
    ]
    assert operations.add_column.call_args.args[1].name == "coupon_period_days"
    assert operations.add_column.call_args.args[1].nullable is True
    assert operations.create_check_constraint.call_args.args == (
        "ck_bonds_coupon_period_days",
        "bonds",
        "coupon_period_days BETWEEN 1 AND 366",
    )
    assert all("DELETE" not in str(call).upper() for call in operations.method_calls)
