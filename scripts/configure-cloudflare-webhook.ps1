param(
  [string]$ZoneName = "oaslananka.dev",
  [string]$RecordName = "webhook.oaslananka.dev",
  [string]$Target = "ops-webhook-wi0r.onrender.com",
  [object]$Proxied = $true
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ApiBase = "https://api.cloudflare.com/client/v4"

function Get-EnvValue {
  param([string[]]$Names)

  foreach ($Name in $Names) {
    $Value = [Environment]::GetEnvironmentVariable($Name)
    if (-not [string]::IsNullOrWhiteSpace($Value)) {
      return $Value
    }
  }

  return $null
}

function New-CloudflareHeaders {
  $Token = Get-EnvValue @("CLOUDFLARE_API_TOKEN", "CF_API_TOKEN")
  if ($Token) {
    return @{
      "Authorization" = "Bearer $Token"
      "Content-Type"  = "application/json"
    }
  }

  $GlobalKey = Get-EnvValue @(
    "CLOUDFLARE_GLOBAL_API_KEY",
    "CLOUDFLARE_API_KEY",
    "CF_API_KEY"
  )
  $Email = Get-EnvValue @(
    "CLOUDFLARE_EMAIL",
    "CLOUDFLARE_API_EMAIL",
    "CLOUDFLARE_GLOBAL_EMAIL",
    "CLOUDFLARE_GLABAL_MAIL",
    "CF_API_EMAIL"
  )

  if ($GlobalKey -and $Email) {
    return @{
      "X-Auth-Email" = $Email
      "X-Auth-Key"   = $GlobalKey
      "Content-Type"  = "application/json"
    }
  }

  throw "Cloudflare credentials missing. Provide CLOUDFLARE_API_TOKEN/CF_API_TOKEN or CLOUDFLARE_GLOBAL_API_KEY plus Cloudflare email."
}

function Invoke-CloudflareApi {
  param(
    [ValidateSet("GET", "POST", "PUT")]
    [string]$Method,
    [string]$Path,
    [hashtable]$Headers,
    [object]$Body = $null
  )

  $Uri = "$ApiBase$Path"
  $InvokeParams = @{
    Method      = $Method
    Uri         = $Uri
    Headers     = $Headers
    ErrorAction = "Stop"
  }

  if ($null -ne $Body) {
    $InvokeParams.Body = ($Body | ConvertTo-Json -Depth 10)
  }

  try {
    $Response = Invoke-RestMethod @InvokeParams
  } catch {
    $StatusCode = $null
    if ($_.Exception.Response) {
      $StatusCode = [int]$_.Exception.Response.StatusCode
    }
    throw "Cloudflare API request failed: method=$Method path=$Path status=$StatusCode"
  }

  if (-not $Response.success) {
    $Messages = @()
    if ($Response.errors) {
      $Messages = @($Response.errors | ForEach-Object {
        if ($_.code -and $_.message) { "$($_.code): $($_.message)" }
        elseif ($_.message) { $_.message }
      })
    }
    if ($Messages.Count -eq 0) {
      $Messages = @("Unknown Cloudflare API error")
    }
    throw ("Cloudflare API returned unsuccessful response for method={0} path={1}: {2}" -f $Method, $Path, ($Messages -join "; "))
  }

  return $Response
}

function UrlEncode {
  param([string]$Value)
  return [System.Uri]::EscapeDataString($Value)
}

function Convert-ToBoolean {
  param([object]$Value)

  if ($Value -is [bool]) {
    return $Value
  }

  if ($Value -is [int]) {
    return ($Value -ne 0)
  }

  $Text = "$Value".Trim()
  switch -Regex ($Text.ToLowerInvariant()) {
    "^(true|1|yes|y)$" { return $true }
    "^(false|0|no|n)$" { return $false }
    default { throw "Invalid boolean value for Proxied. Use true, false, 1, or 0." }
  }
}

if ([string]::IsNullOrWhiteSpace($ZoneName)) {
  $ZoneName = Get-EnvValue @("CLOUDFLARE_ZONE_NAME", "CF_ZONE_NAME")
}

if ([string]::IsNullOrWhiteSpace($ZoneName)) {
  throw "ZoneName is required. Pass -ZoneName or set CLOUDFLARE_ZONE_NAME."
}

$Headers = New-CloudflareHeaders
$ZoneId = Get-EnvValue @("CLOUDFLARE_ZONE_ID", "CF_ZONE_ID")
$ResolvedZoneName = $ZoneName
$ProxiedValue = Convert-ToBoolean $Proxied

if ([string]::IsNullOrWhiteSpace($ZoneId)) {
  $Zones = Invoke-CloudflareApi -Method "GET" -Path ("/zones?name={0}" -f (UrlEncode $ZoneName)) -Headers $Headers
  if (-not $Zones.result -or @($Zones.result).Count -eq 0) {
    throw "Cloudflare zone not found: $ZoneName"
  }
  $ZoneId = $Zones.result[0].id
  $ResolvedZoneName = $Zones.result[0].name
}

$Existing = Invoke-CloudflareApi `
  -Method "GET" `
  -Path ("/zones/{0}/dns_records?type=CNAME&name={1}" -f $ZoneId, (UrlEncode $RecordName)) `
  -Headers $Headers

$Payload = @{
  type    = "CNAME"
  name    = $RecordName
  content = $Target
  proxied = $ProxiedValue
  ttl     = 1
  comment = "Managed by oaslananka-lab/_ops"
}

$Action = "created"
$Records = @($Existing.result)

if ($Records.Count -gt 0) {
  $Record = $Records[0]
  $AlreadyMatches = (
    $Record.type -eq "CNAME" -and
    $Record.name -eq $RecordName -and
    $Record.content -eq $Target -and
    [bool]$Record.proxied -eq $ProxiedValue
  )

  if ($AlreadyMatches) {
    $Action = "unchanged"
  } else {
    Invoke-CloudflareApi `
      -Method "PUT" `
      -Path ("/zones/{0}/dns_records/{1}" -f $ZoneId, $Record.id) `
      -Headers $Headers `
      -Body $Payload | Out-Null
    $Action = "updated"
  }
} else {
  Invoke-CloudflareApi `
    -Method "POST" `
    -Path ("/zones/{0}/dns_records" -f $ZoneId) `
    -Headers $Headers `
    -Body $Payload | Out-Null
}

[PSCustomObject]@{
  zone        = $ResolvedZoneName
  record_name = $RecordName
  record_type = "CNAME"
  target      = $Target
  proxied     = $ProxiedValue
  action      = $Action
} | ConvertTo-Json
