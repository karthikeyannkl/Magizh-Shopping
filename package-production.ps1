# Package Magizh Shopping Production Deployment ZIP
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = "C:\Users\SARAVANA STUDIO\.gemini\antigravity\scratch\magizh-b5-ecosystem"
$zipPath = Join-Path $projectRoot "magizh-b5-commerce-ecosystem.zip"
$artifactZipPath = "C:\Users\SARAVANA STUDIO\.gemini\antigravity\brain\f61d9fdf-6154-4644-a9e7-2e448bb15a69\magizh-b5-commerce-ecosystem.zip"
$tempDir = Join-Path $projectRoot "temp_deploy_staging"

if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Folders to include
$folders = @("src", "server", "dist", "public")
foreach ($folder in $folders) {
    $srcFolder = Join-Path $projectRoot $folder
    if (Test-Path $srcFolder) {
        $destFolder = Join-Path $tempDir $folder
        Copy-Item -Path $srcFolder -Destination $destFolder -Recurse -Force
    }
}

# Files to include
$files = @(
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.node.json",
    "vite.config.ts",
    "tailwind.config.js",
    "postcss.config.js",
    "index.html",
    "RENDER_DEPLOYMENT.md",
    "README.md",
    ".env.example",
    "test-critical-corrections.mjs",
    "test-master-corrections.mjs",
    "test-b5-cloud-backup.mjs"
)

foreach ($file in $files) {
    $srcFile = Join-Path $projectRoot $file
    if (Test-Path $srcFile) {
        Copy-Item -Path $srcFile -Destination $tempDir -Force
    }
}

# Remove existing zip files
if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
}
if (Test-Path $artifactZipPath) {
    Remove-Item -Path $artifactZipPath -Force
}

# Compress into zip
[System.IO.Compression.ZipFile]::CreateFromDirectory(
    $tempDir,
    $zipPath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
)

# Copy to artifacts directory
Copy-Item -Path $zipPath -Destination $artifactZipPath -Force

# Clean up temp directory
Remove-Item -Path $tempDir -Recurse -Force

# Verify ZIP integrity
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
$entryCount = $zip.Entries.Count
$zipSize = (Get-Item $zipPath).Length
$zip.Dispose()

Write-Output "DEPLOYMENT_ZIP_STATUS: SUCCESS"
Write-Output "ZIP_PATH: $zipPath"
Write-Output "ARTIFACT_PATH: $artifactZipPath"
Write-Output "ZIP_SIZE_BYTES: $zipSize"
Write-Output "ZIP_ENTRY_COUNT: $entryCount"
