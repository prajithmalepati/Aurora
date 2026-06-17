"""Aurora backend entry point."""
import os
import sys
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("AURORA_PORT", "8000"))
    # PyInstaller frozen binaries have no source files to watch — disable reload
    is_frozen = getattr(sys, "frozen", False)
    host = os.environ.get("AURORA_HOST", "127.0.0.1")
    uvicorn.run("app.main:app", host=host, port=port, reload=not is_frozen)
