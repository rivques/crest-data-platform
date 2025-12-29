"""
Sensor schema utilities for dynamic table creation.

Sensors can have arbitrary column schemas defined at creation time.
Each column has a name and a PostgreSQL-compatible data type.
Columns can optionally be marked as "computed" with a Python function.
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


def validate_compute_function(code: str) -> tuple[bool, str]:
    """
    Validate a compute function's Python syntax.
    Returns (is_valid, error_message).
    """
    import ast
    
    if not code or not code.strip():
        return False, "Compute function cannot be empty"
    
    try:
        # Parse the code to check for syntax errors
        ast.parse(code)
    except SyntaxError as e:
        return False, f"Syntax error in compute function: {e.msg} at line {e.lineno}"
    
    return True, ""


def validate_column_schema(schema: dict) -> tuple[bool, str]:
    """
    Validate a column schema.
    Returns (is_valid, error_message).
    
    Schema format can be either:
    - Simple: {"column_name": "TYPE"}
    - Extended: {"column_name": {"type": "TYPE", "computed": true, "compute_function": "def compute(data):\n  return data['x'] * 2"}}
    """
    import re
    
    if not schema:
        return False, "Schema cannot be empty - at least one column is required"
    
    if not isinstance(schema, dict):
        return False, "Schema must be a dictionary mapping column names to types"
    
    computed_fields = []
    regular_fields = []
    
    for col_name, col_def in schema.items():
        # Validate column name (alphanumeric and underscore, must start with letter)
        if not re.match(r'^[a-zA-Z][a-zA-Z0-9_]*$', col_name):
            return False, f"Invalid column name: '{col_name}'. Must start with a letter and contain only alphanumeric characters and underscores."
        
        # Reserved column names (these are auto-created)
        reserved = ['id', 'experiment_id', 'timestamp', 'created_at']
        if col_name.lower() in reserved:
            return False, f"Column name '{col_name}' is reserved. Reserved names: {', '.join(reserved)}"
        
        # Handle both simple and extended format
        if isinstance(col_def, str):
            # Simple format: just the type
            col_type = col_def
            is_computed = False
        elif isinstance(col_def, dict):
            # Extended format: {type, computed, compute_function}
            col_type = col_def.get('type')
            is_computed = col_def.get('computed', False)
            
            if not col_type:
                return False, f"Column '{col_name}' must have a 'type' field"
            
            if is_computed:
                compute_function = col_def.get('compute_function', '')
                if not compute_function:
                    return False, f"Computed column '{col_name}' must have a 'compute_function'"
                
                # Validate the compute function syntax
                is_valid, error = validate_compute_function(compute_function)
                if not is_valid:
                    return False, f"Column '{col_name}': {error}"
                
                computed_fields.append(col_name)
        else:
            return False, f"Column '{col_name}' definition must be a string (type) or object (with type, computed, compute_function)"
        
        # Validate column type
        if col_type.upper() not in [t.upper() for t in ALLOWED_COLUMN_TYPES]:
            return False, f"Invalid column type: '{col_type}'. Allowed types: {', '.join(ALLOWED_COLUMN_TYPES)}"
        
        # Track non-computed fields (simple string format or extended format with computed=false)
        if not (isinstance(col_def, dict) and col_def.get('computed', False)):
            regular_fields.append(col_name)
    
    # Must have at least one non-computed field (sensor must report something)
    if not regular_fields:
        return False, "Schema must have at least one non-computed column for sensor data"
    
    return True, ""


def get_column_type(col_def) -> str:
    """Extract the column type from a column definition."""
    if isinstance(col_def, str):
        return col_def.upper()
    elif isinstance(col_def, dict):
        return col_def.get('type', '').upper()
    return ''


def is_computed_field(col_def) -> bool:
    """Check if a column definition is for a computed field."""
    if isinstance(col_def, dict):
        return col_def.get('computed', False)
    return False


def get_compute_function(col_def) -> str:
    """Get the compute function from a column definition."""
    if isinstance(col_def, dict):
        return col_def.get('compute_function', '')
    return ''


def get_regular_columns(schema: dict) -> dict:
    """Get only the non-computed columns from a schema."""
    result = {}
    for col_name, col_def in schema.items():
        if not is_computed_field(col_def):
            result[col_name] = get_column_type(col_def)
    return result


def get_computed_columns(schema: dict) -> dict:
    """Get only the computed columns from a schema."""
    result = {}
    for col_name, col_def in schema.items():
        if is_computed_field(col_def):
            result[col_name] = {
                'type': get_column_type(col_def),
                'compute_function': get_compute_function(col_def)
            }
    return result

