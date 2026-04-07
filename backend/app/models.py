"""Pydantic schemas for request/response validation."""
from pydantic import BaseModel, Field
from typing import Optional


# ---- Songs ----

class SongCreate(BaseModel):
    title: str = Field(..., min_length=1)
    artist: str = Field(..., min_length=1)
    album: Optional[str] = None
    duration: Optional[int] = None
    file_path: Optional[str] = None


class SongUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1)
    artist: Optional[str] = Field(None, min_length=1)
    album: Optional[str] = None
    duration: Optional[int] = None


class SongResponse(BaseModel):
    id: int
    title: str
    artist: str
    album: Optional[str]
    duration: Optional[int]
    file_path: Optional[str]
    source: str
    tags: list[str]
    playlists: list[str]
    created_at: str
    updated_at: str


# ---- Tags ----

class TagCreate(BaseModel):
    name: str = Field(..., min_length=1)


class TagResponse(BaseModel):
    id: int
    name: str
    song_count: int
    created_at: str


class TagAssign(BaseModel):
    tag_names: list[str] = Field(..., min_length=1)


# ---- Playlists ----

class PlaylistCreate(BaseModel):
    name: str = Field(..., min_length=1)
    color: Optional[str] = None
    emoji: Optional[str] = None


class PlaylistUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    color: Optional[str] = None
    emoji: Optional[str] = None


class PlaylistSongAdd(BaseModel):
    song_id: int


class PlaylistReorder(BaseModel):
    song_ids: list[int]


class PlaylistResponse(BaseModel):
    id: int
    name: str
    color: Optional[str]
    emoji: Optional[str]
    song_count: int
    created_at: str
    updated_at: str


class PlaylistDetailResponse(PlaylistResponse):
    songs: list[SongResponse]


# ---- Filter ----

class FilterRequest(BaseModel):
    query: str = Field(..., min_length=1)


# ---- Scanner ----

class ScanRequest(BaseModel):
    folder_path: str = Field(..., min_length=1)
    playlist_name: Optional[str] = None