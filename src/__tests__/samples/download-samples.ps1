# download-samples.ps1 — run from 'samples/' directory

$ffmpeg = "ffmpeg"
$ffprobe = "ffprobe"
$maxSizeBytes = 10MB
$failed = @()
$oversized = @()
$renameQueue = [System.Collections.Concurrent.ConcurrentQueue[string]]::new()

function SmartDownload($uri, $out) {
    try {
        if ($uri -like "*raw.githubusercontent.com*" -or $uri -like "*githubusercontent.com*") {
            Invoke-WebRequest -Uri $uri -OutFile $out -UseBasicParsing -Headers @{ "User-Agent" = "Mozilla/5.0" } -ErrorAction Stop
        } else {
            Start-BitsTransfer -Source $uri -Destination $out -ErrorAction Stop
        }
        Write-Host "✅ Downloaded: $out"
        return $true
    } catch {
        Write-Warning "❌ Failed to download: $out"
        $failed += $out
        return $false
    }
}

function CompressIfTooLarge($file) {
    if (-not (Test-Path $file)) { return }
    $size = (Get-Item $file).Length
    if ($size -le $maxSizeBytes) { return }

    $tmp = "$file.tmp.mkv"
    & $ffmpeg -y -i $file -c:v libx264 -preset veryfast -crf 36 -c:a aac -b:a 64k $tmp | Out-Null
    Move-Item -Force $tmp $file

    $newSize = (Get-Item $file).Length
    if ($newSize -gt $maxSizeBytes) {
        Write-Warning "🗑️ $file is still too large. Deleting."
        Remove-Item $file -Force
        $oversized += $file
    } else {
        Write-Host "✅ Compressed: $file ($([math]::Round($newSize / 1MB, 2)) MB)"
    }
}

function RenameWithMetadata($file, $base, $license) {
    if (-not (Test-Path $file)) { return }

    $vCodec = & $ffprobe -v error -select_streams v -show_entries stream=codec_name -of default=nokey=1:noprint_wrappers=1 "$file" | Select-Object -First 1
    $aCodec = & $ffprobe -v error -select_streams a -show_entries stream=codec_name -of default=nokey=1:noprint_wrappers=1 "$file" | Select-Object -First 1
    $res = & $ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$file"
    $aCount = (& $ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$file").Count
    $vCount = (& $ffprobe -v error -select_streams v -show_entries stream=index -of csv=p=0 "$file").Count
    $hasSubs = ((& $ffprobe -v error -select_streams s -show_entries stream=index -of csv=p=0 "$file").Count -gt 0)

    $newName = "$base"
    if ($vCodec) { $newName += "_$vCodec" }
    if ($aCodec) { $newName += "_$aCodec" }
    if ($res)    { $newName += "_$res" }
    if ($aCount -gt 1) { $newName += "_${aCount}aud" }
    if ($vCount -gt 1) { $newName += "_${vCount}vid" }
    if ($hasSubs) { $newName += "_subs" }
    $newName += "_$license" + ([System.IO.Path]::GetExtension($file))

    Rename-Item $file $newName -Force
    Write-Host "🔤 Renamed to: $newName"
}

# ───── Media list for parallel download ─────

$mediaList = @(
    @{ Uri = "https://filesamples.com/samples/audio/mp3/sample1.mp3"; Out = "sample.mp3"; Base = "sample"; License = "free" },
    @{ Uri = "https://filesamples.com/samples/audio/wav/sample1.wav"; Out = "sample.wav"; Base = "sample"; License = "free" },
    @{ Uri = "https://filesamples.com/samples/audio/ogg/sample1.ogg"; Out = "sample.ogg"; Base = "sample"; License = "free" },
    @{ Uri = "https://filesamples.com/samples/audio/flac/sample1.flac"; Out = "sample.flac"; Base = "sample"; License = "free" },
    @{ Uri = "https://raw.githubusercontent.com/chintan9/Big-Buck-Bunny/master/subtitles-en.vtt"; Out = "big_buck_bunny_subtitles_en_ccby.vtt"; Base = "big_buck_bunny_subtitles_en"; License = "ccby" },
    @{ Uri = "https://filesamples.com/samples/video/mkv/sample_640x360.mkv"; Out = "sample_640x360.mkv"; Base = "sample_mkv_640x360"; License = "free" },
    @{ Uri = "https://filesamples.com/samples/video/mkv/sample_960x400_ocean_with_audio.mkv"; Out = "sample_960x400.mkv"; Base = "sample_ocean"; License = "free" },
    @{ Uri = "https://raw.githubusercontent.com/ietf-wg-cellar/matroska-test-files/master/test5.mkv"; Out = "test5.mkv"; Base = "big_buck_bunny_test5"; License = "ccby" }
)

# ───── Start parallel download jobs ─────

$jobs = @()
foreach ($item in $mediaList) {
    $jobs += Start-Job -ScriptBlock {
        param($uri, $out)
        try {
            Start-BitsTransfer -Source $uri -Destination $out -ErrorAction Stop
            return "OK $out"
        } catch {
            try {
                Invoke-WebRequest -Uri $uri -OutFile $out -Headers @{ "User-Agent" = "Mozilla/5.0" } -ErrorAction Stop
                return "OK $out"
            } catch {
                return "FAIL $out"
            }
        }
    } -ArgumentList $item.Uri, $item.Out
}

# ───── Wait & process results ─────

$jobs | Wait-Job | Out-Null
foreach ($job in $jobs) {
    $result = Receive-Job $job
    if ($result -like "FAIL*") {
        $failed += $result.Substring(5)
    } elseif ($result -like "OK*") {
        $renameQueue.Enqueue($result.Substring(3))
    }
    Remove-Job $job
}

# ───── Compress + rename ─────

foreach ($file in $renameQueue) {
    $match = $mediaList | Where-Object { $_.Out -eq $file }
    if ($match) {
        CompressIfTooLarge $file
        RenameWithMetadata $file $match.Base $match.License
    }
}

# ───── Big Buck Bunny custom test generation ─────

$src = "bbb_src.mp4"
$subSRT = "big_buck_bunny_subtitles_en_ccby.srt"

if (SmartDownload "http://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_30fps_normal.mp4" $src) {
    Write-Host "`n🎬 Generating Big Buck Bunny test samples..."

    # Create 2 video streams (normal and vflip)
    & $ffmpeg -y -i $src -an -sn -t 15 -vf scale=320:180 -c:v libx264 -crf 36 vid1.mp4
    & $ffmpeg -y -i $src -an -sn -t 15 -vf scale=320:180,vflip -c:v libx264 -crf 36 vid2.mp4

    # Create 2 audio sine tones
    & $ffmpeg -y -f lavfi -i sine=frequency=1000:duration=15 -c:a aac -b:a 64k audio1.aac
    & $ffmpeg -y -f lavfi -i sine=frequency=400:duration=15 -c:a aac -b:a 64k audio2.aac

    # Merge into one file with 2x vid + 2x audio
    & $ffmpeg -y -i vid1.mp4 -i vid2.mp4 -i audio1.aac -i audio2.aac -map 0 -map 2 -map 1 -map 3 -c copy bbb_multi.mp4

    CompressIfTooLarge "bbb_multi.mp4"
    RenameWithMetadata "bbb_multi.mp4" "big_buck_bunny" "ccby"

    # Create version with embedded subtitles (if available)
    if (Test-Path $subSRT) {
        & $ffmpeg -y -i $src -i $subSRT -t 15 -vf scale=320:180 -c:v libx264 -crf 36 -c:a aac -b:a 64k `
            -c:s mov_text -metadata:s:s:0 language=eng bbb_subs.mp4

        CompressIfTooLarge "bbb_subs.mp4"
        RenameWithMetadata "bbb_subs.mp4" "big_buck_bunny" "ccby"
    }

    # Cleanup
    Remove-Item $src, vid1.mp4, vid2.mp4, audio1.aac, audio2.aac -Force
} else {
    $failed += $src
}

# ───── Summary ─────

Write-Host "`n📦 Summary:"
if ($failed.Count -eq 0 -and $oversized.Count -eq 0) {
    Write-Host "✅ All media downloaded, compressed, renamed, and under 10MB."
} else {
    if ($failed.Count -gt 0) {
        Write-Warning "❌ Failed downloads:"
        $failed | ForEach-Object { Write-Warning "- $_" }
    }
    if ($oversized.Count -gt 0) {
        Write-Warning "`n🗑️ Deleted (still too big):"
        $oversized | ForEach-Object { Write-Warning "- $_" }
    }
}
