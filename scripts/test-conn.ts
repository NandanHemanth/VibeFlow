import { connectors, slackPost, jiraCreate } from "../src/harness/connectors";
(async () => {
  console.log("enabled", connectors.slackEnabled(), connectors.jiraEnabled());
  try { console.log("slack", await slackPost("VibeFlow connector check: harness can post here.")); } catch (e: any) { console.log("slack ERR", e.message); }
  try { console.log("jira", await jiraCreate("[VibeFlow] connector check", "Harness connectivity test. Safe to close.", ["vibeflow"])); } catch (e: any) { console.log("jira ERR", e.message); }
})();
