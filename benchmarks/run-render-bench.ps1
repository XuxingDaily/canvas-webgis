[CmdletBinding()]
param(
    [int]$Port = 5174
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$temporaryBase = [IO.Path]::GetTempPath()
$temporaryRoot = Join-Path $temporaryBase ("nav-map-render-bench-" + [guid]::NewGuid())
$profilePath = Join-Path $temporaryRoot 'chrome-profile'
$domPath = Join-Path $temporaryRoot 'benchmark-dom.txt'
$errorPath = Join-Path $temporaryRoot 'chrome-error.txt'
$viteLogPath = Join-Path $temporaryRoot 'vite.txt'
$viteErrorPath = Join-Path $temporaryRoot 'vite-error.txt'
$viteProcess = $null

New-Item -ItemType Directory -Path $profilePath -Force | Out-Null

try {
    $node = (Get-Command node -ErrorAction Stop).Source
    $viteScript = Join-Path $repoRoot 'node_modules\vite\bin\vite.js'
    if (-not (Test-Path -LiteralPath $viteScript)) {
        throw 'Vite is not installed. Run npm install first.'
    }

    $viteProcess = Start-Process `
        -FilePath $node `
        -ArgumentList @($viteScript, '--host', '127.0.0.1', '--port', $Port, '--strictPort') `
        -WorkingDirectory $repoRoot `
        -WindowStyle Hidden `
        -PassThru `
        -RedirectStandardOutput $viteLogPath `
        -RedirectStandardError $viteErrorPath

    $url = "http://127.0.0.1:$Port/benchmarks/render-frame.html"
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                $ready = $true
                break
            }
        }
        catch {
            Start-Sleep -Milliseconds 250
        }
    }
    if (-not $ready) {
        throw "Vite benchmark page did not become ready. $((Get-Content -LiteralPath $viteErrorPath -Raw -ErrorAction SilentlyContinue))"
    }

    $browserCandidates = @(
        'C:\Program Files\Google\Chrome\Application\chrome.exe',
        'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
        'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
        'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    )
    $browser = $browserCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $browser) {
        throw 'Chrome or Edge was not found.'
    }

    $arguments = @(
        '--headless',
        '--disable-gpu',
        '--no-first-run',
        "--user-data-dir=$profilePath",
        '--dump-dom',
        '--virtual-time-budget=30000',
        $url
    )
    $browserProcess = Start-Process `
        -FilePath $browser `
        -ArgumentList $arguments `
        -WindowStyle Hidden `
        -Wait `
        -PassThru `
        -RedirectStandardOutput $domPath `
        -RedirectStandardError $errorPath
    if ($browserProcess.ExitCode -ne 0) {
        throw "Browser benchmark failed with exit code $($browserProcess.ExitCode)."
    }

    $dom = Get-Content -LiteralPath $domPath -Raw
    $match = [regex]::Match($dom, '<pre id="result">([\s\S]*?)</pre>')
    if (-not $match.Success) {
        $browserError = Get-Content -LiteralPath $errorPath -Raw -ErrorAction SilentlyContinue
        throw "Benchmark result was not found in browser output. $browserError"
    }

    $json = [Net.WebUtility]::HtmlDecode($match.Groups[1].Value)
    $json | ConvertFrom-Json | ConvertTo-Json -Depth 8
}
finally {
    if ($viteProcess -and -not $viteProcess.HasExited) {
        Stop-Process -Id $viteProcess.Id -Force
        $viteProcess.WaitForExit()
    }
    if (Test-Path -LiteralPath $temporaryRoot) {
        $resolved = (Resolve-Path -LiteralPath $temporaryRoot).Path
        if (-not $resolved.StartsWith($temporaryBase, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove unexpected temporary path: $resolved"
        }
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
