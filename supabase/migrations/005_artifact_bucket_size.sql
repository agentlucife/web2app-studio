-- Web2App Studio — ensure the artifacts bucket allows large files.
-- The free-tier default (50 MB) is too small for some build artifacts.

update storage.buckets set file_size_limit = 536870912 where id = 'artifacts';
