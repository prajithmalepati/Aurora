# Music Player App Feature Research
> Research by Gemini 3.5 Flash — comprehensive feature analysis for offline audio players

*(Full document extracted from .docx — saved here for Claude Code reference)*

See the original `.docx` for exact formatting. This is the raw text extraction.

## Core Architectural Paradigm and High-Resolution Audio Support
The consumer audio landscape is experiencing a clear shift, as streaming fatigue and subscription costs prompt users to return to locally curated digital libraries. For an offline audio player to succeed, it must treat local-first file management and high-resolution playback as core architectural priorities.

**Format Support Required:**
- Lossless PCM: FLAC, WAV, ALAC, AIFF
- High-Res DSD: DFF, DSF (up to DSD256)
- Lossy: MP3, AAC, M4A, OGG, Opus, WMA, WavPack, Musepack

**Audiophile workflows:** CD ripping (EAC/XLD), metadata cleaning (MusicBrainz Picard), high-capacity MicroSD (512GB-1TB, FAT32/exFAT).

## OS File Constraints
- **Android:** Scoped Storage (API 29+), MediaStore API, SAF for folder access, granular permissions (READ_MEDIA_AUDIO on 33+)
- **iOS:** Sandboxing, Document Picker, "Open In..." action sheet, AirDrop routing

## Audio Engineering & DSP
- Direct hardware paths: AAudio/OpenSL ES (Android), Audio Toolbox/AVFAudio (iOS)
- Direct Volume Control (DVC) for hardware DAC preamp
- USB DAC support: bit-perfect PCM up to 32-bit/384kHz, native DSD via DoP
- Parametric EQ: 32-band graphic + 64-band parametric (low-shelf, high-shelf, peaking, band-pass)
- AutoEq database integration for headphone profiles
- Output-specific EQ profiles (speakers, wired, Bluetooth per MAC, car)
- Convolution reverb engine (Auditorium, Great Hall, Stadium)
- Gapless playback with pre-buffer thread
- Crossfade 0-10s + fade-to-pause (500ms)
- ReplayGain (track + album modes)
- Variable speed 0.5x-3.0x with pitch preservation
- Pitch shifting in semitone increments

## Queue & Shuffle Engineering
- Multi-queue states (up to 20 concurrent queues in SQLite)
- Smart shuffle: temporal binning, skip penalization ("skip jail"), distance filtering (anti-clustering)
- "Perceived randomness" — avoiding birthday paradox for artist clustering

## UI/UX Design
- Bottom-aligned navigation (Player, Queue, Folders, Albums, Artists, Playlists)
- Gesture controls with adjustable sensitivity
- Dark/light/AMOLED black themes
- Completely ad-free
- Folder-level memory (preserves playback state per directory)
- Fluid navigation with persistent back stack

## Metadata & Lyrics
- Multi-artist tag parsing (split on ; / \\ , NULL bytes)
- Unicode support (UTF-8, UTF-16, GBK, Shift-JIS → UTF-16)
- Interactive lyrics: embedded USLT, external .lrc, local AI phonetic alignment

## Network & Cloud
- SMB, WebDAV, FTP/SFTP, DLNA, NFS protocols
- Cloud integration: iCloud, GDrive, Dropbox, OneDrive, pCloud, Proton Drive
- Media server support: Jellyfin, Navidrome, Plex, Subsonic
- Smart caching for offline playback
- In-app web browser for direct downloads

## Wearables & Automotive
- Standalone watchOS/Wear OS app with direct syncing
- CarPlay + Android Auto native layouts
- Stutter mitigation: Bluetooth/Wi-Fi coexistence, foreground service priority, pre-buffer threads

## Utilities
- Integrated ringtone cutter
- Auto-backup/restore system (.csv/archive)
- Privacy-focused listening reports (weekly/annual)
- Haptic feedback synced to bass
- Offline scrobbling (Last.fm/ListenBrainz) with cached batch upload

## User Feedback Synthesis
- No ads, no subscriptions for core features
- Proper back navigation (don't exit app on back)
- All navigation tabs unlocked
- Gesture sensitivity adjustment
- Persistent artwork caching
- Functional home screen widgets
