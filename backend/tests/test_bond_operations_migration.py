from importlib import import_module
from unittest.mock import Mock

from pytest import MonkeyPatch


def test_0006_creates_operations_and_copies_legacy_purchases_before_dropping_them(
    monkeypatch: MonkeyPatch,
) -> None:
    migration = import_module("migrations.versions.20260811_0006_bond_operations")
    operations = Mock()
    monkeypatch.setattr(migration, "op", operations)

    migration.upgrade()

    created = operations.create_table.call_args.args
    assert created[0] == "bond_operations"
    column_names = {column.name for column in created[1:] if hasattr(column, "name")}
    assert {
        "bond_id",
        "user_id",
        "operation_type",
        "amount",
        "quantity",
        "operation_date",
        "created_at",
    } <= column_names
    copied_sql = str(operations.execute.call_args.args[0]).upper()
    assert "INSERT INTO BOND_OPERATIONS" in copied_sql
    assert "FROM BOND_PURCHASES" in copied_sql
    assert operations.drop_table.call_args.args == ("bond_purchases",)
