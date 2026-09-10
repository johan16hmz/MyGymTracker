$ErrorActionPreference = 'Stop'
try {
    Write-Host 'Connexion de MyGymTracker a Codex'
    $gymEmail = Read-Host 'Adresse e-mail MyGymTracker'
    $gymPassword = Read-Host 'Mot de passe MyGymTracker' -AsSecureString
    $gymCredential = New-Object System.Management.Automation.PSCredential($gymEmail, $gymPassword)
    $gymBody = @{ email = $gymEmail; password = $gymCredential.GetNetworkCredential().Password } | ConvertTo-Json
    $gymSession = Invoke-RestMethod -Uri 'https://mygymtracker-five.vercel.app/api/mcp-login' -Method Post -ContentType 'application/json' -Body $gymBody
    $gymBody = $null
    $gymCredential = $null
    if (-not $gymSession.access_token) { throw 'Aucun jeton recu.' }
    [Environment]::SetEnvironmentVariable('MYGYMTRACKER_ACCESS_TOKEN', $gymSession.access_token, 'User')
    Write-Host 'Connexion enregistree. Ferme completement Codex, puis rouvre-le.'
    Write-Host 'Cette connexion est temporaire. Relance ce fichier si elle expire.'
} catch {
    Write-Host 'Connexion impossible. Verifie tes identifiants et ta connexion Internet.'
} finally {
    $gymBody = $null
    $gymSession = $null
    $gymCredential = $null
    Read-Host 'Appuie sur Entree pour fermer'
}
