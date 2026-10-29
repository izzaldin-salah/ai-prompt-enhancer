# Regenerate the opaque home-screen PNGs using built-in Windows drawing APIs.
Add-Type -AssemblyName System.Drawing
$iconDirectory = Join-Path $PSScriptRoot '../public/icons'
[System.IO.Directory]::CreateDirectory($iconDirectory) | Out-Null
$sparkPolygons = @(
  @(12,2, 13.3,6.2, 17.5,7.5, 13.3,8.8, 12,13, 10.7,8.8, 6.5,7.5, 10.7,6.2),
  @(6,11, 6.8,13.2, 9,14, 6.8,14.8, 6,17, 5.2,14.8, 3,14, 5.2,13.2),
  @(16,14, 16.7,15.8, 18.5,16.5, 16.7,17.2, 16,19, 15.3,17.2, 13.5,16.5, 15.3,15.8)
)
$specifications = @(
  @{ Name = 'icon-192.png'; Size = 192; Scale = 0.88 },
  @{ Name = 'icon-512.png'; Size = 512; Scale = 0.88 },
  @{ Name = 'icon-maskable-512.png'; Size = 512; Scale = 0.66 },
  @{ Name = 'apple-touch-icon.png'; Size = 180; Scale = 0.88 }
)
foreach ($specification in $specifications) {
  $canvas = New-Object System.Drawing.Bitmap(1024, 1024)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#235b49'))
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#c9f36a'))
  $factor = 1024 * $specification.Scale / 24
  foreach ($polygon in $sparkPolygons) {
    $points = @()
    for ($i = 0; $i -lt $polygon.Count; $i += 2) {
      $points += New-Object System.Drawing.PointF(
        (512 + ($polygon[$i] - 10.75) * $factor),
        (512 + ($polygon[$i + 1] - 10.5) * $factor)
      )
    }
    $graphics.FillPolygon($brush, [System.Drawing.PointF[]]$points)
  }
  $output = New-Object System.Drawing.Bitmap($specification.Size, $specification.Size)
  $resizer = [System.Drawing.Graphics]::FromImage($output)
  $resizer.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $resizer.DrawImage($canvas, 0, 0, $specification.Size, $specification.Size)
  $output.Save((Join-Path $iconDirectory $specification.Name), [System.Drawing.Imaging.ImageFormat]::Png)
  $resizer.Dispose()
  $output.Dispose()
  $brush.Dispose()
  $graphics.Dispose()
  $canvas.Dispose()
}
