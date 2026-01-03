"""Formatter utilities for complex-test skill."""

def format_output(message: str) -> str:
    """Format output with decorative border."""
    border = "=" * (len(message) + 4)
    return f"{border}\n| {message} |\n{border}"
