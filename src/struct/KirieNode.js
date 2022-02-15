const { WebSocket } = require("ws");

class KirieNode {
    constructor(kirie, options) {
        this.kirie = kirie;
        this.options = options;
        if (!this.options.url) {
            throw new TypeError("Options 'url' is required argument.");
        }
        if (!this.options.password) {
            throw new TypeError("Options 'password' is required argument.");
        }
        if (!this.options.secure) {
            this.options.secure = false;
        }
        if (typeof this.options.secure !== "boolean") {
            throw new TypeError("Options 'secure' type must be a boolean.");
        }
        if (!this.options.retryAmount) {
            this.options.retryAmount = 5;
        }
        if (!this.options.retryDelay) {
            this.options.retryDelay = 50e2;
        }
        if (!this.options.retryTimeout) {
            this.options.retryTimeout = 30e3;
        }

        this.stats = {
            players: 0,
            playingPlayers: 0,
            uptime: 0,
            memory: {
                free: 0,
                used: 0,
                allocated: 0,
                reservable: 0,
            },
            cpu: {
                cores: 0,
                systemLoad: 0,
                lavalinkLoad: 0,
            },
            lastUpdated: Date.now(),
        };

        this.socket = null;
        this.connect();
    }

    get connected() {
        if (!this.socket) {
            return false;
        }
        return this.socket.readyState === WebSocket.OPEN;
    }

    connect() {
        const headers = {
            Authorization: this.options.password,
            "User-Id": this.kirie.client.user.id,
            "Num-Shards": this.kirie?.shards ?? 0,
            "Client-Name": this.kirie?.clientName ?? "Kirie",
        };
        this.socket = new WebSocket(`ws${this.options.secure ? "s" : ""}://${this.options.url}/`, { headers });
        this.socket.once("open", this.open.bind(this));
        this.socket.once("close", this.close.bind(this));
        this.socket.on("error", this.error.bind(this));
        this.socket.on("message", this.message.bind(this));
    }

    open() {
        this.kirie.emit("nodeConnect", this);
    }

    close(code, reason) {
        this.kirie.emit("nodeClose", this, { code, reason });
        if (code !== 1000 || reason !== "destroy") {
            for (let i = 0; i < this.options.retryAmount; i += 1) {
                this.reconnect();
                i += 1;
                if (i === this.options.retryAmount) {
                    throw new RangeError(`Can't establish websocket connection after ${this.options.retryAmount} retries.`);
                }
            }
        }
    }

    error(msg) {
        this.kirie.emit("nodeError", this, msg || "");
    }

    reconnect() {
        setTimeout(() => {
            this.socket.removeAllListeners();
            this.socket = null;
            this.kirie.emit("nodeReconnect", this);
            this.connect();
        }, this.open.retryDelay);
    }

    destroyNode() {
        if (!this.connected) {
            throw new RangeError("Lavalink node isn't connected yet.");
        }
        this.socket.close(1000, "destroy");
        this.socket.removeAllListeners();
        this.socket = null;
        this.kirie.nodeCollection.delete(this.options.url);
    }

    message(data) {
        if (!data) {
            throw new RangeError("No incoming payloads found.");
        }

        const payload = JSON.parse(data?.toString());
        const {
            op,
            type,
            code,
            guildId,
            state,
        } = payload;

        if (!op) return;

        const player = this.kirie.playerCollection.get(guildId);
        if (op !== "event") {
            // eslint-disable-next-line default-case
            switch (op) {
                case "stats":
                    this.stats = { ...payload };
                    delete (this.stats).op;
                break;
                case "playerUpdate":
                    if (player) {
                        player.position = state?.position
                        ?? 0;
                    }
                break;
            }
        } else if (op === "event") {
            if (!player) return;
            player.isPlaying = false;
            const track = player.queue.first;

            // eslint-disable-next-line default-case
            switch (type) {
                case "TrackStartEvent":
                    player.isPlaying = true;
                    this.kirie.emit("trackPlay", track, player, payload);
                break;

                case "TrackEndEvent":
                    if (!track) return;
                    if (track && player.queue.repeatTrack) {
                        player.play();
                    } else if (track && player.queue.repeatQueue) {
                        const toAdd = player.queue.remove();
                        if (toAdd) {
                            player.queue.add(toAdd);
                        }
                        player.play();
                    } else if (track && player.queue.size > 1) {
                        player.queue.remove();
                        player.play();
                        this.kirie.emit("trackEnd", track, player, payload);
                    } else if (track && player.queue.size === 1) {
                        player.queue.remove();
                        this.kirie.emit("queueEnd", track, player, payload);
                    }
                break;

                case "TrackStuckEvent":
                    if (!track) return;
                    player.queue.remove();
                    if (player.queue.skipOnError) {
                        if (player.queue.length > 1) {
                            player.play();
                        }
                    }
                    this.kirie.emit("trackStuck", track, player, payload);
                break;

                case "TrackExceptionEvent":
                    if (!track) return;
                    player.queue.remove();
                    if (player.queue.skipOnError) {
                        if (player.queue.length > 1) {
                            player.play();
                        }
                    }
                    this.kirie.emit("trackError", track, player, payload);
                break;

                case "WebSocketClosedEvent":
                    if ([4009, 4015].includes(code)) {
                        this.kirie.post({
                            op: 4,
                            d: {
                                guild_id: guildId,
                                channel_id: player?.options?.voiceChannel?.channelID,
                                self_mute: player?.options?.selfMute ?? false,
                                self_deaf: player?.options?.selfDeafen ?? false,
                            },
                        });
                    }
                    this.kirie.emit("socketClosed", this, payload);
                break;
            }
        } else {
            this.kirie.emit("nodeError", this, `Unknown event with op: ${op} and payload: ${payload}`);
        }
    }

    post(data) {
        return new Promise((res, rej) => {
            if (!this.connected) {
                res(false);
            }
            const formattedData = JSON.stringify(data);
            if (!formattedData || !formattedData.startsWith("{")) {
                rej(new Error("No JSON payloads found in websocket data."));
            }
            this.socket.send(formattedData, (err) => {
                if (err) {
                    rej(err);
                } else {
                    res(true);
                }
            });
        });
    }
}

module.exports = KirieNode;
