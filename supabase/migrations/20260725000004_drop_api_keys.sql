-- Drop the api_keys table.
--
-- It existed solely to authenticate the MCP server (`POST /api/mcp`) with
-- personal `gz_live_*` bearer keys. The MCP feature was removed: it went unused,
-- and it was the only surface in the app authenticating by API key rather than a
-- cookie session -- a second auth model the move to Next would have had to port.

drop table if exists public.api_keys cascade;
