/**
 * fake Thread.sleep in js (needs async-await)
 * @param ms
 * @returns {Promise<any>}
 */
const snooze = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * deep flattening of nested arrays
 * e.g. [[1],[2], [[3],[4]]] => [1, 2, 3, 4]
 * @param array of arrays
 * @returns flatten array
 */
const flattenArray = function (array) {
    return array.reduce(function (flat, toFlatten) {
        return flat.concat(Array.isArray(toFlatten) ? flattenArray(toFlatten) : toFlatten);
    }, []);
};

module.exports = {
    snooze: snooze,
    flattenArray: flattenArray
};