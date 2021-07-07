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

/**
 * Holder class for check entries
 * @class
 */
class CheckEntryHolder {
    /**
     * Get a Holder
     * @param name  {string}
     * @param passing {Array<BaseCheckEntry> | BaseCheckEntry}
     * @param failing {Array<BaseCheckEntry> | BaseCheckEntry}
     */
    constructor(name, passing = [], failing = []) {
        this.name = name;

        if (Array.isArray(passing)) {
            this.passing = passing;
        } else if (passing instanceof BaseCheckEntry) {
            this.passing = [passing];
        } else {
            throw new Error("passing has wrong type!");
        }

        if (Array.isArray(failing)) {
            this.failing = failing;
        } else if (failing instanceof BaseCheckEntry) {
            this.failing = [failing];
        } else {
            throw new Error("failing has wrong type");
        }

        this.addFailingEntry = this.addFailingEntry.bind(this);
        this.addPassingEntry = this.addPassingEntry.bind(this);
        this.success = this.success.bind(this);
    }

    addPassingEntry(entry) {
        if (entry instanceof BaseCheckEntry) {this.passing.push(entry);} else {throw new Error("WRONG TYPE")}
    }

    addFailingEntry(entry) {
        if (entry instanceof BaseCheckEntry) {this.failing.push(entry);} else {throw new Error("WRONG TYPE")}
    }

    success() {
        return this.failing.length === 0;
    }
}

module.exports = {
    LibraryCheckEntry,
    ServiceCheckEntry,
    CheckEntryHolder
};
