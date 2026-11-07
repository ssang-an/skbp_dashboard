-- 03q_quickstart_service.sql : start the dashboard with the privileges FR_BETA_TESTER already has.
-- Uses the shared SYSTEM_COMPUTE_POOL_CPU (USAGE granted to PUBLIC) and BIND SERVICE ENDPOINT
-- (granted to PUBLIC). No secrets, no external access. AI features use Snowflake Cortex through the
-- service session token (LLM_PROVIDER=cortex); e-mail and the OpenRouter PDF parser are off.
-- Prereq: image pushed to BETA_TEST_DB.DEV.SKBP_REPO as skbp-dashboard:v1 (DEPLOY.md section 3).
-- Later move to the full setup with ALTER SERVICE ... FROM SPECIFICATION (no DROP; data is kept).
USE ROLE FR_BETA_TESTER;
USE SCHEMA BETA_TEST_DB.DEV;

COPY FILES INTO @SKBP_SPECS
  FROM 'snow://workspace/USER$.PUBLIC."DEFAULT$"/versions/live/skbp_dashboard_zip_ready/snowflake/'
  FILES = ('spec.quickstart.yaml');

CREATE SERVICE IF NOT EXISTS SKBP_DASHBOARD
  IN COMPUTE POOL SYSTEM_COMPUTE_POOL_CPU
  FROM @SKBP_SPECS SPECIFICATION_FILE = 'spec.quickstart.yaml'
  QUERY_WAREHOUSE = WH_BETATEST
  MIN_INSTANCES = 1
  MAX_INSTANCES = 1
  COMMENT = 'SKBP pipeline dashboard (quick-start, Cortex AI, no external access)';

SELECT SYSTEM$GET_SERVICE_STATUS('SKBP_DASHBOARD');
SELECT SYSTEM$GET_SERVICE_LOGS('SKBP_DASHBOARD', 0, 'dashboard', 200);
SHOW ENDPOINTS IN SERVICE SKBP_DASHBOARD;

-- Stop when not in use (data on the block volume is kept):
-- ALTER SERVICE SKBP_DASHBOARD SUSPEND;
-- Do NOT: DROP SERVICE SKBP_DASHBOARD FORCE  (deletes the data volume)
