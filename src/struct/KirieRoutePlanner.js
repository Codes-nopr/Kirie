const { request } = require("undici");

class KirieRoutePlanner {
    async status() {
        const { body } = await request(`http${this.node.options.secure ? "s" : ""}://${this.node.options.url}/routeplanner/status`, {
            method: "POST",
            bodyTimeout: this.node.options.requestTimeout,
            headersTimeout: this.node.options.requestTimeout,
            headers: {
                Authorization: this.node.options.password,
                "Content-Type": "application/json",
            },
        });
        const json = await body.json();

        return json.class ? json : undefined;
    }

    async freeAddress(address) {
        const { statusCode } = await request(`http${this.node.options.secure ? "s" : ""}://${this.node.options.url}/routeplanner/status`, {
            method: "POST",
            bodyTimeout: this.node.options.requestTimeout,
            headersTimeout: this.node.options.requestTimeout,
            headers: {
                Authorization: this.node.options.password,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                address,
            }),
        });

        return statusCode === 204;
    }

    async freeAllAddress() {
        const { statusCode } = await request(`http${this.node.options.secure ? "s" : ""}://${this.node.options.url}/routeplanner/free/all`, {
            method: "POST",
            bodyTimeout: this.node.options.requestTimeout,
            headersTimeout: this.node.options.requestTimeout,
            headers: {
                Authorization: this.node.options.password,
                "Content-Type": "application/json",
            },
            body: undefined,
        });

        return statusCode === 204;
    }
}

module.exports = KirieRoutePlanner;
