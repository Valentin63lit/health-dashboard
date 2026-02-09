"""
Structured logging for the Health Dashboard.
Format: [TIMESTAMP] [SOURCE] [ACTION] MESSAGE
Logs to both stdout and execution.log file.
"""

import logging
import os
import sys
from datetime import datetime
from pathlib import Path

import pytz

# Project root (two levels up from utils/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
LOG_FILE = PROJECT_ROOT / "execution.log"
TIMEZONE = pytz.timezone(os.getenv("TIMEZONE", "Europe/Sofia"))


class SofiaFormatter(logging.Formatter):
    """Custom formatter that uses Europe/Sofia timezone."""

    def formatTime(self, record, datefmt=None):
        dt = datetime.fromtimestamp(record.created, tz=TIMEZONE)
        if datefmt:
            return dt.strftime(datefmt)
        return dt.strftime("%Y-%m-%d %H:%M:%S")


class HealthLogger:
    """Structured logger with source and action context."""

    def __init__(self, source: str):
        self.source = source
        self.logger = logging.getLogger(f"health_dashboard.{source}")

    def _format_msg(self, action: str, message: str) -> str:
        return f"[{self.source.upper()}] [{action}] {message}"

    def info(self, action: str, message: str):
        self.logger.info(self._format_msg(action, message))

    def error(self, action: str, message: str):
        self.logger.error(self._format_msg(action, message))

    def warning(self, action: str, message: str):
        self.logger.warning(self._format_msg(action, message))

    def debug(self, action: str, message: str):
        self.logger.debug(self._format_msg(action, message))


def setup_logging(level: str = "INFO"):
    """
    Initialize logging for the entire application.
    Call this once at startup (in main.py).
    """
    log_level = getattr(logging, level.upper(), logging.INFO)
    root_logger = logging.getLogger("health_dashboard")
    root_logger.setLevel(log_level)

    # Prevent duplicate handlers if called multiple times
    if root_logger.handlers:
        return

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_fmt = SofiaFormatter(
        fmt="[%(asctime)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    console_handler.setFormatter(console_fmt)
    root_logger.addHandler(console_handler)

    # File handler
    try:
        file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
        file_handler.setLevel(log_level)
        file_fmt = SofiaFormatter(
            fmt="[%(asctime)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        file_handler.setFormatter(file_fmt)
        root_logger.addHandler(file_handler)
    except (PermissionError, OSError) as e:
        console_handler.stream.write(f"⚠️  Could not create log file: {e}\n")


def get_logger(source: str) -> HealthLogger:
    """Get a structured logger for a specific module/source."""
    return HealthLogger(source)
