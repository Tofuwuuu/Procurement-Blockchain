/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');

/**
 * InspectionContract implements inspection record management on the blockchain
 * Records are immutable, timestamped, and replicated across all peers
 */
class InspectionContract extends Contract {

    /**
     * Initialize the ledger with sample inspections (called on chaincode instantiation)
     * @param {Context} ctx - The transaction context
     */
    async initLedger(ctx) {
        console.info('============= START : Initialize Ledger ===========');
        const inspections = [
            {
                id: 'INS001',
                supplierId: 'SUP001',
                itemName: 'Cement Bags',
                quantity: 500,
                unit: 'bags',
                inspectionDate: new Date().toISOString(),
                inspectionOfficer: 'Officer A',
                status: 'PASSED',
                remarks: 'All items meet quality standards',
                location: 'Warehouse A'
            }
        ];

        for (let i = 0; i < inspections.length; i++) {
            inspections[i].docType = 'inspection';
            await ctx.stub.putState(inspections[i].id, Buffer.from(JSON.stringify(inspections[i])));
            console.info('Added <--> ', inspections[i]);
        }
        console.info('============= END : Initialize Ledger ===========');
    }

    /**
     * Create a new inspection record on the blockchain
     * @param {Context} ctx - The transaction context
     * @param {string} inspectionId - Unique inspection identifier
     * @param {string} supplierId - Supplier ID
     * @param {string} itemName - Name of item being inspected
     * @param {number} quantity - Quantity inspected
     * @param {string} unit - Unit of measurement
     * @param {string} inspectionOfficer - Officer conducting inspection
     * @param {string} status - Initial status (PENDING, PASSED, FAILED)
     * @param {string} remarks - Initial remarks
     * @param {string} location - Inspection location
     */
    async createInspection(ctx, inspectionId, supplierId, itemName, quantity, unit, inspectionOfficer, status, remarks, location) {
        console.info('============= START : Create Inspection ===========');

        // Check if inspection already exists
        const existingInspection = await ctx.stub.getState(inspectionId);
        if (existingInspection && existingInspection.length > 0) {
            throw new Error(`Inspection ${inspectionId} already exists`);
        }

        // Create inspection object with blockchain timestamp
        const inspection = {
            docType: 'inspection',
            id: inspectionId,
            supplierId: supplierId,
            itemName: itemName,
            quantity: parseInt(quantity),
            unit: unit,
            inspectionDate: new Date().toISOString(),
            inspectionOfficer: inspectionOfficer,
            status: status,
            remarks: remarks,
            location: location,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Store on blockchain - immutable and replicated across all peers
        await ctx.stub.putState(inspectionId, Buffer.from(JSON.stringify(inspection)));
        console.info('============= END : Create Inspection ===========');

        return JSON.stringify(inspection);
    }

    /**
     * Update inspection status and remarks
     * Creates a new immutable record of the change
     * @param {Context} ctx - The transaction context
     * @param {string} inspectionId - Inspection ID to update
     * @param {string} newStatus - New status value
     * @param {string} remarks - Updated remarks
     * @param {string} updatedBy - Officer updating the record
     */
    async updateInspectionStatus(ctx, inspectionId, newStatus, remarks, updatedBy) {
        console.info('============= START : Update Inspection Status ===========');

        // Retrieve current inspection
        const inspectionAsBytes = await ctx.stub.getState(inspectionId);
        if (!inspectionAsBytes || inspectionAsBytes.length === 0) {
            throw new Error(`Inspection ${inspectionId} does not exist`);
        }

        const inspection = JSON.parse(inspectionAsBytes.toString());
        
        // Update fields with new values
        inspection.status = newStatus;
        inspection.remarks = remarks;
        inspection.updatedAt = new Date().toISOString();
        inspection.lastUpdatedBy = updatedBy;

        // Store updated record - creates new version in ledger history
        await ctx.stub.putState(inspectionId, Buffer.from(JSON.stringify(inspection)));
        console.info('============= END : Update Inspection Status ===========');

        return JSON.stringify(inspection);
    }

    /**
     * Get a single inspection record by ID
     * @param {Context} ctx - The transaction context
     * @param {string} inspectionId - Inspection ID to retrieve
     */
    async getInspection(ctx, inspectionId) {
        console.info('============= START : Get Inspection ===========');

        const inspectionAsBytes = await ctx.stub.getState(inspectionId);
        if (!inspectionAsBytes || inspectionAsBytes.length === 0) {
            throw new Error(`Inspection ${inspectionId} does not exist`);
        }

        console.info('============= END : Get Inspection ===========');
        return inspectionAsBytes.toString();
    }

    /**
     * Get complete history of an inspection (audit trail)
     * Shows all changes with timestamps - immutable proof of modifications
     * @param {Context} ctx - The transaction context
     * @param {string} inspectionId - Inspection ID
     */
    async getInspectionHistory(ctx, inspectionId) {
        console.info('============= START : Get Inspection History ===========');

        const historyIterator = await ctx.stub.getHistoryForKey(inspectionId);
        const history = [];
        let result = await historyIterator.next();

        while (!result.done) {
            if (result.value) {
                const record = {
                    timestamp: result.value.getTimestamp(),
                    value: JSON.parse(result.value.getValue().toString())
                };
                history.push(record);
            }
            result = await historyIterator.next();
        }

        await historyIterator.close();
        console.info('============= END : Get Inspection History ===========');

        return JSON.stringify(history);
    }

    /**
     * Query inspections by status
     * @param {Context} ctx - The transaction context
     * @param {string} status - Status to filter by (PENDING, PASSED, FAILED)
     */
    async queryByStatus(ctx, status) {
        console.info('============= START : Query By Status ===========');

        const queryString = {
            selector: {
                docType: 'inspection',
                status: status
            }
        };

        const queryResults = await this.queryWithQueryString(ctx, JSON.stringify(queryString));
        console.info('============= END : Query By Status ===========');

        return queryResults;
    }

    /**
     * Query inspections by supplier ID
     * @param {Context} ctx - The transaction context
     * @param {string} supplierId - Supplier ID to filter by
     */
    async queryBySupplier(ctx, supplierId) {
        console.info('============= START : Query By Supplier ===========');

        const queryString = {
            selector: {
                docType: 'inspection',
                supplierId: supplierId
            }
        };

        const queryResults = await this.queryWithQueryString(ctx, JSON.stringify(queryString));
        console.info('============= END : Query By Supplier ===========');

        return queryResults;
    }

    /**
     * Query all inspections within a date range
     * @param {Context} ctx - The transaction context
     * @param {string} startDate - Start date (ISO format)
     * @param {string} endDate - End date (ISO format)
     */
    async queryByDateRange(ctx, startDate, endDate) {
        console.info('============= START : Query By Date Range ===========');

        const queryString = {
            selector: {
                docType: 'inspection',
                inspectionDate: {
                    $gte: startDate,
                    $lte: endDate
                }
            }
        };

        const queryResults = await this.queryWithQueryString(ctx, JSON.stringify(queryString));
        console.info('============= END : Query By Date Range ===========');

        return queryResults;
    }

    /**
     * Get all inspection records
     * @param {Context} ctx - The transaction context
     */
    async getAllInspections(ctx) {
        console.info('============= START : Get All Inspections ===========');

        const queryString = {
            selector: {
                docType: 'inspection'
            }
        };

        const queryResults = await this.queryWithQueryString(ctx, JSON.stringify(queryString));
        console.info('============= END : Get All Inspections ===========');

        return queryResults;
    }

    /**
     * Helper function to execute rich queries using CouchDB selector
     * @param {Context} ctx - The transaction context
     * @param {string} queryString - Query string in JSON format
     */
    async queryWithQueryString(ctx, queryString) {
        console.info('query queryString:', queryString);

        const resultsIterator = await ctx.stub.getQueryResultsIterator(queryString);
        const results = [];

        let result = await resultsIterator.next();
        while (!result.done) {
            if (result.value) {
                const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
                let record;
                try {
                    record = JSON.parse(strValue);
                } catch (err) {
                    console.log(err);
                    record = strValue;
                }
                results.push({
                    Key: result.value.key,
                    Record: record
                });
            }
            result = await resultsIterator.next();
        }

        await resultsIterator.close();
        return JSON.stringify(results);
    }

    /**
     * Verify inspection integrity (check if record has been tampered with)
     * Returns the complete history to prove immutability
     * @param {Context} ctx - The transaction context
     * @param {string} inspectionId - Inspection ID to verify
     */
    async verifyInspectionIntegrity(ctx, inspectionId) {
        console.info('============= START : Verify Inspection Integrity ===========');

        const currentInspection = await ctx.stub.getState(inspectionId);
        if (!currentInspection || currentInspection.length === 0) {
            throw new Error(`Inspection ${inspectionId} does not exist`);
        }

        // Get complete history
        const historyIterator = await ctx.stub.getHistoryForKey(inspectionId);
        const history = [];
        let result = await historyIterator.next();

        while (!result.done) {
            if (result.value) {
                history.push({
                    timestamp: result.value.getTimestamp(),
                    txId: result.value.getTxId(),
                    isDelete: result.value.isDelete,
                    value: JSON.parse(result.value.getValue().toString())
                });
            }
            result = await historyIterator.next();
        }

        await historyIterator.close();

        const verification = {
            inspectionId: inspectionId,
            current: JSON.parse(currentInspection.toString()),
            historyCount: history.length,
            isValid: history.length > 0,
            history: history
        };

        console.info('============= END : Verify Inspection Integrity ===========');
        return JSON.stringify(verification);
    }
}

module.exports = InspectionContract;
