"""
Sandboxed Python executor for computed sensor fields.

This module provides a safe way to execute user-defined Python functions
for computing sensor field values. It restricts access to dangerous
operations while allowing HTTP requests for contextual data.

Uses multiprocessing for true timeout enforcement - processes can be
terminated if they exceed the timeout, unlike threads.
"""

import logging
import multiprocessing
from multiprocessing import Process, Queue
import sys
from typing import Any

logger = logging.getLogger(__name__)

# Maximum execution time for compute functions (seconds)
# 15 seconds allows for HTTP requests to external APIs while still
# protecting against runaway computations
COMPUTE_TIMEOUT = 15

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
            if top_level == "requests":
                raise ComputeSecurityError(
                    "Direct import of 'requests' is not allowed. "
                    "requests.get and requests.post are already in scope."
                )
            else:
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
    Run a function with a timeout using multiprocessing.
    
    Uses a separate process that can be terminated if it exceeds the timeout,
    providing true timeout enforcement unlike threading.
    
    Args:
        func: Function to execute (must be picklable)
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
    
    result_queue = Queue()
    
    def target(result_q, fn, fn_args, fn_kwargs):
        try:
            result = fn(*fn_args, **fn_kwargs)
            result_q.put(('success', result))
        except Exception as e:
            # Serialize exception info since exceptions may not be picklable
            result_q.put(('error', type(e).__name__, str(e)))
    
    process = Process(
        target=target, 
        args=(result_queue, func, args, kwargs),
        daemon=True
    )
    process.start()
    process.join(timeout)
    
    if process.is_alive():
        # Process is still running after timeout - terminate it
        process.terminate()
        process.join(1)  # Give it a second to terminate gracefully
        if process.is_alive():
            process.kill()  # Force kill if still running
            process.join()
        raise ComputeTimeoutError(f"Compute function timed out after {timeout} seconds")
    
    # Get result from queue
    if result_queue.empty():
        raise ComputeExecutionError("Compute function did not return a result")
    
    status = result_queue.get()
    if status[0] == 'success':
        return status[1]
    else:
        # Re-raise the exception
        error_type, error_msg = status[1], status[2]
        if error_type == 'ComputeSecurityError':
            raise ComputeSecurityError(error_msg)
        elif error_type == 'ComputeTimeoutError':
            raise ComputeTimeoutError(error_msg)
        else:
            raise ComputeExecutionError(f"{error_type}: {error_msg}")


def _execute_in_sandbox(code: str, input_data: dict, allowed_modules: set, safe_builtins: dict) -> Any:
    """
    Execute compute code in a sandboxed environment.
    This function is designed to be called in a subprocess.
    
    Args:
        code: Python code that defines a 'compute' function
        input_data: Dictionary of input values from sensor reading
        allowed_modules: Set of module names that can be imported
        safe_builtins: Dict of safe builtin functions
    
    Returns:
        The computed value
    """
    import importlib
    
    # Create the safe importer instance
    safe_importer = SafeImporter(allowed_modules)
    
    # Pre-import allowed modules and make them available
    preloaded_modules = {}
    for module_name in allowed_modules:
        try:
            preloaded_modules[module_name] = importlib.import_module(module_name)
        except ImportError:
            pass  # Module not available, skip it
    
    # Create a custom __builtins__ dict that includes __import__
    custom_builtins = dict(safe_builtins)
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
    
    # Execute the code to define the 'compute' function
    exec(code, safe_globals, local_vars)
    
    # Check that 'compute' function was defined
    if 'compute' not in local_vars:
        raise ComputeExecutionError(
            "Compute function must define a 'compute(data)' function"
        )
    
    compute_func = local_vars['compute']
    
    if not callable(compute_func):
        raise ComputeExecutionError("'compute' must be a callable function")
    
    # Call the compute function with input data
    return compute_func(input_data)


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
    try:
        # Run in subprocess with timeout for true isolation and timeout enforcement
        result = run_with_timeout(
            _execute_in_sandbox,
            args=(code, input_data, ALLOWED_MODULES, SAFE_BUILTINS),
            timeout=timeout
        )
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
