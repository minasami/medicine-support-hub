# scripts/sync_google_drive.ps1
# Google Drive Sync Script for Antigravity Brain Artifacts

param(
    [string]$SourcePath = "C:\Users\Mina.s.Tawfik\.gemini\antigravity\brain",
    [string]$CredentialsFilePath = "$HOME\.gemini\antigravity\gdrive_credentials.json",
    [string]$TokenFilePath = "$HOME\.gemini\antigravity\gdrive_tokens.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $CredentialsFilePath)) {
    throw "Credentials file not found at $CredentialsFilePath"
}

$creds = Get-Content $CredentialsFilePath -Raw | ConvertFrom-Json
$ClientId = $creds.client_id
$ClientSecret = $creds.client_secret

$Port = 9090
$RedirectUri = "http://127.0.0.1:$Port/"
$Scope = "https://www.googleapis.com/auth/drive.file"

function Get-OAuthTokens {
    if (Test-Path $TokenFilePath) {
        try {
            $tokenData = Get-Content $TokenFilePath -Raw | ConvertFrom-Json
            if ($tokenData.refresh_token) {
                Write-Host "Refreshing access token..." -ForegroundColor Cyan
                $body = @{
                    client_id     = $ClientId
                    client_secret = $ClientSecret
                    refresh_token = $tokenData.refresh_token
                    grant_type    = "refresh_token"
                }
                $response = Invoke-RestMethod -Uri "https://oauth2.googleapis.com/token" -Method Post -Body $body
                $tokenData.access_token = $response.access_token
                $tokenData | ConvertTo-Json | Set-Content $TokenFilePath
                return $response.access_token
            }
        } catch {
            Write-Host "Saved token expired or invalid, re-authenticating..." -ForegroundColor Yellow
        }
    }

    Write-Host "`n=== Google Drive Authentication Required ===" -ForegroundColor Green
    Write-Host "Starting TCP listener on $RedirectUri ..." -ForegroundColor Cyan
    
    $tcpListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $tcpListener.Start()

    $authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" +
        "client_id=$ClientId" +
        "&response_type=code" +
        "&scope=$([Uri]::EscapeDataString($Scope))" +
        "&redirect_uri=$([Uri]::EscapeDataString($RedirectUri))" +
        "&access_type=offline" +
        "&prompt=consent"

    Write-Host "Waiting for authorization..." -ForegroundColor Yellow
    
    $client = $tcpListener.AcceptTcpClient()
    $stream = $client.GetStream()
    $reader = [System.IO.StreamReader]::new($stream)
    $requestLine = $reader.ReadLine()
    
    $code = $null
    if ($requestLine -match "code=([^&\s]+)") {
        $code = [System.Uri]::UnescapeDataString($Matches[1])
    }

    $responseHtml = "<html><body><h2>Authentication successful! You can close this browser window.</h2></body></html>"
    $responseBytes = [System.Text.Encoding]::UTF8.GetBytes("HTTP/1.1 200 OK`r`nContent-Type: text/html`r`nContent-Length: $($responseHtml.Length)`r`nConnection: close`r`n`r`n$responseHtml")
    $stream.Write($responseBytes, 0, $responseBytes.Length)
    $stream.Flush()
    $client.Close()
    $tcpListener.Stop()

    if (-not $code) {
        throw "Failed to capture authorization code from browser request."
    }

    Write-Host "Exchanging authorization code for tokens..." -ForegroundColor Cyan
    $tokenBody = @{
        code          = $code
        client_id     = $ClientId
        client_secret = $ClientSecret
        redirect_uri  = $RedirectUri
        grant_type    = "authorization_code"
    }

    $tokenResponse = Invoke-RestMethod -Uri "https://oauth2.googleapis.com/token" -Method Post -Body $tokenBody
    
    $tokenData = @{
        access_token  = $tokenResponse.access_token
        refresh_token = $tokenResponse.refresh_token
    }
    
    $tokenDir = [System.IO.Path]::GetDirectoryName($TokenFilePath)
    if (-not (Test-Path $tokenDir)) { New-Item -ItemType Directory -Path $tokenDir -Force }
    $tokenData | ConvertTo-Json | Set-Content $TokenFilePath
    
    Write-Host "Authentication successful! Tokens saved." -ForegroundColor Green
    return $tokenResponse.access_token
}

function Get-OrCreate-DriveFolder {
    param([string]$FolderName, [string]$AccessToken, [string]$ParentId = $null)
    
    $headers = @{ Authorization = "Bearer $AccessToken" }
    
    $query = "name = '$FolderName' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    if ($ParentId) {
        $query += " and '$ParentId' in parents"
    }
    
    $searchUri = "https://www.googleapis.com/drive/v3/files?q=$([Uri]::EscapeDataString($query))"
    $searchRes = Invoke-RestMethod -Uri $searchUri -Headers $headers -Method Get
    
    if ($searchRes.files.Count -gt 0) {
        return $searchRes.files[0].id
    }
    
    # Create folder
    $metadata = @{
        name     = $FolderName
        mimeType = "application/vnd.google-apps.folder"
    }
    if ($ParentId) {
        $metadata["parents"] = @($ParentId)
    }
    
    $createUri = "https://www.googleapis.com/drive/v3/files"
    $jsonBody = $metadata | ConvertTo-Json
    $createRes = Invoke-RestMethod -Uri $createUri -Headers $headers -Method Post -Body $jsonBody -ContentType "application/json"
    
    return $createRes.id
}

function Upload-FileToDrive {
    param([string]$LocalPath, [string]$ParentFolderId, [string]$AccessToken)
    
    $fileName = [System.IO.Path]::GetFileName($LocalPath)
    $headers = @{ Authorization = "Bearer $AccessToken" }
    
    # Check if file already exists in folder
    $query = "name = '$fileName' and '$ParentFolderId' in parents and trashed = false"
    $searchUri = "https://www.googleapis.com/drive/v3/files?q=$([Uri]::EscapeDataString($query))"
    $searchRes = Invoke-RestMethod -Uri $searchUri -Headers $headers -Method Get
    
    $fileBytes = [System.IO.File]::ReadAllBytes($LocalPath)
    $boundary = [System.Guid]::NewGuid().ToString()
    
    $metadata = @{ name = $fileName }
    if (-not ($searchRes.files.Count -gt 0)) {
        $metadata["parents"] = @($ParentFolderId)
    }
    
    $metaJson = $metadata | ConvertTo-Json
    
    $bodyBytes = [System.IO.MemoryStream]::new()
    $writer = [System.IO.StreamWriter]::new($bodyBytes)
    
    $writer.Write("--$boundary`r`n")
    $writer.Write("Content-Type: application/json; charset=UTF-8`r`n`r`n")
    $writer.Write("$metaJson`r`n")
    $writer.Write("--$boundary`r`n")
    $writer.Write("Content-Type: application/octet-stream`r`n`r`n")
    $writer.Flush()
    
    $bodyBytes.Write($fileBytes, 0, $fileBytes.Length)
    
    $writer.Write("`r`n--$boundary--`r`n")
    $writer.Flush()
    
    $uploadData = $bodyBytes.ToArray()
    
    if ($searchRes.files.Count -gt 0) {
        # Update existing file
        $existingFileId = $searchRes.files[0].id
        $uploadUri = "https://www.googleapis.com/upload/drive/v3/files/$existingFileId?uploadType=multipart"
        $response = Invoke-RestMethod -Uri $uploadUri -Method Patch -Headers @{
            Authorization = "Bearer $AccessToken"
            "Content-Type" = "multipart/related; boundary=$boundary"
        } -Body $uploadData
        Write-Host "Updated: $fileName" -ForegroundColor Gray
    } else {
        # Upload new file
        $uploadUri = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"
        $response = Invoke-RestMethod -Uri $uploadUri -Method Post -Headers @{
            Authorization = "Bearer $AccessToken"
            "Content-Type" = "multipart/related; boundary=$boundary"
        } -Body $uploadData
        Write-Host "Uploaded: $fileName" -ForegroundColor Green
    }
}

# Main Execution
Write-Host "`nInitializing Google Drive Sync..." -ForegroundColor Cyan
$accessToken = Get-OAuthTokens

Write-Host "`nEnsuring root folder 'Antigravity_Brain_Artifacts' exists on Google Drive..." -ForegroundColor Cyan
$rootFolderId = Get-OrCreate-DriveFolder -FolderName "Antigravity_Brain_Artifacts" -AccessToken $accessToken

$files = Get-ChildItem -Path $SourcePath -Recurse -File | Where-Object { $_.FullName -notmatch '\\\.system_generated\\' }

Write-Host "Found $($files.Count) artifact files to sync." -ForegroundColor Cyan

foreach ($file in $files) {
    # Calculate relative folder path to maintain hierarchy
    $relativePath = $file.DirectoryName.Substring($SourcePath.Length).TrimStart('\', '/')
    $currentParentId = $rootFolderId
    
    if ($relativePath) {
        $subFolders = $relativePath.Split([char[]]@('\', '/'), [System.StringSplitOptions]::RemoveEmptyEntries)
        foreach ($folder in $subFolders) {
            $currentParentId = Get-OrCreate-DriveFolder -FolderName $folder -AccessToken $accessToken -ParentId $currentParentId
        }
    }
    
    Upload-FileToDrive -LocalPath $file.FullName -ParentFolderId $currentParentId -AccessToken $accessToken
}

Write-Host "`nSync complete! All artifacts are up to date on Google Drive." -ForegroundColor Green
