class Collection extends Map {
    get first() {
        return this.values().next().value;
    }

    get firstKey() {
        return this.keys().next().value;
    }

    get last() {
        const array = this.toArray();
        return array[array.length - 1];
    }

    get lastKey() {
        const array = this.KArray();
        // @ts-ignore: ifnore
        return array[array.length - 1][0];
    }

    getSome(amount, position) {
        const arr = this.toArray();
        if (position === "start") {
            return arr.slice(amount);
        }
        if (position === "end") {
            return arr.slice(-amount);
        }
        return undefined;
    }

    toArray() {
        return [...this.values()];
    }

    KArray() {
        return [...this.entries()];
    }

    map(func) {
        const mapIter = this.entries();
        return Array.from({ length: this.size }, () => {
            const [key, val] = mapIter.next().value;
            return func(val, key);
        });
    }
}
module.exports = Collection;
