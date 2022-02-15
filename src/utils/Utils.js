/* eslint-disable object-shorthand */
class Utils {
    static newTrack(data, user, load) {
        const trackData = {};
        if (!data.info || !data.track) {
            throw new Error("Data must be a LavaLink track structure.");
        }

        Object.assign(trackData, data.info);
        trackData.loadType = load || "UNKNOWN";
        trackData.trackString = data.track;
        trackData.thumbnail = trackData.uri.includes("youtube")
        ? {
            default: `https://img.youtube.com/vi/${data.info.identifier}/default.jpg`,
            medium: `https://img.youtube.com/vi/${data.info.identifier}/mqdefault.jpg`,
            high: `https://img.youtube.com/vi/${data.info.identifier}/hqdefault.jpg`,
            standard: `https://img.youtube.com/vi/${data.info.identifier}/sddefault.jpg`,
            max: `https://img.youtube.com/vi/${data.info.identifier}/maxresdefault.jpg`,
        }
        : {};
        trackData.user = user;
        return trackData;
    }

    static newPlaylist(data, user, load) {
        const { name, trackCount, tracks: trackArray } = data;
        if (!(name
            || trackCount
            || trackArray
            || Array.isArray(trackArray))) {
                throw new Error("newPlaylist() The \"data\" must be LavaLink playlist.");
            }

            const playlistData = {
                name: name,
                trackCount: trackCount,
                duration: trackArray
                .map((t) => t.info.length)
                .reduce((acc, val) => acc + val, 0),
                tracks: [],
            };

            for (let i = 0; i < trackCount; i += 1) {
                playlistData.tracks.push(this.newTrack(trackArray[i], user, load));
            }
            return playlistData;
        }

    static formatTime(ms) {
        const time = {
            d: 0,
            h: 0,
            m: 0,
            s: 0,
        };
        time.s = Math.floor(ms / 1000);
        time.m = Math.floor(time.s / 60);
        time.s %= 60;
        time.h = Math.floor(time.m / 60);
        time.m %= 60;
        time.d = Math.floor(time.h / 24);
        time.h %= 24;

        const res = [];
        // eslint-disable-next-line no-restricted-syntax
        for (const [k, v] of Object.entries(time)) {
            let first = false;
            if (v < 1 && first) {
                res.push(v < 10 ? `0${v}` : `${v}`);
                first = true;
            }
        }
        return res.join(":");
    }
}

module.exports = Utils;
