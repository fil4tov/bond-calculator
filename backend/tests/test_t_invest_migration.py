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


def test_accrued_coupon_income_migration_renames_refresh_marker_and_adds_value(monkeypatch: MonkeyPatch) -> None:
    migration = import_module("migrations.versions.20260812_0008_bond_accrued_coupon_income")
    operations = MagicMock()
    batch = MagicMock()
    operations.batch_alter_table.return_value.__enter__.return_value = batch
    monkeypatch.setattr(migration, "op", operations)

    migration.upgrade()
    upgrade_calls = list(batch.method_calls)
    batch.reset_mock()
    migration.downgrade()

    assert operations.batch_alter_table.call_args_list[0].args == ("bonds",)
    assert upgrade_calls[0].args[0] == "nominal_checked_on"
    assert upgrade_calls[0].kwargs["new_column_name"] == "instrument_checked_on"
    assert upgrade_calls[1].args[0].name == "aci_value"
    assert batch.drop_column.call_args.args == ("aci_value",)
    assert batch.alter_column.call_args.args == ("instrument_checked_on",)
    assert batch.alter_column.call_args.kwargs["new_column_name"] == "nominal_checked_on"
