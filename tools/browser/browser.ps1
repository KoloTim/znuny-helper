# Startet die Browser-Werkzeuge des Znuny Helpers und sucht sich Node selbst.
#
# Hintergrund: Node ist auf diesem Rechner nicht im PATH installiert - es gibt
# nur die Laufzeit, die das DeepSeek Harness mitbringt. Dieses Skript findet
# eine passende Node-Installation und ruft damit die Skripte in diesem Ordner auf.
#
# Aufruf (aus dem Repo-Wurzelverzeichnis):
#   .\browser.cmd              Uebersicht
#   .\browser.cmd smoke        Rauchtest, ohne Fenster
#   .\browser.cmd show         Rauchtest im Fenster, mit Pausen
#   .\browser.cmd record       Rauchtest im Fenster, mit Aufzeichnung
#   .\browser.cmd login        einmalig im Znuny anmelden
#   .\browser.cmd capture      echte Seiten aufnehmen
#
# Zusatzschalter werden durchgereicht, z. B.:
#   .\browser.cmd show --nur=agent-suche
#   .\browser.cmd capture --nur=agent-ticket-zoom --uebernehmen

$ErrorActionPreference = 'Stop'

function Find-Node {
    if ($env:ZH_NODE -and (Test-Path -LiteralPath $env:ZH_NODE)) { return $env:ZH_NODE }

    $befehl = Get-Command node -ErrorAction SilentlyContinue
    if ($befehl -and $befehl.Source) { return $befehl.Source }

    $kandidaten = @(
        (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe')
    )
    foreach ($kandidat in $kandidaten) {
        if ($kandidat -and (Test-Path -LiteralPath $kandidat)) { return $kandidat }
    }

    # Laufzeit des DeepSeek Harness (dort liegt Node ohne Installation im PATH)
    $laufzeiten = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes'
    if (Test-Path -LiteralPath $laufzeiten) {
        $treffer = Get-ChildItem -LiteralPath $laufzeiten -Directory -ErrorAction SilentlyContinue |
            ForEach-Object { Join-Path $_.FullName 'dependencies\node\bin\node.exe' } |
            Where-Object { Test-Path -LiteralPath $_ } |
            Sort-Object -Descending
        if ($treffer) { return @($treffer)[0] }
    }

    return $null
}

function Zeige-Hilfe {
    Write-Host ''
    Write-Host '  Znuny Helper - Browser-Werkzeuge'
    Write-Host '  --------------------------------'
    Write-Host ''
    Write-Host '  .\browser.cmd smoke      Rauchtest gegen Fixtures, ohne Fenster'
    Write-Host '  .\browser.cmd clicks     Klick-Tests: echte Bedienung, nur lesend'
    Write-Host '  .\browser.cmd show       Rauchtest im Fenster, langsam, mit Erzaehlung'
    Write-Host '  .\browser.cmd record     sichtbarer Lauf mit Aufzeichnung'
    Write-Host '  .\browser.cmd login      einmalig im Znuny anmelden (Sitzung bleibt gespeichert)'
    Write-Host '  .\browser.cmd capture    echte Seiten aufnehmen'
    Write-Host ''
    Write-Host '  Zusatzschalter werden durchgereicht, z. B. --nur=agent-suche'
    Write-Host ''
}

$aktion = if ($args.Count -gt 0) { ([string]$args[0]).ToLowerInvariant() } else { 'help' }
$rest = @()
if ($args.Count -gt 1) { $rest = $args[1..($args.Count - 1)] }

if ($aktion -in @('help', '-h', '--help', '/?')) { Zeige-Hilfe; exit 0 }

$node = Find-Node
if (-not $node) {
    Write-Host ''
    Write-Host '  Kein Node gefunden.' -ForegroundColor Yellow
    Write-Host '  Entweder Node installieren (nodejs.org) oder den Pfad setzen:'
    Write-Host '    $env:ZH_NODE = ''C:\Pfad\zu\node.exe'''
    Write-Host ''
    exit 1
}

$wurzel = Split-Path -Parent $PSScriptRoot
$werkzeuge = $PSScriptRoot

$befehl = switch ($aktion) {
    'smoke' { @((Join-Path $werkzeuge 'smoke.js')) }
    'clicks' { @((Join-Path $werkzeuge 'clicks.js')) }
    'show' { @((Join-Path $werkzeuge 'smoke.js'), '--sichtbar') }
    'record' {
        @(
            (Join-Path $werkzeuge 'smoke.js'),
            '--sichtbar',
            ('--aufzeichnen=' + (Join-Path $wurzel 'tools\browser\output/lauf'))
        )
    }
    'login' { @((Join-Path $werkzeuge 'capture.js'), '--login') }
    'capture' { @((Join-Path $werkzeuge 'capture.js')) }
    default {
        Write-Host ('  Unbekannte Aktion: ' + $aktion) -ForegroundColor Yellow
        Zeige-Hilfe
        exit 2
    }
}

$alle = @($befehl) + $rest
Write-Host ('  Node: ' + $node) -ForegroundColor DarkGray
Push-Location $wurzel
try {
    & $node @alle
    $code = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $code
