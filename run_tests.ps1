$env:PGPASSFILE = "$env:USERPROFILE\Documents\pgpass.conf"
$tests = @(
  "src/api.foundation.test.js",
  "src/infrastructure/database/utils/uuid.test.js",
  "src/infrastructure/database/migrations/runner.test.js",
  "src/infrastructure/database/connection.test.js",
  "src/foundation.test.js",
  "src/security.test.js",
  "src/modules/announcements/announcement.test.js",
  "src/attendance.api.test.js",
  "src/classes.api.test.js",
  "src/departments.api.test.js",
  "src/integration_hardening.test.js"
)
foreach ($t in $tests) {
  Write-Host "============================================================"
  Write-Host "RUNNING: $t"
  Write-Host "============================================================"
  $out = node $t 2>&1
  $out | Select-Object -Last 15
  $exit = $LASTEXITCODE
  if ($exit -ne 0) { Write-Host "EXIT CODE: $exit" } else { Write-Host "EXIT CODE: 0 (PASS)" }
  Write-Host ""
}