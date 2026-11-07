-- 03_create_service.sql : first-time service creation (run once; CoCo can run it for you).
-- Prereqs: image pushed (DEPLOY.md step 3), 01b_secrets.sql done, 02_admin_request.sql approved.
USE ROLE FR_BETA_TESTER;
USE SCHEMA BETA_TEST_DB.DEV;

-- Copy the latest spec.yaml from the workspace to the spec stage
COPY FILES INTO @SKBP_SPECS
  FROM 'snow://workspace/USER$.PUBLIC."DEFAULT$"/versions/live/skbp_dashboard_zip_ready/snowflake/'
  FILES = ('spec.yaml');

CREATE SERVICE IF NOT EXISTS SKBP_DASHBOARD
  IN COMPUTE POOL SKBP_POOL
  FROM @SKBP_SPECS SPECIFICATION_FILE = 'spec.yaml'
  EXTERNAL_ACCESS_INTEGRATIONS = (SKBP_EAI)
  MIN_INSTANCES = 1
  MAX_INSTANCES = 1
  COMMENT = 'SKBP pipeline dashboard (FastAPI)';

-- Wait until READY (first start also seeds data onto the block volume)
SELECT SYSTEM$GET_SERVICE_STATUS('SKBP_DASHBOARD');
SELECT SYSTEM$GET_SERVICE_LOGS('SKBP_DASHBOARD', 0, 'dashboard', 200);

-- Public URL (may show "provisioning in progress" for a few minutes)
SHOW ENDPOINTS IN SERVICE SKBP_DASHBOARD;

-- Let other people use the dashboard (replace with their Snowflake role):
-- GRANT SERVICE ROLE SKBP_DASHBOARD!ALL_ENDPOINTS_USAGE TO ROLE <TEAM_ROLE>;
