@echo off
REM ==============================================================================
REM Orbital Eye — Master Audio Muxing Script
REM Concatenates 3 music segments and muxes with the 2-minute 13-scene video
REM ==============================================================================

echo [1/3] Verifying audio files in music\...
if not exist "music\music_seg1.wav" (
    echo Error: music\music_seg1.wav not found! Please generate it with ACE-Step.
    pause
    exit /b 1
)
if not exist "music\music_seg2.wav" (
    echo Error: music\music_seg2.wav not found! Please generate it with ACE-Step.
    pause
    exit /b 1
)
if not exist "music\music_seg3.wav" (
    echo Error: music\music_seg3.wav not found! Please generate it with ACE-Step.
    pause
    exit /b 1
)

echo [2/3] Concatenating audio segments (0-38s, 38-92s, 92-120s)...
ffmpeg -y -i music\music_seg1.wav -i music\music_seg2.wav -i music\music_seg3.wav -filter_complex "[0:a][1:a][2:a]concat=n=3:v=0:a=1[aout]" -map "[aout]" music\soundtrack_master.wav

echo [3/3] Muxing video and audio into orbital_eye_master.mp4...
ffmpeg -y -i scenes_combined.mp4 -i music\soundtrack_master.wav -c:v copy -c:a aac -b:a 320k -shortest orbital_eye_master.mp4

echo.
echo ==============================================================================
echo MASTER VIDEO READY: orbital_eye_master.mp4 (120s, 1080p60/30, 320kbps audio)
echo ==============================================================================
pause
