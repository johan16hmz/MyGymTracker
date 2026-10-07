param([Parameter(Mandatory=$true)][string]$SourceDirectory)
$ErrorActionPreference = 'Stop'
# Mechanical extraction of the ANSES public XML export. Never fabricate a
# missing value. Values below a quantification threshold use that upper bound.
[xml]$foodsXml = Get-Content -Raw -LiteralPath (Join-Path $SourceDirectory 'foods.xml')
[xml]$compositionXml = Get-Content -Raw -LiteralPath (Join-Path $SourceDirectory 'composition.xml')
$selectedCodes = @('328','25000','31000','40000','34100')
$valuesByFood = @{}
foreach ($entry in $compositionXml.TABLE.COMPO) {
  $code = $entry.const_code.Trim()
  if ($code -notin $selectedCodes) { continue }
  $foodCode = $entry.alim_code.Trim()
  if (-not $valuesByFood.ContainsKey($foodCode)) { $valuesByFood[$foodCode] = @{} }
  $raw = $entry.teneur.InnerText
  if ($entry.teneur -is [string]) { $raw = $entry.teneur }
  $raw = $raw.Trim().Replace(',', '.').TrimStart('<').Trim()
  $numberValue = 0.0
  $valid = [double]::TryParse($raw, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$numberValue)
  $valuesByFood[$foodCode][$code] = if ($valid -and $numberValue -ge 0) { $numberValue } else { $null }
}
$rows = @($foodsXml.TABLE.ALIM | ForEach-Object {
  $id = $_.alim_code.Trim()
  $values = $valuesByFood[$id]
  ,@($id,$_.alim_nom_fr.Trim(),$_.alim_nom_eng.Trim(),$values['328'],$values['25000'],$values['31000'],$values['40000'],$values['34100'])
})
$output = Join-Path $PSScriptRoot '../public/data/ciqual-2025.json'
New-Item -ItemType Directory -Force -Path (Split-Path $output) | Out-Null
$data = @{source='ANSES-CIQUAL 2025'; doi='https://doi.org/10.57745/RDMHWY'; license='Licence Ouverte 2.0'; columns=@('id','name','nameEn','kcal100','protein100','carbs100','fat100','fiber100'); foods=$rows}
[System.IO.File]::WriteAllText($output,($data | ConvertTo-Json -Depth 5 -Compress),[System.Text.UTF8Encoding]::new($false))
Write-Output "Exported $($rows.Count) foods to $output"
