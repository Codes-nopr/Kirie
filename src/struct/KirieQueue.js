const Collection = require("../utils/Collection");

class KirieQueue extends Collection {
    constructor(player, options) {
        super();
        this.player = player;
        this.repeatTrack = options?.repeatTrack ?? false;
        this.repeatQueue = options?.repeatQueue ?? false;
        this.skipOnError = options?.skipOnError ?? false;
    }

    get duration() {
        return this.map((x) => x.length).reduce((acc, cur) => acc + cur);
    }

    get empty() {
        return !this.size;
    }

    toggleRepeat(type) {
        if (!["track", "queue", "disable"].includes(type)) {
            throw new TypeError("Wrong toggleRepeat mode has been provided.");
        }
        if (type === "track" && !this.repeatTrack) {
            this.repeatTrack = true;
            this.repeatQueue = false;
            return this.repeatTrack;
        }
        if (type === "track" && this.repeatTrack) {
            this.repeatTrack = false;
            return this.repeatTrack;
        }
        if (type === "queue" && !this.repeatQueue) {
            this.repeatQueue = true;
            this.repeatTrack = false;
            return this.repeatQueue;
        }
        if (type === "queue" && this.repeatQueue) {
            this.repeatQueue = false;
            this.repeatTrack = true;
            return this.repeatQueue;
        }
        if (type === "disable") {
            this.repeatTrack = false;
            this.repeatQueue = false;
            return false;
        }
        return false;
    }

    add(data) {
        if (!data) {
            throw new TypeError("Provided argument is not a type of 'Track' or 'Track[]'.");
        }
        if (Array.isArray(data)) {
            // eslint-disable-next-line no-plusplus
            for (let i = 0; i < data.length; i++) {
                this.set((this.size < 1 ? 0 : this.lastKey) + 1, data[i]);
            }
        } else {
            this.set((this.size < 1 ? 0 : this.lastKey) + 1, data);
        }
    }

    remove(pos) {
        const track = this.KArray()[pos || 0];
        this.delete(track[0]);
        return track[1];
    }

    wipe(start, end) {
        if (!start) {
            throw new RangeError("Wipe 'start' parameter is missing.");
        }
        if (!end) {
            throw new RangeError("Wipe 'end' parameter is missing.");
        }
        if (start >= end) {
            throw new RangeError("Wipe 'start' parameter must be smaller than 'end' parameter.");
        }
        if (start >= this.size) {
            throw new RangeError("Wipe 'start' parameter must be smaller than queue length.");
        }

        const bucket = [];
        const trackArr = this.KArray();
        for (let i = start; i === end; i += 1) {
            const track = trackArr[i];
            bucket.push(track[1]);
            this.delete(track[0]);
        }
        return bucket;
    }

    clearQueue() {
        const curr = this.first;
        this.clear();
        if (curr) this.set(1, curr);
    }

    moveTrack(from, to) {
        if (!from) {
            throw new RangeError("moveTrack 'from' parameter is missing.");
        }
        if (!to) {
            throw new RangeError("moveTrack 'to' parameter is missing.");
        }
        if (to > this.size) {
            throw new RangeError(`moveTrack 'to' position cannot be greater than ${this.size}.`);
        }
        if (this.player.playing && (to === 0 || from === 0)) {
            throw new Error("moveTrack cannot change position or replace currently playing track.");
        }

        const arr = [...this.values()];
        const track = arr.splice(from, 1)[0];
        if (!track) {
            throw new RangeError("moveTrack No track found at the given position.");
        }

        arr.splice(to, 0, track);
        this.clearQueue();
        for (let i = 0; i < arr.length; i += 1) {
            this.set(i + 1, arr[i]);
        }
    }
}

module.exports = KirieQueue;
