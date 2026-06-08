const CrudRepository = require('./crud-repository.js');
const { cities } = require('../db/schema.js');

class CityRepository extends CrudRepository {
    constructor(){
        super(cities);
    }
}

module.exports = CityRepository;
