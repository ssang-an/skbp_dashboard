-- 02_admin_request.sql : to be run by an ACCOUNTADMIN (or equivalent) on account RSB26080.
-- Purpose: let role FR_BETA_TESTER run the SKBP pipeline dashboard on Snowpark Container Services.
-- Objects already created by FR_BETA_TESTER: image repo BETA_TEST_DB.DEV.SKBP_REPO,
-- network rule BETA_TEST_DB.DEV.SKBP_EGRESS_RULE (openrouter.ai:443 [+ SMTP relay host]).
USE ROLE ACCOUNTADMIN;

-- (1) Dedicated small compute pool: 1 node, CPU_X64_XS, can be suspended independently.
CREATE COMPUTE POOL IF NOT EXISTS SKBP_POOL
  MIN_NODES = 1
  MAX_NODES = 1
  INSTANCE_FAMILY = CPU_X64_XS
  AUTO_RESUME = TRUE
  AUTO_SUSPEND_SECS = 3600
  COMMENT = 'SKBP pipeline dashboard (owner: FR_BETA_TESTER)';
GRANT USAGE, MONITOR, OPERATE ON COMPUTE POOL SKBP_POOL TO ROLE FR_BETA_TESTER;

-- (2) Public HTTPS endpoint (users still sign in with Snowflake first).
GRANT BIND SERVICE ENDPOINT ON ACCOUNT TO ROLE FR_BETA_TESTER;

-- (3) Outbound access for the service, limited to the hosts in SKBP_EGRESS_RULE.
CREATE EXTERNAL ACCESS INTEGRATION IF NOT EXISTS SKBP_EAI
  ALLOWED_NETWORK_RULES = (BETA_TEST_DB.DEV.SKBP_EGRESS_RULE)
  ENABLED = TRUE
  COMMENT = 'SKBP dashboard: OpenRouter LLM API and SMTP relay only';
GRANT USAGE ON INTEGRATION SKBP_EAI TO ROLE FR_BETA_TESTER;

-- Verify
SHOW GRANTS TO ROLE FR_BETA_TESTER;
