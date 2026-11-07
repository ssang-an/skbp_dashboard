-- 01_setup.sql : objects the FR_BETA_TESTER role can create itself (run by CoCo).
USE ROLE FR_BETA_TESTER;

-- Docker image repository (images are pushed here from the company PC)
CREATE IMAGE REPOSITORY IF NOT EXISTS BETA_TEST_DB.DEV.SKBP_REPO
  COMMENT = 'SKBP pipeline dashboard images';

-- Outbound hosts the app calls. SMTP host is added later with ALTER (see 01b_secrets.sql step 3).
CREATE NETWORK RULE IF NOT EXISTS BETA_TEST_DB.DEV.SKBP_EGRESS_RULE
  MODE = EGRESS
  TYPE = HOST_PORT
  VALUE_LIST = ('openrouter.ai:443')
  COMMENT = 'SKBP dashboard egress: OpenRouter LLM API (+ SMTP relay)';

SHOW IMAGE REPOSITORIES LIKE 'SKBP_REPO' IN SCHEMA BETA_TEST_DB.DEV;
