-- 04_operations.sql : day-to-day operations. Never use the commands in the DANGER block.
USE ROLE FR_BETA_TESTER;
USE SCHEMA BETA_TEST_DB.DEV;

---------------------------------------------------------------- status / logs
SELECT SYSTEM$GET_SERVICE_STATUS('SKBP_DASHBOARD');
SELECT SYSTEM$GET_SERVICE_LOGS('SKBP_DASHBOARD', 0, 'dashboard', 300);
SHOW SERVICE CONTAINERS IN SERVICE SKBP_DASHBOARD;
SHOW SERVICE VOLUMES IN SERVICE SKBP_DASHBOARD;
SHOW ENDPOINTS IN SERVICE SKBP_DASHBOARD;

---------------------------------------------------------------- stop / start (data kept)
-- Stop the app (no compute for the service; block volume is kept and still billed for storage)
ALTER SERVICE SKBP_DASHBOARD SUSPEND;
-- Stop the node too (only after the service is suspended) -> compute billing stops
ALTER COMPUTE POOL SKBP_POOL SUSPEND;
-- Start again
ALTER COMPUTE POOL SKBP_POOL RESUME;
ALTER SERVICE SKBP_DASHBOARD RESUME;

---------------------------------------------------------------- update (in place, data kept)
-- 1. push new image with a NEW tag (e.g. v2) from the company PC (DEPLOY.md section 6)
-- 2. edit spec.yaml: image ...:v2 and SKBP_IMAGE_TAG "v2"
-- 3. take a backup first (below), then:
COPY FILES INTO @SKBP_SPECS
  FROM 'snow://workspace/USER$.PUBLIC."DEFAULT$"/versions/live/skbp_dashboard_zip_ready/snowflake/'
  FILES = ('spec.yaml');
ALTER SERVICE SKBP_DASHBOARD FROM @SKBP_SPECS SPECIFICATION_FILE = 'spec.yaml';
-- Roll back = set the previous tag in spec.yaml and run the two statements above again.

---------------------------------------------------------------- backup / restore
-- Backup (do this before every update; name it with the date)
CREATE SNAPSHOT SKBP_BACKUP_YYYYMMDD FROM SERVICE SKBP_DASHBOARD VOLUME "app-state" INSTANCE 0
  COMMENT = 'before update to vN';
SHOW SNAPSHOTS IN SCHEMA BETA_TEST_DB.DEV;
-- Restore (replaces the current volume content with the snapshot; service restarts)
ALTER SERVICE SKBP_DASHBOARD SUSPEND;
ALTER SERVICE SKBP_DASHBOARD RESTORE VOLUME "app-state" INSTANCES 0 FROM SNAPSHOT SKBP_BACKUP_YYYYMMDD;
-- Remove old backups you no longer need (snapshots are billed as storage)
-- DROP SNAPSHOT SKBP_BACKUP_YYYYMMDD;

---------------------------------------------------------------- cost
-- FR_BETA_TESTER cannot read SNOWFLAKE.ACCOUNT_USAGE; ask an admin to run this:
-- SELECT DATE_TRUNC('day', start_time) AS day, SUM(credits_used) AS credits
-- FROM SNOWFLAKE.ACCOUNT_USAGE.SNOWPARK_CONTAINER_SERVICES_HISTORY
-- WHERE compute_pool_name = 'SKBP_POOL' AND start_time >= DATEADD('day', -30, CURRENT_TIMESTAMP())
-- GROUP BY 1 ORDER BY 1;
-- You can always check whether the pool is running (= billing compute):
SHOW COMPUTE POOLS LIKE 'SKBP_POOL';

---------------------------------------------------------------- DANGER: deletes the data volume
-- DROP SERVICE SKBP_DASHBOARD FORCE;      -- deletes block volume (auto-snapshot kept only 7 days)
-- ALTER COMPUTE POOL SKBP_POOL STOP ALL;  -- deletes services AND their block volumes
-- Use SUSPEND/RESUME and ALTER SERVICE ... FROM SPECIFICATION instead.
