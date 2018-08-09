/**
 * simple Module with random helper-functions
 * @module
 */

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

const padLeft = function (input, character, length) {
    if (!`${character}` || !length) {
        return "wrong usage! (input, character, length)";
    }
    input = `${input}`;
    while (input.length < length) {
        input = character + input;
    }
    return input;
};

function isEqual(obj1, obj2) {
    if (Array.isArray(obj1) && Array.isArray(obj1)) {
        for (const arrayEntry1 of obj1) {
            for (const arrayEntry2 of obj2) {
                if (!isEqual(arrayEntry1, arrayEntry2)) {
                    return false;
                }
            }
        }
        return true;
    } else if (!obj1 && !obj2) { // both null-like
        return true;
    } else if (typeof obj1 === 'object' && typeof obj2 === 'object') {
        for (const field1 of Object.keys(obj1)) {
            if (!isEqual(obj1[field1], obj2[field1])) {
                return false;
            }
        }
        for (const field2 of Object.keys(obj2)) {
            if (!isEqual(obj1[field2], obj2[field2])) {
                return false;
            }
        }
        return true;
    } else if (typeof obj1 === typeof obj2) {
        return obj1 === obj2;
    } else {
        return obj1 === obj2;
    }
}

function deepContains(array, obj) {
    for (const entry of array) {
        if (isEqual(entry, obj))
            return true;
    }
    return false;
}

function arrayMinus(array1, array2) {
    const result = [];
    for (const entry1 of array1) {
        if (!deepContains(array2, entry1)) {
            result.push(entry1);
        }
    }
    return result;
}

function arrayIntersect(array1, array2) {
    const result = [];
    for (const entry1 of array1) {
        for (const entry2 of array2) {
            if (isEqual(entry1, entry2))
                result.push(entry1);
        }
    }
    return result;
}

/**
 * return the longest length of every string inside an array.
 * e.g. {
 *  a: 1,
 *  b: [22, 333],
 *  c: "4444"
 * } --> 4
 * @param input string
 * @returns {number} length of longest string
 */
function getLongestStringInObject(input) {
    if (typeof input === 'string')
        return input.length;

    if (Array.isArray(input))
        return Math.max(... input.map(it => getLongestStringInObject(it)));

    if(input !== Object(input))
        return getLongestStringInObject(`${input}`);

    return Math.max(... Object.keys(input).map(it => getLongestStringInObject(input[it])))
}


module.exports = {
    snooze,
    flattenArray,
    padLeft,
    arrayMinus,
    arrayIntersect,
    isEqual,
    getLongestStringInObject
};