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
router.get('/attendance', asyncHandler(async (req, res) => {
    let attendances = []
    for await (const attendance of mapper.query(Attendance, {recordType: 'ATTENDANCE'})){
        attendances.push(attendee)
    }
    res.json(attendances)
}))

router.post('/attendees', asyncHandler(async (req, res) => {
    let attendee = new Attendee();
    attendee.identifier = (new Date()).getTime()
    attendee.association = req.body.attendee.association
    attendee.reporter = req.body.reporter.name
    mapper.update(attendee,{onMissing: 'skip'}).then(res.json.bind(res))
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
            association: {type: 'String'},
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
            association: {type: 'String'},
            record: {type: 'Number'}
        },
    },
});