const { EventEmitter } = require("events");
const KirieNode = require("./KirieNode");
const KiriePlayer = require("./KiriePlayer");
const Collection = require("../utils/Collection");
const { voicePayloads } = require("../utils/Constants");

const states = new Map();

class KirieManager extends EventEmitter {
    constructor(client, node) {
        super();
        this.client = client;
        this.nodeOptions = node;
        this.shards = client?.shards?.length ?? 0;
        this.nodeCollection = new Collection();
        this.playerCollection = new Collection();

        // eslint-disable-next-line no-restricted-syntax
        for (const nodes of this.nodeOptions) {
            if (!this.nodeCollection.has(nodes.url)) {
                const newNode = new KirieNode(this, nodes);
                this.nodeCollection.set(nodes.url, newNode);
            }
        }

        this.client.on("rawWS", this.handleStateUpdate.bind(this));
    }

    get leastLoadNode() {
        const sorted = this.nodeCollection
        .toArray()
        .filter((x) => x.connected)
        .sort((a, b) => {
            const loadA = (a.stats.cpu.systemLoad / a.stats.cpu.cores) * 100;
            const loadB = (b.stats.cpu.systemLoad / b.stats.cpu.cores) * 100;
            return loadB - loadA;
        });
        return sorted[0];
    }

    post(data) {
        if (!data) return;
        const guild = this.client.guilds.get(data.d.guild_id);
        if (guild) {
            guild.shard.sendWS(data.op, data.d);
        }
    }

    connect(nodeOptions) {
        if (!nodeOptions || !nodeOptions.url) {
            throw new Error("No nodes are provided!");
        }
        const newNode = new KirieNode(this, nodeOptions);
        this.nodeCollection.set(nodeOptions.url, newNode);
        return newNode;
    }

    create(options, queueOption) {
        if (!options.guild) {
            throw new TypeError("Create options argument 'guild' is null or undefined.");
        }
        if (!options.voiceChannel) {
            throw new TypeError("Create options argument 'voiceChannel' is null or undefined.");
        }
        if (!options.textChannel) {
            throw new TypeError("Create options argument 'textChannel' is null or undefined.");
        }
        const oldPlayer = this.playerCollection.get(options.guild.id);
        if (oldPlayer) {
            return oldPlayer;
        }
        return new KiriePlayer(this, options, queueOption);
    }

    handleStateUpdate(data) {
        if (!["VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(data.t)) {
            return;
        }
        if (data.d.user_id
            && data.d.user_id !== this.client.user.id) {
            return;
        }

        const player = this.playerCollection.get(data.d.guild_id);
        if (!player) return;
        const voiceState = states.get(data?.d?.guild_id) ?? {};

        switch (data.t) {
            case voicePayloads.voiceStateUpdate:
                voiceState.op = "voiceUpdate";
                voiceState.sessionId = data?.d?.session_id ?? null;

                if (data.d.channel_id) {
                    if (player.options.voiceChannel.id !== data.d.channel_id) {
                        const newChannel = this.client.getChannel(data?.d?.channel_id
                            ?? null);
                        this.emit("playerMove", player, player.options.voiceChannel.id, data.d.channel_id);
                        if (newChannel) player.options.voiceChannel = newChannel;
                    }
                } else {
                    this.emit("playerDisconnect", player, player.options.voiceChannel);
                    player.voiceChannel = null;
                    player.voiceState = {};
                    player.pause(true);
                }
            break;

            case voicePayloads.voiceServerUpdate:
                voiceState.guildId = data?.d?.guild_id ?? null;
                voiceState.event = data?.d ?? null;
            break;

            default:
            break;
        }

        states.set(data.d?.guild_id, voiceState);
        const {
            op,
            guildId,
            sessionId,
            event,
        } = voiceState;

        if (op && guildId && sessionId && event) {
            player.node.post(voiceState)
            .then(() => states.set(guildId, {}))
            .catch((err) => {
                if (err) throw new Error(err);
            });
        }
    }
}

module.exports = KirieManager;
