from importlib import import_module
from unittest.mock import Mock

from pytest import MonkeyPatch


def test_destructive_t_invest_migration_replaces_legacy_tables_and_creates_schedule(monkeypatch: MonkeyPatch) -> None:
    migration = import_module("migrations.versions.20260811_0005_t_invest_coupon_schedules")
    operations = Mock()
    monkeypatch.setattr(migration, "op", operations)

    migration.upgrade()

    assert [call.args[0] for call in operations.drop_table.call_args_list] == ["bond_purchases", "bonds"]
    schedule = next(call.args for call in operations.create_table.call_args_list if call.args[0] == "bond_coupon_schedules")
    names = {column.name for column in schedule[1:] if hasattr(column, "name")}
    assert {"bond_id", "figi", "coupon_date", "coupon_number", "pay_one_bond_amount", "coupon_period"} <= names
    assert any(call.args == ("ix_bond_coupon_schedules_bond_id_coupon_date", "bond_coupon_schedules", ["bond_id", "coupon_date"]) for call in operations.create_index.call_args_list)
