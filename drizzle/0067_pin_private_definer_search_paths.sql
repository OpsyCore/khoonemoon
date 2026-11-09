-- Pin private SECURITY DEFINER helpers too: temporary schemas must never be
-- implicitly searched ahead of trusted objects.
alter function backup_private.cleanup_allowed(text)
  set search_path to pg_catalog, public, backup_private, pg_temp;

alter function backup_private.enqueue_standalone_push()
  set search_path to pg_catalog, backup_private, net, pg_temp;

alter function backup_private.guard_document_path()
  set search_path to pg_catalog, backup_private, pg_temp;
