## SQL Server connection configuration

1. Copy `.env.example` to `.env`.
2. Set `DB_SERVER`, `DB_DATABASE`, `DB_USER`, and `DB_PASSWORD`.
3. Ensure TCP/IP is enabled for SQL Server if connecting over TCP. For a named instance, you may need to configure a fixed TCP port or adjust the connection config in `src/db.js`.

The default configuration uses SQL username/password authentication. If your SQL Server uses Windows Integrated Authentication, the `mssql` package setup differs by environment; use a supported driver/configuration for your setup rather than putting Windows credentials in `.env`.
