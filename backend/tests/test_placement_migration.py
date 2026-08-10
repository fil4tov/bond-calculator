from importlib import import_module
from unittest.mock import Mock

from pytest import MonkeyPatch


def test_upgrade_clears_legacy_portfolio_before_adding_required_placement_date(
    monkeypatch: MonkeyPatch,
) -> None:
    migration = import_module(
        "migrations.versions.20260810_0003_add_bond_placement_date"
    )
    operations = Mock()
    monkeypatch.setattr(migration, "op", operations)

    migration.upgrade()

    assert [call[0] for call in operations.method_calls] == [
        "execute",
        "execute",
        "add_column",
        "create_check_constraint",
    ]
    assert str(operations.execute.call_args_list[0].args[0]) == "DELETE FROM bond_purchases"
    assert str(operations.execute.call_args_list[1].args[0]) == "DELETE FROM bonds"
    column = operations.add_column.call_args.args[1]
    assert column.name == "placement_date"
    assert column.nullable is False
    assert operations.create_check_constraint.call_args.args == (
        "ck_bonds_placement_before_maturity",
        "bonds",
        "placement_date < maturity_date",
    )
