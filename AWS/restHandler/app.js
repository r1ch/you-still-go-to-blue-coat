'use strict'
//AWS Setup
const AWS = require('aws-sdk');

//Dynamo Setup
const {
    DynamoDbSchema,
    DynamoDbTable,
    DataMapper
} = require('@aws/dynamodb-data-mapper');
const { v4 } = require('uuid');
const DynamoDB = require('aws-sdk/clients/dynamodb');

const client = new DynamoDB({region: 'eu-west-1'});
const mapper = new DataMapper({client});

//Express Setup
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
const app = express()
const router = express.Router()
const asyncHandler = require('express-async-handler')


router.use(cors())
router.use(bodyParser.json())
router.use(bodyParser.urlencoded({ extended: true }))
router.use(awsServerlessExpressMiddleware.eventContext())


//Get the latest attendee
router.get('/attendees/latest', asyncHandler(async (req, res) => {
    let attendees = []
    for await (const attendee of mapper.query(Attendee, {recordType: 'ATTENDEE'}, {scanIndexForward:false, limit:1})){
        attendees.push(attendee)
    }
    res.json(attendees[0])
}))


//Get the recent attendees
router.get('/attendances', asyncHandler(async (req, res) => {
    let attendances = []
    for await (const attendance of mapper.query(Attendance, {recordType: 'ATTENDANCE'}, {indexName: 'index', scanIndexForward:false, limit:5})){
        attendances.push(attendance)
    }
    res.json(attendances)
}))

router.post('/attendees', asyncHandler(async (req, res) => {
    let attendee = new Attendee();
    attendee.identifier = (new Date()).getTime()
    attendee.name = req.body.attendee.name
    attendee.reporter = req.body.reporter.name
    mapper.update(attendee,{onMissing: 'skip'}).then(res.json.bind(res))
}))

router.post('/visits', asyncHandler(async (req, res) => {
    let visit = new Visit();
    visit.identifier = (new Date()).getTime()
    visit.name = req.body.name
    mapper.update(visit,{onMissing: 'skip'}).then(res.json.bind(res))
}))

app.use('/', router)

module.exports = app


class Attendee {
    constructor(){
        this.recordType = "ATTENDEE";
    }
}

class Attendance {
    constructor(){
        this.recordType = "ATTENDANCE";
    }
}

class Visit {
    constructor(){
        this.recordType = "VISIT";
        this.TTL = (new Date()).getTime()/1000 + 10*24*60*60
    }
}


Object.defineProperties(Attendee.prototype, {
    [DynamoDbTable]: {
        value: 'bluecoat'
    },
    [DynamoDbSchema]: {
        value: {
            recordType: {
                type: 'String',
                keyType: 'HASH',
                defaultProvider: ()=>"ATTENDEE",
            },
            identifier: {
	              type: 'String',
                  keyType: 'RANGE',
                  defaultProvider: v4
            },
            name: {type: 'String'},
            reporter: {type: 'String'}
        },
    },
});

Object.defineProperties(Attendance.prototype, {
    [DynamoDbTable]: {
        value: 'bluecoat'
    },
    [DynamoDbSchema]: {
        value: {
            recordType: {
                type: 'String',
                keyType: 'HASH',
                defaultProvider: ()=>"ATTENDANCE",
            },
            identifier: {
	              type: 'String',
                  keyType: 'RANGE',
                  defaultProvider: v4
            },
            record: {type: 'Number'}
        },
    },
});

Object.defineProperties(Visit.prototype, {
    [DynamoDbTable]: {
        value: 'bluecoat'
    },
    [DynamoDbSchema]: {
        value: {
            recordType: {
                type: 'String',
                keyType: 'HASH',
                defaultProvider: ()=>"VISIT",
            },
            identifier: {
	              type: 'String',
                  keyType: 'RANGE',
                  defaultProvider: v4
            },
            name: {type: 'String'},
            TTL: {type : 'Number'}
        },
    },
});