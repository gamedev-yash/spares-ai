"""
CPI client library - one reusable way to read SAP through the VZI CPI proxy.

    from cpi_client import CPIClient, Query

    with CPIClient.from_env() as cpi:
        print(cpi.count("VendorSet"))
        for row in cpi.get("VendorSet", top=5):
            print(row["Lifnr"], row.get("Name1"))

The plumbing this replaces was proven against the live tenant by
cpi_discovery.py; this package is that knowledge in one importable place,
with the pieces that script never needed - collection parsing, pagination,
type coercion and typed errors - added on top.

Layout follows the responsibilities:

    config.py   settings and .env loading
    auth.py     OAuth client-credentials, token caching
    query.py    APIPath and APIQuery construction
    parser.py   OData v2 envelope, __next, EDM type coercion
    retry.py    retry policy and backoff
    errors.py   HTTP status -> typed exception
    models.py   entity-set registry, read from discovery/properties.csv
    client.py   the facade that combines them
    cli.py      terminal interface (python -m cpi_client ...)
"""

from .client import CPIClient
from .config import CPIConfig, load_env_file
from .errors import (
    CPIAuthError,
    CPIBadRequestError,
    CPIConfigError,
    CPIError,
    CPIForbiddenError,
    CPINotFoundError,
    CPIParseError,
    CPIRateLimitError,
    CPIServerError,
    CPIServiceUnavailableError,
    CPITransportError,
)
from .models import EntitySetInfo, Page, Schema
from .query import Query, and_, build_api_path, eq, literal
from .retry import RetryPolicy

__version__ = "0.1.0"

__all__ = [
    "CPIClient",
    "CPIConfig",
    "load_env_file",
    "Query",
    "build_api_path",
    "literal",
    "eq",
    "and_",
    "Schema",
    "EntitySetInfo",
    "Page",
    "RetryPolicy",
    "CPIError",
    "CPIConfigError",
    "CPITransportError",
    "CPIParseError",
    "CPIAuthError",
    "CPIForbiddenError",
    "CPINotFoundError",
    "CPIBadRequestError",
    "CPIRateLimitError",
    "CPIServerError",
    "CPIServiceUnavailableError",
]
