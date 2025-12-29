"""
Sandboxed Python executor for computed sensor fields.

This module provides a safe way to execute user-defined Python functions
for computing sensor field values. It restricts access to dangerous
operations while allowing HTTP requests for contextual data.
"""

import logging
import threading
import sys
from typing import Any

logger = logging.getLogger(__name__)

# Maximum execution time for compute functions (seconds)
COMPUTE_TIMEOUT = 5

# Safe built-in functions allowed in compute functions
SAFE_BUILTINS = {
    'abs': abs,
    'all': all,
    'any': any,
    'bool': bool,
    'dict': dict,
    'enumerate': enumerate,
    'filter': filter,
    'float': float,
    'format': format,
    'frozenset': frozenset,
    'int': int,
    'isinstance': isinstance,
    'len': len,
    'list': list,
    'map': map,
    'max': max,
    'min': min,
    'pow': pow,
    'range': range,
    'reversed': reversed,
    'round': round,
    'set': set,
    'sorted': sorted,
    'str': str,
    'sum': sum,
    'tuple': tuple,
    'zip': zip,
    # Math constants
    'True': True,
    'False': False,
    'None': None,
}

# Safe modules that can be imported
ALLOWED_MODULES = {
    'math',
    'statistics',
    'datetime',
    'json',
    'urllib.parse',
    're',
    'decimal',
    'fractions',
    'random',
}


class ComputeError(Exception):
    """Base exception for compute errors."""
    pass


class ComputeTimeoutError(ComputeError):
    """Raised when a compute function takes too long."""
    pass


class ComputeSecurityError(ComputeError):
    """Raised when a compute function tries to access forbidden resources."""
    pass


class ComputeExecutionError(ComputeError):
    """Raised when a compute function raises an exception."""
    pass


class SafeImporter:
    """Custom importer that only allows safe modules."""
    
    def __init__(self, allowed_modules: set):
        self.allowed_modules = allowed_modules
        self._imported = {}
    
    def __call__(self, name, globals=None, locals=None, fromlist=(), level=0):
        # Get the top-level module name
        top_level = name.split('.')[0]
        
        if top_level not in self.allowed_modules:
            raise ComputeSecurityError(
                f"Import of '{name}' is not allowed. "
                f"Allowed modules: {', '.join(sorted(self.allowed_modules))}"
            )
        
        # Use cached import if available
        if name in self._imported:
            return self._imported[name]
        
        # Actually import the module
        import importlib
        try:
            module = importlib.import_module(name)
            self._imported[name] = module
            return module
        except ImportError as e:
            raise ComputeExecutionError(f"Failed to import '{name}': {e}")


def create_safe_requests():
    """
    Create a safe requests wrapper that allows HTTP calls but with restrictions.
    """
    try:
        import requests
    except ImportError:
        return None
    
    class SafeRequests:
        """Limited requests interface for compute functions."""
        
        def __init__(self, timeout=10):
            self.timeout = timeout
            self._session = None
        
        @property
        def session(self):
            if self._session is None:
                self._session = requests.Session()
            return self._session
        
        def get(self, url, **kwargs):
            """Make a GET request with safety limits."""
            kwargs.setdefault('timeout', self.timeout)
            # Don't allow file:// or other local protocols
            if not url.startswith(('http://', 'https://')):
                raise ComputeSecurityError("Only HTTP/HTTPS URLs are allowed")
            return self.session.get(url, **kwargs)
        
        def post(self, url, **kwargs):
            """Make a POST request with safety limits."""
            kwargs.setdefault('timeout', self.timeout)
            if not url.startswith(('http://', 'https://')):
                raise ComputeSecurityError("Only HTTP/HTTPS URLs are allowed")
            return self.session.post(url, **kwargs)
    
    return SafeRequests()


def run_with_timeout(func, args=(), kwargs=None, timeout=5):
    """
    Run a function with a timeout using threading.
    
    This is thread-safe and works in Django/WSGI environments where
    signal-based timeouts don't work.
    
    Args:
        func: Function to execute
        args: Positional arguments for func
        kwargs: Keyword arguments for func
        timeout: Maximum execution time in seconds
    
    Returns:
        The function's return value
    
    Raises:
        ComputeTimeoutError: If execution exceeds timeout
        Exception: Any exception raised by func
    """
    if kwargs is None:
        kwargs = {}
    
    result = [None]
    exception = [None]
    
    def target():
        try:
            result[0] = func(*args, **kwargs)
        except Exception as e:
            exception[0] = e
    
    thread = threading.Thread(target=target, daemon=True)
    thread.start()
    thread.join(timeout)
    
    if thread.is_alive():
        # Thread is still running after timeout
        # Note: We can't actually kill the thread in Python, but we can
        # abandon it and raise an error
        raise ComputeTimeoutError(f"Compute function timed out after {timeout} seconds")
    
    if exception[0] is not None:
        raise exception[0]
    
    return result[0]


def execute_compute_function(
    code: str,
    input_data: dict,
    timeout: int = COMPUTE_TIMEOUT
) -> Any:
    """
    Execute a compute function in a sandboxed environment.
    
    Args:
        code: Python code that defines a 'compute' function
        input_data: Dictionary of input values from sensor reading
        timeout: Maximum execution time in seconds
    
    Returns:
        The computed value
    
    Raises:
        ComputeError: If execution fails for any reason
    """
    import importlib
    
    # Pre-import allowed modules and make them available
    preloaded_modules = {}
    for module_name in ALLOWED_MODULES:
        try:
            preloaded_modules[module_name] = importlib.import_module(module_name)
        except ImportError:
            pass  # Module not available, skip it
    
    # Create the safe importer instance
    safe_importer = SafeImporter(ALLOWED_MODULES)
    
    # Create a custom __builtins__ dict that includes __import__
    custom_builtins = dict(SAFE_BUILTINS)
    custom_builtins['__import__'] = safe_importer
    
    # Create the restricted globals with preloaded modules available
    safe_globals = {
        '__builtins__': custom_builtins,
        '__name__': '__compute__',
        **preloaded_modules,  # Make modules directly available without import
    }
    
    # Add safe requests if available
    safe_requests = create_safe_requests()
    if safe_requests:
        safe_globals['requests'] = safe_requests
    
    # Create locals dict for executed code
    local_vars = {}
    
    try:
        # Execute the code to define the 'compute' function (with timeout)
        def exec_code():
            exec(code, safe_globals, local_vars)
        
        run_with_timeout(exec_code, timeout=timeout)
        
        # Check that 'compute' function was defined
        if 'compute' not in local_vars:
            raise ComputeExecutionError(
                "Compute function must define a 'compute(data)' function"
            )
        
        compute_func = local_vars['compute']
        
        if not callable(compute_func):
            raise ComputeExecutionError("'compute' must be a callable function")
        
        # Call the compute function with input data (with timeout)
        result = run_with_timeout(compute_func, args=(input_data,), timeout=timeout)
        
        return result
        
    except ComputeError:
        # Re-raise our own errors
        raise
    except Exception as e:
        # Wrap other exceptions
        error_type = type(e).__name__
        raise ComputeExecutionError(f"{error_type}: {str(e)}")


def compute_field_values(
    sensor,
    reading: dict,
    computed_columns: dict
) -> tuple[dict, list]:
    """
    Compute values for all computed fields in a sensor reading.
    
    Args:
        sensor: The Sensor instance
        reading: The sensor reading data
        computed_columns: Dict of computed column definitions
    
    Returns:
        Tuple of (computed_values dict, errors list)
        Each error is a dict with field_name, error_type, error_message, input_data
    """
    computed_values = {}
    errors = []
    
    for field_name, col_def in computed_columns.items():
        compute_function = col_def.get('compute_function', '')
        
        try:
            value = execute_compute_function(compute_function, reading.copy())
            computed_values[field_name] = value
        except ComputeError as e:
            error_type = type(e).__name__
            errors.append({
                'field_name': field_name,
                'error_type': error_type,
                'error_message': str(e),
                'input_data': reading,
            })
            # Set computed value to None on error
            computed_values[field_name] = None
        except Exception as e:
            error_type = type(e).__name__
            errors.append({
                'field_name': field_name,
                'error_type': error_type,
                'error_message': str(e),
                'input_data': reading,
            })
            computed_values[field_name] = None
    
    return computed_values, errors
