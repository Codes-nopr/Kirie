function check(whatTo, type, msg) {
    // eslint-disable-next-line valid-typeof
    if (typeof whatTo !== type) throw new TypeError(msg);
}

module.exports = check;
