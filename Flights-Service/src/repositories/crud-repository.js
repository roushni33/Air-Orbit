const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const db = require('../db');
const { eq } = require('drizzle-orm');

class CrudRepository {
    constructor(table) {
        this.table = table;
    }

    /**
     * Inserts a new row into the database table mapped to this model.
     *
     * @param {Object} data - Column values for the new record.
     * @returns {Promise<Model>} The newly created Sequelize model instance.
     */
    async create(data, tx = db) {
        const [response] = await tx.insert(this.table).values(data).returning();
        return response;
    }

    /**
     * Deletes the record with the given primary key from the database.
     * Throws NOT_FOUND if no matching record exists.
     *
     * @param {number} data - Primary key (id) of the record to delete.
     * @returns {Promise<number>} Number of rows deleted (1 on success).
     */
    async destroy(id, tx = db) {
        const response = await tx.delete(this.table).where(eq(this.table.id, id)).returning();
        if (response.length === 0) {
            throw new AppError('Not able to find the resource', StatusCodes.NOT_FOUND);
        }
        return response.length;
    }

    /**
     * Fetches a single record by its primary key.
     * Throws NOT_FOUND if no matching record exists.
     *
     * @param {number} data - Primary key (id) of the record to fetch.
     * @returns {Promise<Model>} The found Sequelize model instance.
     */
    async get(id, tx = db) {
        const response = await tx.select().from(this.table).where(eq(this.table.id, id));
        if (response.length === 0) {
            throw new AppError('Not able to find a resource', StatusCodes.NOT_FOUND);
        }
        return response[0];
    }

    /**
     * Fetches all records from the database table mapped to this model.
     *
     * @returns {Promise<Model[]>} Array of all Sequelize model instances.
     */
    async getAll(tx = db) {
        const response = await tx.select().from(this.table);
        return response;
    }

    /**
     * Updates columns on the record matching the given id.
     * Throws NOT_FOUND if no rows were affected (i.e., id does not exist).
     *
     * @param {Object} data - Key-value pairs of columns to update.
     * @param {number} id   - Primary key of the record to update.
     * @returns {Promise<Array>} Sequelize update result array [affectedRowCount].
     */
    async update(data, id, tx = db) {
        const response = await tx.update(this.table).set(data).where(eq(this.table.id, id)).returning();
        if (response.length === 0) {
            throw new AppError('Resource to be updated not found', StatusCodes.NOT_FOUND);
        }
        return [response.length];
    }
}

module.exports = CrudRepository;