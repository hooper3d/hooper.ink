param(
    [switch]$Install,
    [string]$NodePath = (Get-Command node.exe -ErrorAction Stop).Source
)

$ErrorActionPreference = 'Stop'
$taskName = 'Hooper-Navi-Preview'
$projectRoot = Split-Path -Parent $PSScriptRoot
$serverPath = Join-Path $PSScriptRoot 'run-local-preview.cjs'
$runtimeDir = Join-Path $projectRoot 'preview-original\.local\runtime'
$shellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (!(Test-Path -LiteralPath $NodePath) -or !(Test-Path -LiteralPath $serverPath)) { throw 'Node or preview server not found' }

if ($Install) {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { throw 'Task already exists; inspect it before replacing' }
    if (Get-NetTCPConnection -State Listen -LocalPort 18869 -ErrorAction SilentlyContinue) { throw 'Port 18869 is already in use' }
    $userName = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -File "{0}" -NodePath "{1}"' -f $PSCommandPath, $NodePath
    $action = New-ScheduledTaskAction -Execute $shellPath -Argument $arguments -WorkingDirectory $projectRoot
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $userName
    $principal = New-ScheduledTaskPrincipal -UserId $userName -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Local Hooper preview on 127.0.0.1:18869; restart on exit and retain logs.' | Out-Null
    Start-ScheduledTask -TaskName $taskName
    Write-Output "Started $taskName. Logs: $runtimeDir"
    return
}

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$supervisorLog = Join-Path $runtimeDir 'supervisor.log'
$stdoutLog = Join-Path $runtimeDir 'stdout.log'
$stderrLog = Join-Path $runtimeDir 'stderr.log'
$stateFile = Join-Path $runtimeDir 'state.json'
$mutex = New-Object System.Threading.Mutex($false, 'Local\HooperNaviPreview')
if (!$mutex.WaitOne(0)) { throw 'Preview supervisor is already running' }

function Rotate-Log([string]$Path) {
    for ($index = 2; $index -ge 0; $index--) {
        $source = if ($index -eq 0) { $Path } else { "$Path.$index" }
        if (Test-Path -LiteralPath $source) { Move-Item -LiteralPath $source -Destination "$Path.$($index + 1)" -Force }
    }
}
function Write-SupervisorLog([string]$Message) {
    if ((Test-Path -LiteralPath $supervisorLog) -and (Get-Item -LiteralPath $supervisorLog).Length -gt 1MB) { Rotate-Log $supervisorLog }
    Add-Content -LiteralPath $supervisorLog -Value "$(Get-Date -Format o) $Message" -Encoding UTF8
}

$child = $null
try {
    Write-SupervisorLog "Supervisor started pid=$PID"
    while ($true) {
        try {
            Rotate-Log $stdoutLog
            Rotate-Log $stderrLog
            $child = Start-Process -FilePath $NodePath -ArgumentList ('"{0}" {1}' -f $serverPath, $PID) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
            $null = $child.Handle
            @{supervisorPid=$PID; serverPid=$child.Id; startedAt=(Get-Date -Format o); url='http://127.0.0.1:18869/'} | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
            Write-SupervisorLog "Preview started pid=$($child.Id)"
            $child.WaitForExit()
            Write-SupervisorLog "Preview exited pid=$($child.Id) code=$($child.ExitCode); restart in 5 seconds"
        } catch {
            Write-SupervisorLog "Supervisor error: $($_.Exception.Message); retry in 5 seconds"
            if ($child -and !$child.HasExited) { Stop-Process -Id $child.Id -ErrorAction SilentlyContinue }
        }
        Start-Sleep -Seconds 5
    }
} finally {
    if ($child -and !$child.HasExited) { Stop-Process -Id $child.Id -ErrorAction SilentlyContinue }
    Write-SupervisorLog 'Supervisor stopped'
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
