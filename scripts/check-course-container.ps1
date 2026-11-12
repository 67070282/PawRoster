param(
    [string]$Container = 'devtools',
    [string]$OutputPath = '',
    [switch]$RequireApp
)
$ErrorActionPreference = 'Stop'
function Invoke-DockerRead([string[]]$DockerArguments) {
    $result = & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker inspection failed: $($DockerArguments[0])" }
    return ($result -join "`n")
}
$outer = @(ConvertFrom-Json (Invoke-DockerRead @('inspect', $Container)))[0]
if ($outer.Config.Image -ne 'tuchsanai/devtools:2569_1') { throw 'The outer container must use tuchsanai/devtools:2569_1' }
if (-not $outer.State.Running) { throw 'The instructor container is not running' }
if (-not $outer.HostConfig.Privileged) { throw 'The instructor container requires privileged mode for its inner daemon' }
foreach ($mount in $outer.Mounts) {
    if ($mount.Type -eq 'bind' -and ($mount.Source -match 'docker\.sock$' -or $mount.Destination -in @('/var/run/docker.sock','/run/docker.sock','/var/run','/run','/'))) {
        throw 'A host socket or its parent directory is mounted; this does not prove an independent inner daemon'
    }
}
$hostId = (Invoke-DockerRead @('info','--format','{{.ID}}')).Trim()
$innerId = (Invoke-DockerRead @('exec',$Container,'docker','info','--format','{{.ID}}')).Trim()
if (-not $hostId -or -not $innerId -or $hostId -eq $innerId) { throw 'Host and inner Docker daemon IDs must differ' }
$null = Invoke-DockerRead @('exec',$Container,'pgrep','-x','dockerd')
$endpoint = (Invoke-DockerRead @('exec',$Container,'docker','context','inspect','--format','{{.Endpoints.docker.Host}}')).Trim()
if ($endpoint -notin @('unix:///var/run/docker.sock','unix:///run/docker.sock')) { throw 'Inner Docker context must use a local Unix socket' }
$dockerHost = (Invoke-DockerRead @('exec',$Container,'sh','-c','printf "%s" "${DOCKER_HOST-}"')).Trim()
if ($dockerHost -and $dockerHost -notin @('unix:///var/run/docker.sock','unix:///run/docker.sock')) { throw 'Inner DOCKER_HOST overrides the local daemon' }
$app = $null
if ($RequireApp) {
    $app = @(ConvertFrom-Json (Invoke-DockerRead @('exec',$Container,'docker','inspect','pawroster-course-app-1')))[0]
    if (-not $app.State.Running -or $app.State.Health.Status -ne 'healthy') { throw 'PawRoster app is not healthy on the inner daemon' }
    if ($app.Config.Labels.'org.opencontainers.image.source' -ne 'https://github.com/67070282/PawRoster') { throw 'Unexpected application image source' }
}
$report = [ordered]@{
    outer_image = $outer.Config.Image
    privileged = [bool]$outer.HostConfig.Privileged
    host_socket_mounted = $false
    separate_daemons = $true
    inner_dockerd_running = $true
    inner_socket = 'local Unix socket'
    app_checked = [bool]$RequireApp
}
if ($app) {
    $report.app_container = $app.Name.TrimStart('/')
    $report.app_image = $app.Config.Image
    $report.app_health = $app.State.Health.Status
    $report.app_revision = $app.Config.Labels.'org.opencontainers.image.revision'
}
$json = $report | ConvertTo-Json
if ($OutputPath) { [IO.File]::WriteAllText($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath), $json + "`n", [Text.UTF8Encoding]::new($false)) }
$json
