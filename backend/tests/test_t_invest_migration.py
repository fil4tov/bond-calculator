from importlib import import_module
from unittest.mock import MagicMock, Mock

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


def test_nominal_refresh_migration_uses_portable_batch_column_change(monkeypatch: MonkeyPatch) -> None:
    migration = import_module("migrations.versions.20260812_0007_bond_nominal_refresh")
    operations = MagicMock()
    batch = MagicMock()
    operations.batch_alter_table.return_value.__enter__.return_value = batch
    monkeypatch.setattr(migration, "op", operations)

    migration.upgrade()
    migration.downgrade()

    assert operations.batch_alter_table.call_args_list[0].args == ("bonds",)
    assert batch.add_column.call_args.args[0].name == "nominal_checked_on"
    assert batch.drop_column.call_args.args == ("nominal_checked_on",)
