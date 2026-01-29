'use strict';

const { Contract } = require('fabric-contract-api');

/**
 * Inspection Contract for recording and locking inspection results
 */
class InspectionContract extends Contract {
    
    constructor() {
        super('InspectionContract');
    }

    /**
     * Initialize the contract
     */
    async instantiate(ctx) {
        console.info('InspectionContract instantiated');
    }

    /**
     * Record an inspection result
     * This creates a new inspection record with timestamp and locks it
     * 
     * @param {Context} ctx - The transaction context
     * @param {String} inspectionId - Unique inspection ID (e.g., PO number)
     * @param {String} poNumber - Purchase Order/Request number
     * @param {String} inspectionDate - Inspection date (ISO format)
     * @param {String} inspectedBy - Name of inspector
     * @param {String} status - Inspection status (Accepted/Partial/Rejected)
     * @param {String} itemsJson - JSON string of inspection items
     * @param {String} overallRemarks - Overall inspection remarks
     * @returns {Object} The created inspection record
     */
    async recordInspection(ctx, inspectionId, poNumber, inspectionDate, inspectedBy, status, itemsJson, overallRemarks) {
        // Check if inspection already exists (locked)
        const inspectionKey = ctx.stub.createCompositeKey('inspection', [inspectionId]);
        const existing = await ctx.stub.getState(inspectionKey);
        
        if (existing && existing.length > 0) {
            const existingRecord = JSON.parse(existing.toString());
            const alreadyLocked = Boolean(existingRecord.locked || existingRecord.islocked);
            if (alreadyLocked) {
                throw new Error(`Inspection ${inspectionId} is already recorded and locked. Cannot modify.`);
            }
        }

        // Get transaction timestamp
        const txTimestamp = ctx.stub.getTxTimestamp();
        const timestamp = new Date(txTimestamp.seconds.low * 1000).toISOString();
        
        // Get transaction creator MSP (for auditability)
        // `stub.getMspId()` is not available in Fabric Node chaincode API;
        // use clientIdentity instead.
        const creatorMspId = ctx.clientIdentity.getMSPID();
        
        // Parse items
        let items;
        try {
            items = JSON.parse(itemsJson);
        } catch (e) {
            throw new Error(`Invalid items JSON: ${e.message}`);
        }

        // Create inspection record
        const inspectionRecord = {
            inspectionId: inspectionId,
            poNumber: poNumber,
            inspectionDate: inspectionDate,
            inspectedBy: inspectedBy,
            status: status,
            items: items,
            overallRemarks: overallRemarks || '',
            timestamp: timestamp,
            txId: ctx.stub.getTxID(),
            creatorMspId: creatorMspId,
            locked: true,  // Back-compat
            islocked: true, // Matches API/UI field name
            createdAt: timestamp,
            updatedAt: timestamp
        };

        // Store in world state
        await ctx.stub.putState(inspectionKey, Buffer.from(JSON.stringify(inspectionRecord)));

        // Create index for querying by PO number
        const poIndexKey = ctx.stub.createCompositeKey('po~inspection', [poNumber, inspectionId]);
        await ctx.stub.putState(poIndexKey, Buffer.from('\u0000'));

        // Create index for querying by inspector
        const inspectorIndexKey = ctx.stub.createCompositeKey('inspector~inspection', [inspectedBy, inspectionId]);
        await ctx.stub.putState(inspectorIndexKey, Buffer.from('\u0000'));

        // Create index for querying by status
        const statusIndexKey = ctx.stub.createCompositeKey('status~inspection', [status, inspectionId]);
        await ctx.stub.putState(statusIndexKey, Buffer.from('\u0000'));

        console.info(`Inspection ${inspectionId} recorded and locked at ${timestamp}`);
        return inspectionRecord;
    }

    /**
     * Get inspection record by ID
     * 
     * @param {Context} ctx - The transaction context
     * @param {String} inspectionId - Inspection ID
     * @returns {Object} The inspection record
     */
    async getInspection(ctx, inspectionId) {
        const inspectionKey = ctx.stub.createCompositeKey('inspection', [inspectionId]);
        const inspectionBytes = await ctx.stub.getState(inspectionKey);
        
        if (!inspectionBytes || inspectionBytes.length === 0) {
            throw new Error(`Inspection ${inspectionId} does not exist`);
        }

        return JSON.parse(inspectionBytes.toString());
    }

    /**
     * Get inspection by PO number
     * 
     * @param {Context} ctx - The transaction context
     * @param {String} poNumber - Purchase Order number
     * @returns {Object} The inspection record
     */
    async getInspectionByPO(ctx, poNumber) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('po~inspection', [poNumber]);
        const results = [];
        
        let result = await iterator.next();
        while (!result.done) {
            const inspectionId = result.value.key.split('\u0000')[1];
            const inspection = await this.getInspection(ctx, inspectionId);
            results.push(inspection);
            result = await iterator.next();
        }
        
        await iterator.close();
        return results;
    }

    /**
     * Query all inspections
     * 
     * @param {Context} ctx - The transaction context
     * @returns {Array} Array of all inspection records
     */
    async getAllInspections(ctx) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('inspection', []);
        const results = [];
        
        let result = await iterator.next();
        while (!result.done) {
            const inspectionBytes = result.value.value;
            if (inspectionBytes && inspectionBytes.length > 0) {
                results.push(JSON.parse(inspectionBytes.toString()));
            }
            result = await iterator.next();
        }
        
        await iterator.close();
        return results;
    }

    /**
     * Query inspections by inspector
     * 
     * @param {Context} ctx - The transaction context
     * @param {String} inspectorName - Name of inspector
     * @returns {Array} Array of inspection records
     */
    async getInspectionsByInspector(ctx, inspectorName) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('inspector~inspection', [inspectorName]);
        const results = [];
        
        let result = await iterator.next();
        while (!result.done) {
            const inspectionId = result.value.key.split('\u0000')[1];
            const inspection = await this.getInspection(ctx, inspectionId);
            results.push(inspection);
            result = await iterator.next();
        }
        
        await iterator.close();
        return results;
    }

    /**
     * Query inspections by status
     * 
     * @param {Context} ctx - The transaction context
     * @param {String} status - Inspection status
     * @returns {Array} Array of inspection records
     */
    async getInspectionsByStatus(ctx, status) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('status~inspection', [status]);
        const results = [];
        
        let result = await iterator.next();
        while (!result.done) {
            const inspectionId = result.value.key.split('\u0000')[1];
            const inspection = await this.getInspection(ctx, inspectionId);
            results.push(inspection);
            result = await iterator.next();
        }
        
        await iterator.close();
        return results;
    }

    /**
     * Get inspection history (audit trail)
     * 
     * @param {Context} ctx - The transaction context
     * @param {String} inspectionId - Inspection ID
     * @returns {Array} History of the inspection record
     */
    async getInspectionHistory(ctx, inspectionId) {
        const inspectionKey = ctx.stub.createCompositeKey('inspection', [inspectionId]);
        const iterator = await ctx.stub.getHistoryForKey(inspectionKey);
        const results = [];

        const toIsoTimestamp = (ts) => {
            if (!ts || !ts.seconds) return null;
            let seconds = ts.seconds;
            if (typeof seconds === 'object' && seconds !== null && typeof seconds.low === 'number') {
                seconds = seconds.low;
            } else if (typeof seconds === 'string') {
                seconds = parseInt(seconds, 10);
            }
            if (typeof seconds !== 'number' || Number.isNaN(seconds)) return null;
            return new Date(seconds * 1000).toISOString();
        };
        
        let result = await iterator.next();
        while (!result.done) {
            const historyItem = {
                txId: result.value.txId,
                timestamp: toIsoTimestamp(result.value.timestamp),
                isDelete: result.value.isDelete,
                value: result.value.isDelete ? null : JSON.parse(result.value.value.toString())
            };
            results.push(historyItem);
            result = await iterator.next();
        }
        
        await iterator.close();
        return results;
    }

    /**
     * Verify inspection record integrity (check if locked and unmodified)
     * 
     * @param {Context} ctx - The transaction context
     * @param {String} inspectionId - Inspection ID
     * @returns {Object} Verification result
     */
    async verifyInspection(ctx, inspectionId) {
        const inspection = await this.getInspection(ctx, inspectionId);
        const history = await this.getInspectionHistory(ctx, inspectionId);
        const isLocked = Boolean(inspection.locked || inspection.islocked);
        
        return {
            inspectionId: inspectionId,
            exists: true,
            locked: isLocked,
            islocked: isLocked,
            txId: inspection.txId,
            timestamp: inspection.timestamp,
            historyCount: history.length,
            isImmutable: history.length === 1 && isLocked,
            verification: isLocked && history.length === 1 ? 'PASS' : 'FAIL'
        };
    }
}

module.exports = InspectionContract;
