Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName Microsoft.VisualBasic

[System.Windows.Forms.Application]::EnableVisualStyles()

$script:Items = New-Object System.Collections.Generic.List[object]
$script:LastAction = "rename"

function S($base64) {
    return [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($base64))
}

function New-Font($size, $style = [System.Drawing.FontStyle]::Regular) {
    return New-Object System.Drawing.Font("Segoe UI", $size, $style)
}

function Get-Prefixes {
    $raw = $prefixBox.Text -split "(`r`n|`n|,|;)"
    return @($raw | ForEach-Object { $_.Trim() } | Where-Object { $_.Length -gt 0 })
}

function Test-StartsWithPrefix($name, $prefixes) {
    foreach ($prefix in $prefixes) {
        if ($name.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $prefix
        }
    }
    return $null
}

function Get-CleanName($name, $prefix) {
    $clean = $name.Substring($prefix.Length)
    $clean = $clean.TrimStart(" ", "`t", "-", "_", ".", "]")
    if ([string]::IsNullOrWhiteSpace($clean)) {
        return $name
    }
    return $clean
}

function Get-UniquePath($directory, $name, $sourcePath) {
    $target = Join-Path $directory $name
    if ($target -ieq $sourcePath) { return $target }
    if (-not (Test-Path -LiteralPath $target)) { return $target }

    $base = [System.IO.Path]::GetFileNameWithoutExtension($name)
    $ext = [System.IO.Path]::GetExtension($name)
    for ($i = 2; $i -lt 10000; $i++) {
        $candidate = Join-Path $directory ("$base ($i)$ext")
        if (-not (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    }
    throw ((S "HQQ1BCAAQwQ0BDAEOwQ+BEEETAQgAD8EPgQ0BD4EMQRABDAEQgRMBCAAQQQyBD4EMQQ+BDQEPQQ+BDUEIAA4BDwETwQgADQEOwRPBCAAewAwAH0A") -f $name)
}

function Get-PathDepth($path) {
    return ($path.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) -split '[\\/]').Count
}

function Add-MatchedItem($path, $isDirectory, $prefixes, $action) {
    $info = if ($isDirectory) { [System.IO.DirectoryInfo]::new($path) } else { [System.IO.FileInfo]::new($path) }
    $prefix = Test-StartsWithPrefix $info.Name $prefixes
    if ($null -eq $prefix) { return }
    $parentFolder = if ($isDirectory) { $info.Parent.FullName } else { $info.DirectoryName }

    if ($action -eq "delete") {
        $targetName = S "EgQgADoEPgRABDcEOAQ9BEME"
    } else {
        $targetName = Get-CleanName $info.Name $prefix
    }

    $row = [PSCustomObject]@{
        Path = $info.FullName
        Folder = $parentFolder
        Name = $info.Name
        Prefix = $prefix
        TargetName = $targetName
        IsDirectory = $isDirectory
        Depth = Get-PathDepth $info.FullName
    }
    $script:Items.Add($row)

    $item = New-Object System.Windows.Forms.ListViewItem($info.Name)
    [void]$item.SubItems.Add($prefix)
    [void]$item.SubItems.Add($targetName)
    [void]$item.SubItems.Add($parentFolder)
    [void]$list.Items.Add($item)
}

function Set-Status($text, $kind = "info") {
    $statusLabel.Text = $text
    $statusLabel.ForeColor = switch ($kind) {
        "ok" { [System.Drawing.Color]::FromArgb(88, 214, 141) }
        "warn" { [System.Drawing.Color]::FromArgb(244, 208, 63) }
        "bad" { [System.Drawing.Color]::FromArgb(255, 120, 120) }
        default { [System.Drawing.Color]::FromArgb(185, 192, 205) }
    }
}

function Scan-Files($action) {
    $script:Items.Clear()
    $list.Items.Clear()
    $script:LastAction = $action

    $folder = $folderBox.Text.Trim()
    if (-not (Test-Path -LiteralPath $folder -PathType Container)) {
        Set-Status (S "EgRLBDEENQRABDgEQgQ1BCAAQQRDBEkENQRBBEIEMgRDBE4ESQRDBE4EIAA/BDAEPwQ6BEMELgA=") "bad"
        return
    }

    $prefixes = Get-Prefixes
    if ($prefixes.Count -eq 0) {
        Set-Status (S "IwQ6BDAENgQ4BEIENQQgADwEOAQ9BDgEPARDBDwEIAA+BDQEOAQ9BCAAPwRABDUERAQ4BDoEQQQuAA==") "bad"
        return
    }

    $search = if ($recursiveBox.Checked) { [System.IO.SearchOption]::AllDirectories } else { [System.IO.SearchOption]::TopDirectoryOnly }
    foreach ($path in [System.IO.Directory]::EnumerateFiles($folder, "*", $search)) {
        Add-MatchedItem $path $false $prefixes $action
    }

    foreach ($path in [System.IO.Directory]::EnumerateDirectories($folder, "*", $search)) {
        Add-MatchedItem $path $true $prefixes $action
    }

    if ($script:Items.Count -eq 0) {
        Set-Status (S "IQQ+BDIEPwQwBDQENQQ9BDgEOQQgAD0ENQRCBC4A") "warn"
    } else {
        $mode = if ($action -eq "delete") { S "QwQ0BDAEOwQ1BD0EOAQ1BA==" } else { S "PwQ1BEAENQQ4BDwENQQ9BD4EMgQwBD0EOAQ1BA==" }
        Set-Status ((S "HQQwBDkENAQ1BD0EPgQgAEQEMAQ5BDsEPgQyBDoAIAB7ADAAfQAuACAAIAQ1BDYEOAQ8BDoAIAB7ADEAfQAuAA==") -f $script:Items.Count, $mode) "ok"
    }
}

function Execute-Action {
    if ($script:Items.Count -eq 0) {
        Set-Status (S "IQQ9BDAERwQwBDsEMAQgADIESwQ/BD4EOwQ9BDgEQgQ1BCAAQQQ6BDAEPQQ4BEAEPgQyBDAEPQQ4BDUELgA=") "warn"
        return
    }

    $verb = if ($script:LastAction -eq "delete") { S "PwQ1BEAENQQ8BDUEQQRCBDgEQgRMBCAAMgQgADoEPgRABDcEOAQ9BEME" } else { S "PwQ1BEAENQQ4BDwENQQ9BD4EMgQwBEIETAQ=" }
    $confirm = [System.Windows.Forms.MessageBox]::Show(
        ((S "JAQwBDkEOwQ+BDIEOgAgAHsAMAB9AC4AIAASBEsEPwQ+BDsEPQQ4BEIETAQgADQENQQ5BEEEQgQyBDgENQQ6ACAAewAxAH0APwA=") -f $script:Items.Count, $verb),
        (S "HwQ+BDQEQgQyBDUEQAQ2BDQENQQ9BDgENQQ="),
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )
    if ($confirm -ne [System.Windows.Forms.DialogResult]::Yes) { return }

    $done = 0
    $errors = New-Object System.Collections.Generic.List[string]

    foreach ($item in ($script:Items | Sort-Object Depth -Descending)) {
        try {
            if ($script:LastAction -eq "delete") {
                if ($item.IsDirectory) {
                    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory(
                        $item.Path,
                        [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,
                        [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
                    )
                } else {
                    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile(
                        $item.Path,
                        [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,
                        [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
                    )
                }
            } else {
                $target = Get-UniquePath $item.Folder $item.TargetName $item.Path
                if ($target -ine $item.Path) {
                    Move-Item -LiteralPath $item.Path -Destination $target
                }
            }
            $done++
        } catch {
            $errors.Add("$($item.Name): $($_.Exception.Message)")
        }
    }

    Scan-Files $script:LastAction
    if ($errors.Count -gt 0) {
        Set-Status ((S "EwQ+BEIEPgQyBD4EOgAgAHsAMAB9ACwAIAA+BEgEOAQxBD4EOgQ6ACAAewAxAH0ALgAgAB8ENQRABDIESwQ5BCAAQQQxBD4EOQQ6ACAAewAyAH0A") -f $done, $errors.Count, $errors[0]) "bad"
    } else {
        Set-Status ((S "EwQ+BEIEPgQyBD4EOgAgAHsAMAB9AC4A") -f $done) "ok"
    }
}

$form = New-Object System.Windows.Forms.Form
$form.Text = S "HgRHBDgEQQRCBDoEMAQgAD8EQAQ1BEQEOAQ6BEEEPgQyBA=="
$form.StartPosition = "CenterScreen"
$form.Size = New-Object System.Drawing.Size(980, 680)
$form.MinimumSize = New-Object System.Drawing.Size(820, 560)
$form.BackColor = [System.Drawing.Color]::FromArgb(22, 24, 29)
$form.Font = New-Font 10

$title = New-Object System.Windows.Forms.Label
$title.Text = S "HgRHBDgEQQRCBDoEMAQgAD8EQAQ1BEQEOAQ6BEEEPgQyBA=="
$title.Font = New-Font 18 ([System.Drawing.FontStyle]::Bold)
$title.ForeColor = [System.Drawing.Color]::White
$title.Location = New-Object System.Drawing.Point(22, 18)
$title.Size = New-Object System.Drawing.Size(360, 34)
$form.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = S "IwQxBDgEQAQwBDUEQgQgAD8EQAQ1BEQEOAQ6BEEESwQgADgENwQgADgEPAQ1BD0EIABEBDAEOQQ7BD4EMgQgADgEIABDBDQEMAQ7BE8ENQRCBCAARAQwBDkEOwRLBCAAPwQ+BCAAPwRABDUERAQ4BDoEQQQwBDwELgA="
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(170, 177, 190)
$subtitle.Location = New-Object System.Drawing.Point(24, 56)
$subtitle.Size = New-Object System.Drawing.Size(760, 24)
$form.Controls.Add($subtitle)

$folderLabel = New-Object System.Windows.Forms.Label
$folderLabel.Text = S "HwQwBD8EOgQwBA=="
$folderLabel.ForeColor = [System.Drawing.Color]::FromArgb(220, 224, 232)
$folderLabel.Location = New-Object System.Drawing.Point(26, 100)
$folderLabel.Size = New-Object System.Drawing.Size(120, 22)
$form.Controls.Add($folderLabel)

$folderBox = New-Object System.Windows.Forms.TextBox
$folderBox.Location = New-Object System.Drawing.Point(28, 126)
$folderBox.Size = New-Object System.Drawing.Size(760, 28)
$folderBox.BackColor = [System.Drawing.Color]::FromArgb(34, 38, 46)
$folderBox.ForeColor = [System.Drawing.Color]::White
$folderBox.BorderStyle = "FixedSingle"
$form.Controls.Add($folderBox)

$browseBtn = New-Object System.Windows.Forms.Button
$browseBtn.Text = S "EgRLBDEEQAQwBEIETAQ="
$browseBtn.Location = New-Object System.Drawing.Point(804, 123)
$browseBtn.Size = New-Object System.Drawing.Size(130, 34)
$browseBtn.BackColor = [System.Drawing.Color]::FromArgb(66, 133, 244)
$browseBtn.ForeColor = [System.Drawing.Color]::White
$browseBtn.FlatStyle = "Flat"
$browseBtn.FlatAppearance.BorderSize = 0
$browseBtn.Add_Click({
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = S "EgRLBDEENQRABDgEQgQ1BCAAPwQwBD8EOgRDBCAAQQQgAEQEMAQ5BDsEMAQ8BDgE"
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        $folderBox.Text = $dialog.SelectedPath
    }
})
$form.Controls.Add($browseBtn)

$prefixLabel = New-Object System.Windows.Forms.Label
$prefixLabel.Text = S "HwRABDUERAQ4BDoEQQRLBDoAIAA/BD4EIAA+BDQEPQQ+BDwEQwQgADIEIABBBEIEQAQ+BDoENQQsACAARwQ1BEAENQQ3BCAANwQwBD8ETwRCBEMETgQgADgEOwQ4BCAAOwA="
$prefixLabel.ForeColor = [System.Drawing.Color]::FromArgb(220, 224, 232)
$prefixLabel.Location = New-Object System.Drawing.Point(26, 176)
$prefixLabel.Size = New-Object System.Drawing.Size(420, 22)
$form.Controls.Add($prefixLabel)

$prefixBox = New-Object System.Windows.Forms.TextBox
$prefixBox.Multiline = $true
$prefixBox.ScrollBars = "Vertical"
$prefixBox.Location = New-Object System.Drawing.Point(28, 202)
$prefixBox.Size = New-Object System.Drawing.Size(480, 84)
$prefixBox.Text = "[QWERTY.COM]"
$prefixBox.BackColor = [System.Drawing.Color]::FromArgb(34, 38, 46)
$prefixBox.ForeColor = [System.Drawing.Color]::White
$prefixBox.BorderStyle = "FixedSingle"
$form.Controls.Add($prefixBox)

$recursiveBox = New-Object System.Windows.Forms.CheckBox
$recursiveBox.Text = S "EgQ6BDsETgRHBDAETwQgAD8EPgQ0BD8EMAQ/BDoEOAQ="
$recursiveBox.ForeColor = [System.Drawing.Color]::FromArgb(220, 224, 232)
$recursiveBox.Location = New-Object System.Drawing.Point(540, 204)
$recursiveBox.Size = New-Object System.Drawing.Size(170, 28)
$recursiveBox.BackColor = $form.BackColor
$form.Controls.Add($recursiveBox)

$scanRenameBtn = New-Object System.Windows.Forms.Button
$scanRenameBtn.Text = S "IQQ6BDAEPQQ6ACAAQwQxBEAEMARCBEwEIAA/BEAENQREBDgEOgRBBEsE"
$scanRenameBtn.Location = New-Object System.Drawing.Point(540, 244)
$scanRenameBtn.Size = New-Object System.Drawing.Size(190, 42)
$scanRenameBtn.BackColor = [System.Drawing.Color]::FromArgb(52, 168, 83)
$scanRenameBtn.ForeColor = [System.Drawing.Color]::White
$scanRenameBtn.FlatStyle = "Flat"
$scanRenameBtn.FlatAppearance.BorderSize = 0
$scanRenameBtn.Add_Click({ Scan-Files "rename" })
$form.Controls.Add($scanRenameBtn)

$scanDeleteBtn = New-Object System.Windows.Forms.Button
$scanDeleteBtn.Text = S "IQQ6BDAEPQQ6ACAAQwQ0BDAEOwQ4BEIETAQgAEQEMAQ5BDsESwQ="
$scanDeleteBtn.Location = New-Object System.Drawing.Point(744, 244)
$scanDeleteBtn.Size = New-Object System.Drawing.Size(190, 42)
$scanDeleteBtn.BackColor = [System.Drawing.Color]::FromArgb(218, 68, 83)
$scanDeleteBtn.ForeColor = [System.Drawing.Color]::White
$scanDeleteBtn.FlatStyle = "Flat"
$scanDeleteBtn.FlatAppearance.BorderSize = 0
$scanDeleteBtn.Add_Click({ Scan-Files "delete" })
$form.Controls.Add($scanDeleteBtn)

$list = New-Object System.Windows.Forms.ListView
$list.Location = New-Object System.Drawing.Point(28, 312)
$list.Size = New-Object System.Drawing.Size(906, 250)
$list.Anchor = "Top, Bottom, Left, Right"
$list.View = "Details"
$list.FullRowSelect = $true
$list.GridLines = $false
$list.BackColor = [System.Drawing.Color]::FromArgb(29, 33, 40)
$list.ForeColor = [System.Drawing.Color]::FromArgb(235, 238, 245)
$list.BorderStyle = "FixedSingle"
[void]$list.Columns.Add((S "JAQwBDkEOwQvAD8EMAQ/BDoEMAQ="), 260)
[void]$list.Columns.Add((S "HwRABDUERAQ4BDoEQQQ="), 160)
[void]$list.Columns.Add((S "EQRDBDQENQRCBA=="), 220)
[void]$list.Columns.Add((S "HwQwBD8EOgQwBA=="), 245)
$form.Controls.Add($list)

$executeBtn = New-Object System.Windows.Forms.Button
$executeBtn.Text = S "EgRLBD8EPgQ7BD0EOARCBEwE"
$executeBtn.Anchor = "Bottom, Right"
$executeBtn.Location = New-Object System.Drawing.Point(774, 586)
$executeBtn.Size = New-Object System.Drawing.Size(160, 42)
$executeBtn.BackColor = [System.Drawing.Color]::FromArgb(66, 133, 244)
$executeBtn.ForeColor = [System.Drawing.Color]::White
$executeBtn.FlatStyle = "Flat"
$executeBtn.FlatAppearance.BorderSize = 0
$executeBtn.Add_Click({ Execute-Action })
$form.Controls.Add($executeBtn)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Anchor = "Bottom, Left, Right"
$statusLabel.Text = S "EwQ+BEIEPgQyBD4EIAA6BCAAQAQwBDEEPgRCBDUELgA="
$statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(185, 192, 205)
$statusLabel.Location = New-Object System.Drawing.Point(28, 594)
$statusLabel.Size = New-Object System.Drawing.Size(720, 28)
$form.Controls.Add($statusLabel)

[void]$form.ShowDialog()
