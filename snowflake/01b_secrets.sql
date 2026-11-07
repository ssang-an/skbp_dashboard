-- 01b_secrets.sql : YOU run this yourself in a Snowsight SQL worksheet.
-- Secret values are typed only here, inside Snowflake. Never paste them into chat or commit them.
-- Open your local .env on the company PC and copy each value into the matching <...> below.
USE ROLE FR_BETA_TESTER;
USE SCHEMA BETA_TEST_DB.DEV;

-- 1) OpenRouter API key  (.env : OPENROUTER_API_KEY)
CREATE SECRET IF NOT EXISTS SKBP_OPENROUTER_API_KEY
  TYPE = GENERIC_STRING
  SECRET_STRING = '<paste OPENROUTER_API_KEY value here>';

-- 2) SMTP login  (.env : SMTP_USERNAME / SMTP_PASSWORD)
--    If you do not use password-reset email, leave both as 'unused'.
CREATE SECRET IF NOT EXISTS SKBP_SMTP_LOGIN
  TYPE = PASSWORD
  USERNAME = '<paste SMTP_USERNAME value here>'
  PASSWORD = '<paste SMTP_PASSWORD value here>';

-- 3) Allow outbound SMTP  (.env : SMTP_HOST and SMTP_PORT, e.g. 'smtp.example.com:587')
--    Skip this statement if you do not use password-reset email.
ALTER NETWORK RULE SKBP_EGRESS_RULE SET VALUE_LIST = ('openrouter.ai:443', '<SMTP_HOST>:<SMTP_PORT>');

-- Check (values are never displayed):
SHOW SECRETS IN SCHEMA BETA_TEST_DB.DEV;
DESC NETWORK RULE SKBP_EGRESS_RULE;

-- To change a value later:
-- ALTER SECRET SKBP_OPENROUTER_API_KEY SET SECRET_STRING = '<new value>';
-- ALTER SECRET SKBP_SMTP_LOGIN SET PASSWORD = '<new value>';
-- Then restart the service so the container re-reads env vars:
-- ALTER SERVICE BETA_TEST_DB.DEV.SKBP_DASHBOARD SUSPEND;  ALTER SERVICE BETA_TEST_DB.DEV.SKBP_DASHBOARD RESUME;
