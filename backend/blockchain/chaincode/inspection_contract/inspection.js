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

    getInspectionIdFromIndexKey(ctx, key, expectedObjectType) {
        const parsedKey = ctx.stub.splitCompositeKey(key);
        if (parsedKey.objectType !== expectedObjectType || parsedKey.attributes.length < 2) {
            throw new Error(`Invalid ${expectedObjectType} index key: ${key}`);
        }
        return parsedKey.attributes[1];
    }

    getTxTimestamp(ctx) {
        const txTimestamp = ctx.stub.getTxTimestamp();
        return new Date(txTimestamp.seconds.low * 1000).toISOString();
    }

    getEventIdFromIndexKey(ctx, key, expectedObjectType) {
        const parsedKey = ctx.stub.splitCompositeKey(key);
        if (parsedKey.objectType !== expectedObjectType || parsedKey.attributes.length < 2) {
            throw new Error(`Invalid ${expectedObjectType} index key: ${key}`);
        }
        return parsedKey.attributes[1];
    }

    async recordProcurementEvent(ctx, eventId, eventType, entityId, actor, status, payloadJson) {
        const eventKey = ctx.stub.createCompositeKey('procurementEvent', [eventId]);
        const existing = await ctx.stub.getState(eventKey);

        if (existing && existing.length > 0) {
            const existingRecord = JSON.parse(existing.toString());
            if (existingRecord.locked || existingRecord.islocked) {
                throw new Error(`Procurement event ${eventId} is already recorded and locked. Cannot modify.`);
            }
        }

        let payload;
        try {
            payload = payloadJson ? JSON.parse(payloadJson) : {};
        } catch (e) {
            throw new Error(`Invalid payload JSON: ${e.message}`);
        }

        const timestamp = this.getTxTimestamp(ctx);
        const creatorMspId = ctx.clientIdentity.getMSPID();
        const eventRecord = {
            eventId,
            eventType,
            entityId,
            actor: actor || '',
            status: status || '',
            payload,
            timestamp,
            txId: ctx.stub.getTxID(),
            creatorMspId,
            locked: true,
            islocked: true,
            createdAt: timestamp,
            updatedAt: timestamp
        };

        await ctx.stub.putState(eventKey, Buffer.from(JSON.stringify(eventRecord)));

        const typeIndexKey = ctx.stub.createCompositeKey('eventType~event', [eventType, eventId]);
        await ctx.stub.putState(typeIndexKey, Buffer.from('\u0000'));

        const entityIndexKey = ctx.stub.createCompositeKey('entity~event', [entityId, eventId]);
        await ctx.stub.putState(entityIndexKey, Buffer.from('\u0000'));

        return eventRecord;
    }

    async recordPurchaseRequestSubmission(ctx, eventId, prNumber, actor, status, payloadJson) {
        return this.recordProcurementEvent(ctx, eventId, 'PURCHASE_REQUEST_SUBMITTED', prNumber, actor, status, payloadJson);
    }

    async recordPurchaseRequestApproval(ctx, eventId, prNumber, actor, status, payloadJson) {
        return this.recordProcurementEvent(ctx, eventId, 'PURCHASE_REQUEST_APPROVED', prNumber, actor, status, payloadJson);
    }

    async recordPurchaseOrderIssuance(ctx, eventId, poNumber, actor, status, payloadJson) {
        return this.recordProcurementEvent(ctx, eventId, 'PURCHASE_ORDER_ISSUED', poNumber, actor, status, payloadJson);
    }

    async recordDeliveryReceiving(ctx, eventId, receiptNumber, actor, status, payloadJson) {
        return this.recordProcurementEvent(ctx, eventId, 'DELIVERY_RECEIVING_CONFIRMED', receiptNumber, actor, status, payloadJson);
    }

    async recordPaymentCompletion(ctx, eventId, paymentNumber, actor, status, payloadJson) {
        return this.recordProcurementEvent(ctx, eventId, 'PAYMENT_COMPLETED', paymentNumber, actor, status, payloadJson);
    }

    async getProcurementEvent(ctx, eventId) {
        const eventKey = ctx.stub.createCompositeKey('procurementEvent', [eventId]);
        const eventBytes = await ctx.stub.getState(eventKey);
        if (!eventBytes || eventBytes.length === 0) {
            throw new Error(`Procurement event ${eventId} does not exist`);
        }
        return JSON.parse(eventBytes.toString());
    }

    async getAllProcurementEvents(ctx) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('procurementEvent', []);
        const results = [];

        let result = await iterator.next();
        while (!result.done) {
            const eventBytes = result.value.value;
            if (eventBytes && eventBytes.length > 0) {
                results.push(JSON.parse(eventBytes.toString()));
            }
            result = await iterator.next();
        }

        await iterator.close();
        return results.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    }

    async getProcurementEventsByType(ctx, eventType) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('eventType~event', [eventType]);
        const results = [];

        let result = await iterator.next();
        while (!result.done) {
            const eventId = this.getEventIdFromIndexKey(ctx, result.value.key, 'eventType~event');
            results.push(await this.getProcurementEvent(ctx, eventId));
            result = await iterator.next();
        }

        await iterator.close();
        return results.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    }

    async getProcurementEventsByEntity(ctx, entityId) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('entity~event', [entityId]);
        const results = [];

        let result = await iterator.next();
        while (!result.done) {
            const eventId = this.getEventIdFromIndexKey(ctx, result.value.key, 'entity~event');
            results.push(await this.getProcurementEvent(ctx, eventId));
            result = await iterator.next();
        }

        await iterator.close();
        return results.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    }

    async getProcurementEventHistory(ctx, eventId) {
        const eventKey = ctx.stub.createCompositeKey('procurementEvent', [eventId]);
        const iterator = await ctx.stub.getHistoryForKey(eventKey);
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
            results.push({
                txId: result.value.txId,
                timestamp: toIsoTimestamp(result.value.timestamp),
                isDelete: result.value.isDelete,
                value: result.value.isDelete ? null : JSON.parse(result.value.value.toString())
            });
            result = await iterator.next();
        }

        await iterator.close();
        return results;
    }

    async verifyProcurementEvent(ctx, eventId) {
        const event = await this.getProcurementEvent(ctx, eventId);
        const history = await this.getProcurementEventHistory(ctx, eventId);
        const isLocked = Boolean(event.locked || event.islocked);

        return {
            eventId,
            exists: true,
            locked: isLocked,
            islocked: isLocked,
            txId: event.txId,
            timestamp: event.timestamp,
            historyCount: history.length,
            isImmutable: history.length === 1 && isLocked,
            verification: isLocked && history.length === 1 ? 'PASS' : 'FAIL'
        };
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
        const timestamp = this.getTxTimestamp(ctx);
        
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
            const inspectionId = this.getInspectionIdFromIndexKey(ctx, result.value.key, 'po~inspection');
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
            const inspectionId = this.getInspectionIdFromIndexKey(ctx, result.value.key, 'inspector~inspection');
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
            const inspectionId = this.getInspectionIdFromIndexKey(ctx, result.value.key, 'status~inspection');
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
