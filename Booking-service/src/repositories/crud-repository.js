/*
 * CrudRepository
 *
 * Generic base class that provides standard CRUD operations for any Sequelize model.
 * All model-specific repositories extend this class and pass their model in the constructor.
 *
 * Methods provided (no transaction support — for transactional queries, override in subclass):
 *   create(data)        — INSERT a new row
 *   destroy(id)         — DELETE a row by primary key
 *   get(id)             — SELECT a single row by primary key
 *   getAll()            — SELECT all rows
 *   update(data, id)    — UPDATE a row by primary key
 *
 * Why a base class:
 *  - Avoids repeating the same findByPk / create / destroy logic across every repository
 *  - Model-specific repositories only override methods where they need custom behaviour
 *    (e.g. transaction support, custom queries, eager loading)
 */

const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const db = require('../db');
const { eq } = require('drizzle-orm');

class CrudRepository {
    constructor(table) {
        this.table = table;
    }

    async create(data, tx = db) {
        const [response] = await tx.insert(this.table).values(data).returning();
        return response;
    }

    async destroy(id, tx = db) {
        const response = await tx.delete(this.table).where(eq(this.table.id, id)).returning();
        if (response.length === 0) {
            throw new AppError('Not able to find the resource', StatusCodes.NOT_FOUND);
        }
        return response.length;
    }

    async get(id, tx = db) {
        const response = await tx.select().from(this.table).where(eq(this.table.id, id));
        if (response.length === 0) {
            throw new AppError('Not able to find a resource', StatusCodes.NOT_FOUND);
        }
        return response[0];
    }

    async getAll(tx = db) {
        const response = await tx.select().from(this.table);
        return response;
    }

    async update(data, id, tx = db) {
        const response = await tx.update(this.table).set(data).where(eq(this.table.id, id)).returning();
        if (response.length === 0) {
            throw new AppError('Resource to be updated not found', StatusCodes.NOT_FOUND);
        }
        return [response.length]; // Keeping the array format [affectedRows]
    }
}

module.exports = CrudRepository;
