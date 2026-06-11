# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for Aurora backend — onedir mode."""
from PyInstaller.utils.hooks import collect_data_files, collect_submodules
import os

a = Analysis(
    ['run.py'],
    pathex=[os.path.dirname(os.path.abspath('__file__'))],
    binaries=[],
    datas=[
        # mutagen metadata
        *collect_data_files('mutagen'),
        # app package — uvicorn uses string-based import ("app.main:app")
        # which PyInstaller can't trace; include explicitly
        ('app', 'app'),
    ],
    hiddenimports=[
        'boolean',
        # Uvicorn event loop / protocol submodules
        'uvicorn.loops.auto',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan.on',
        # mutagen submodules
        *collect_submodules('mutagen'),
        # miniaudio (C-extension)
        'miniaudio',
        # app submodules that uvicorn string-imports won't trace
        'app.main',
        'app.database',
        'app.paths',
        'app.routers.songs',
        'app.routers.tags',
        'app.routers.playlists',
        'app.routers.filter',
        'app.routers.scanner',
        'app.routers.folders',
        'app.routers.watcher',
        'app.routers.albums',
        'app.services.file_scanner',
        'app.services.file_watcher',
        'app.services.filter_engine',
        'app.services.color_utils',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='aurora-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='aurora-backend',
)
