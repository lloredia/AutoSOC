export const HONEYTRAP_EVENT_MAPPING = {
  connection: { type: 'SUSPICIOUS_CONNECTION', severity: 'low', baseScore: 30 },
  authentication_attempt: { type: 'BRUTE_FORCE', severity: 'high', baseScore: 70 },
  authentication_success: { type: 'UNAUTHORIZED_ACCESS', severity: 'critical', baseScore: 95 },
  command_execution: { type: 'MALICIOUS_COMMAND', severity: 'critical', baseScore: 90 },
  file_download: { type: 'MALWARE_DOWNLOAD', severity: 'critical', baseScore: 95 },
  port_scan: { type: 'PORT_SCAN', severity: 'low', baseScore: 25 },
  ssh_brute_force: { type: 'BRUTE_FORCE', severity: 'high', baseScore: 75 },
  http_attack: { type: 'WEB_ATTACK', severity: 'high', baseScore: 70 },
  sql_injection: { type: 'SQL_INJECTION', severity: 'critical', baseScore: 90 },
  xss_attempt: { type: 'XSS_ATTEMPT', severity: 'high', baseScore: 70 },
  default: { type: 'ANOMALOUS_ACTIVITY', severity: 'medium', baseScore: 50 },
};

export const SEVERITIES = ['low', 'medium', 'high', 'critical'];
