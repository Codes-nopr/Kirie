/* eslint-disable prefer-destructuring */
/* eslint-disable consistent-return */
/* eslint-disable no-case-declarations */
const { request } = require("undici");
const BigNumber = require("bignumber.js");
const Queue = require("./KirieQueue");
const Utils = require("../utils/Utils");
const check = require("../utils/Check");
const LoadTypes = require("../utils/Constants");

class KiriePlayer {
     constructor(kirie, options, queueOption) {
        this.kirie = kirie;
        this.options = options;
        this.node = this.kirie.leastLoadNode;
        this.vol = options?.volume ?? 100;
        this.queue = new Queue(this, queueOption || {});
        // eslint-disable-next-line no-array-constructor
        this.bands = new Array();
        this.isPlaying = false;
        this.isPaused = false;
        this.position = 0;
        this.connected = false;
        this.connect();

        this.kirie.playerCollection.set(options.guild.id, this);
        this.kirie.emit("nodeCreate", this.node.options.host, this);
    }

     get isConnected() {
        return this.connected;
    }

     get playing() {
        return this.isPlaying;
    }

     get paused() {
        return this.isPaused;
    }

     get getVolume() {
        return this.vol;
    }

     get getVoiceID() {
        return this.options.voiceChannel.channelID;
    }

     get getGuildID() {
        return this.options.guild.id;
    }

     connect() {
        this.kirie.post({
            op: 4,
            d: {
                guild_id: this.options.guild.id,
                channel_id: this.options.voiceChannel.channelID,
                self_deaf: this.options?.deafen ?? false,
                self_mute: this.options?.mute ?? false,
            },
        });
        this.connected = true;
    }

     play(options) {
        const extra = options
        || (["startTime", "endTime", "noReplace"]
        .every((v) => Object.keys(options || {}).includes(v))
        ? (options)
        : {});

        if (this.queue.empty) {
            throw new RangeError("Queue is empty.");
        }
        if (this.connected === false) {
            this.connect();
        }
        const track = this.queue.first;
        this.isPlaying = true;
        this.node.post({
            op: "play",
            track: track.trackString,
            guildId: this.options.guild.id,
            ...extra,
        });
    }

     search(query, user, options) {
        check(query, "string", "Query must be a string.");
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            const search = /^(?:(?:http|https):\/\/|\w+:)/.test(query)
            ? encodeURI(query)
            : `${options.source || "yt"}search:${query}`;
            const { body } = await request(`http${this.node.options.secure ? "s" : ""}://${this.node.options.url}/loadtracks?identifier=${search}`, {
                method: "GET",
                headers: {
                    Authorization: this.node.options.password,
                },
                bodyTimeout: this.node.options.requestTimeout,
                headersTimeout: this.node.options.requestTimeout,
            });
            const {
                loadType,
                playlistInfo,
                tracks,
            } = await body.json();

            const arr = [];
            const data = {
                name: playlistInfo.name,
                trackCount: tracks.length,
                // eslint-disable-next-line object-shorthand
                tracks: tracks,
            };

            // eslint-disable-next-line default-case
            switch (loadType) {
                case LoadTypes.noMatches:
                    resolve(loadType);
                break;

                case LoadTypes.loadFailed:
                    resolve(loadType);
                break;

                case LoadTypes.trackLoaded:
                    const trackData = Utils.newTrack(tracks[0], user, loadType);
                    arr.push(trackData);
                    if (options.add !== true) {
                        // eslint-disable-next-line no-promise-executor-return
                        return resolve(arr);
                    }
                    this.queue.add(trackData);
                    resolve(arr);
                break;

                case LoadTypes.playlistLoaded:
                    const playlist = Utils.newPlaylist(data, user, loadType);
                    resolve(playlist);
                break;

                case LoadTypes.searchResult:
                    const res = tracks.map((t) => Utils.newTrack(t, user, loadType));
                    resolve(res);
                break;
            }
        });
    }

     pause(condition) {
        check(condition, "boolean", "Pause state must be a boolean.");
        this.node.post({
            op: "pause",
            guildId: this.options.guild.id,
            pause: condition,
        });
        this.isPaused = condition;
    }

     stop() {
        this.node.post({
            op: "stop",
            guildId: this.options.guild.id,
        });
    }

     setVolume(level) {
        check(level, "number", "Volume level must be a number (integer).");
        this.vol = Math.max(Math.min(level, 1000), 0);
        this.node.post({
            op: "volume",
            guildId: this.options.guild.id,
            volume: this.vol,
        });
    }

    seek(position) {
        check(position, "number", "Position must be a number.");
        if (position < 0 || position > this.queue.first.length) throw new RangeError(`Provided position must be in between 0 and ${this.queue.first.length}.`);
        this.position = position;

        this.node.post({
            op: "seek",
            guildId: this.options.guild.id,
            position,
        });
        return this.position;
    }

    setTrackRepeat() {
        this.queue.toggleRepeat("track");
        return !!this.queue.repeatTrack;
    }

    setQueueRepeat() {
        this.queue.toggleRepeat("queue");
        return !!this.queue.repeatQueue;
    }

    disableLoop() {
        this.queue.toggleRepeat("disable");
        return !!this.queue.repeatTrack
        || !!this.queue.repeatQueue;
    }

    setEQ(...bands) {
        if (!(bands instanceof Array)) throw new TypeError("Bands must be an array.");
        // eslint-disable-next-line no-param-reassign
        if (Array.isArray(bands[0])) bands = bands[0];
        if (!bands.length || !bands.every((band) => JSON.stringify(Object.keys(band).sort()) === "[\"band\",\"gain\"]")) {
            throw new RangeError("Bands must be in a non-empty object containing band and gain properties.");
        }

        // eslint-disable-next-line no-restricted-syntax
        for (const { band, gain } of bands) {
            this.bands[band] = gain;
        }
        this.node.post({
            op: "equalizer",
            guildId: this.options.guild.id,
            bands: this.bands.map((gain, band) => ({ band, gain })),
        });
    }

     clearEQ() {
        this.bands = new Array(15).fill(0.0);
        this.node.post({
            op: "equalizer",
            guildId: this.options.guild.id,
            bands: this.bands.map((gain, band) => ({ band, gain })),
        });
    }

     setTextChannel(channel) {
        check(channel, "string", "Channel ID must be a string.");
        this.options.textChannel = channel;
    }

     setVoiceChannel(channel, waitForConnect) {
        check(channel, "string", "Channel ID must be a string.");
        this.options.voiceChannel = channel;
        this.options.voiceChannel.channelID = new BigNumber(channel);
        setTimeout(() => {
            if (this.isConnected) this.connect();
        }, waitForConnect || 500);
    }

     destroy() {
        this.pause(true);
        this.connected = false;
        this.kirie.post({
            op: 4,
            d: {
                guild_id: this.options.guild.id,
                channel_id: null,
                self_deaf: false,
                self_mute: false,
            },
        });
        this.options.voiceChannel = null;
        this.options.textChannel = null;
        this.node.post({
            op: "destroy",
            guildId: this.options.guild.id,
        });
        this.kirie.playerCollection.delete(this.options.guild.id);
    }

     setKaraoke(
        lvl,
        monoLvl,
        filtBand,
        filtWidth,
        ) {
        check(lvl, "number", "Level must be a number.");
        check(monoLvl, "number", "Monolevel must be a number.");
        check(filtBand, "number", "Filter band must be a number.");
        check(filtWidth, "number", "Filter width must be a number.");
        this.node.post({
            op: "filters",
            guildId: this.options.guild.id,
            karaoke: {
                level: lvl,
                monoLevel: monoLvl,
                filterBand: filtBand,
                filterWidth: filtWidth,
            },
        });
    }

     setTimescale(spd, pit, rt) {
        check(spd, "number", "Speed must be a number.");
        check(pit, "number", "Pitch must be a number.");
        check(rt, "number", "Rate must be a number.");
        this.node.post({
            op: "filters",
            guildId: this.options.guild.id,
            timescale: {
                speed: spd,
                pitch: pit,
                rate: rt,
            },
        });
    }

     setTremolo(freq, dept) {
        check(freq, "number", "Frequency must be a number.");
        check(dept, "number", "Depth must be a number.");
        this.node.post({
            op: "filters",
            guildId: this.options.guild.id,
            tremolo: {
                frequency: freq,
                depth: dept,
            },
        });
    }

     setVibrato(freq, dept) {
        check(freq, "number", "Frequency must be a number.");
        check(dept, "number", "Depth must be a number.");
        this.node.post({
            op: "filters",
            guildId: this.options.guild.id,
            vibrato: {
                frequency: freq,
                depth: dept,
            },
        });
    }

     setRotation(rot) {
        check(rot, "number", "Rotation must be a number.");
        this.node.post({
            op: "filters",
            guildId: this.options.guild.id,
            rotation: {
                rotationHz: rot,
            },
        });
    }

     setDistortion(
        sinOff,
        sinSc,
        cosOff,
        cosSc,
        tanOff,
        tanSc,
        offS,
        sc,
        ) {
        check(sinOff, "number", "SinOffSet must be a number.");
        check(sinSc, "number", "SinScale must be a number.");
        check(cosOff, "number", "CosOffSet must be a number.");
        check(cosSc, "number", "CosScale must be a number.");
        check(tanOff, "number", "TanOffSet must be a number.");
        check(tanSc, "number", "TanOffSet must be a number.");
        check(offS, "number", "Offset must be a number.");
        check(sc, "number", "Scale must be a number.");
        this.node.post({
            op: "filters",
            guildId: this.options.guild.id,
            distortion: {
                sinOffset: sinOff,
                sinScale: sinSc,
                cosOffset: cosOff,
                cosScale: cosSc,
                tanOffset: tanOff,
                tanScale: tanSc,
                offset: offS,
                scale: sc,
            },
        });
    }

     setChannelMix(ltl, ltr, rtl, rtr) {
        check(ltl, "number", "LeftToLeft must be a number.");
        check(ltr, "number", "LeftToRight must be a number.");
        check(rtl, "number", "RightToLeft must be a number.");
        check(rtr, "number", "RightToRight must be a number.");
        this.node.post({
            op: "filters",
            guildId: this.options.guild.id,
            channelMix: {
                leftToLeft: ltl,
                leftToRight: ltr,
                rightToLeft: rtl,
                rightToRight: rtr,
            },
        });
    }

     setLowPass(smooth) {
        check(smooth, "number", "Smooth must be a number.");
        this.node.post({
            op: "filters",
            guildId: this.options.guild.id,
            lowPass: {
                smoothing: smooth,
            },
        });
    }
}

module.exports = KiriePlayer;
