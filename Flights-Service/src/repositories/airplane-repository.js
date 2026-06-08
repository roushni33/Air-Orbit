const CrudRepository = require('./crud-repository.js');
const { airplanes } = require('../db/schema.js');

class AirplaneRepository extends CrudRepository {
    constructor(){
        super(airplanes);
    }
}

module.exports = AirplaneRepository;
