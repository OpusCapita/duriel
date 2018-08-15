/**
 * Class with base-functions for check-entries
 * @class
 */
class BaseCheckEntry {
    constructor() {
        this.getDataFields = this.getDataFields.bind(this);
        this.asDataRow = this.asDataRow.bind(this);
        this.getDataHeader = this.getDataHeader.bind(this);
    }

    /**
     * returns the names of all fields that are not a function.
     * @returns {string[]}
     */
    getDataFields() {
        return Object.keys(this).filter(key => typeof this[key] !== "function");
    }

    /**
     * returns all non-function field-values
     * @returns {string[]}
     */
    asDataRow() {
        return this.getDataFields().map(key => this[key])
    }

    /**
     * returns all non-function field-names
     * @returns {string[]}
     */
    getDataHeader() {
        return this.getDataFields()
    }
}

/**
 * Simple holder of check information
 * @extends BaseCheckEntry
 * @class
 */
class ServiceCheckEntry extends BaseCheckEntry {
    /**
     * Get a resultEntry
     * @param service
     * @param expected
     * @param deployed
     */
    constructor(service, expected, deployed, origin) {
        super();
        this.service = service;
        this.expected = expected;
        this.deployed = deployed;
        this.origin = origin;
    }
}

/**
 * Simple holder of library check information
 * @extends BaseCheckEntry
 * @class
 */
class LibraryCheckEntry extends BaseCheckEntry {
    /**
     * Get an entry
     * @param library
     * @param expected
     * @param installed
     * @param service
     * @param reason
     */
    constructor(library, expected, installed = '-', service, reason) {
        super();
        this.library = library;
        this.expected = expected;
        this.installed = installed;
        this.service = service;
        this.reason = reason;
    }
}

module.exports = {
    LibraryCheckEntry,
    ServiceCheckEntry
}