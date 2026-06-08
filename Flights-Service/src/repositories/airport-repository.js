const CrudRepository = require('./crud-repository.js');
const { airports } = require('../db/schema.js');

class AirportRepository extends CrudRepository {
    constructor(){
        super(airports);
    }
}

module.exports = AirportRepository;
