"""
Sensor schema utilities for dynamic table creation.

Sensors can have arbitrary column schemas defined at creation time.
Each column has a name and a PostgreSQL-compatible data type.
"""

# Allowed PostgreSQL types for sensor columns
ALLOWED_COLUMN_TYPES = [
    "DOUBLE PRECISION",
    "REAL",
    "INTEGER",
    "BIGINT",
    "SMALLINT",
    "BOOLEAN",
    "VARCHAR(50)",
    "VARCHAR(100)",
    "VARCHAR(255)",
    "TEXT",
    "TIMESTAMPTZ",
    "DATE",
]


def validate_column_schema(schema: dict) -> tuple[bool, str]:
    """
    Validate a column schema.
    Returns (is_valid, error_message).
    """
    import re
    
    if not schema:
        return False, "Schema cannot be empty - at least one column is required"
    
    if not isinstance(schema, dict):
        return False, "Schema must be a dictionary mapping column names to types"
    
    for col_name, col_type in schema.items():
        # Validate column name (alphanumeric and underscore, must start with letter)
        if not re.match(r'^[a-zA-Z][a-zA-Z0-9_]*$', col_name):
            return False, f"Invalid column name: '{col_name}'. Must start with a letter and contain only alphanumeric characters and underscores."
        
        # Validate column type
        if col_type.upper() not in [t.upper() for t in ALLOWED_COLUMN_TYPES]:
            return False, f"Invalid column type: '{col_type}'. Allowed types: {', '.join(ALLOWED_COLUMN_TYPES)}"
        
        # Reserved column names (these are auto-created)
        reserved = ['id', 'experiment_id', 'timestamp', 'created_at']
        if col_name.lower() in reserved:
            return False, f"Column name '{col_name}' is reserved. Reserved names: {', '.join(reserved)}"
    
    return True, ""

