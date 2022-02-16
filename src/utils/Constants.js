const LoadTypes = {
    loadFailed: "LOAD_FAILED",
    noMatches: "NO_MATCHES",
    trackLoaded: "TRACK_LOADED",
    playlistLoaded: "PLAYLIST_LOADED",
    searchResult: "SEARCH_RESULT",
};

const voicePayloads = {
    voiceStateUpdate: "VOICE_STATE_UPDATE",
    voiceServerUpdate: "VOICE_SERVER_UPDATE",
};

module.exports = { LoadTypes, voicePayloads };
