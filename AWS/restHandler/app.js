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

const getLatestAttendee = async()=>{
    let attendees = []
    for await (const attendee of mapper.query(Attendee, {recordType: 'ATTENDEE'}, {scanIndexForward:false, limit:1})){
        attendees.push(attendee)
    }
    return attendees[0]
}

const getAttendances = async()=>{
    let attendances = []
    for await (const attendance of mapper.query(Attendance, {recordType: 'ATTENDANCE'}, {indexName: 'index', scanIndexForward:false, limit:3})){
        attendances.push(attendance)
    }
    return attendances
}

const getTimes = async()=>{
    let times = []
    for await (const attendee of mapper.query(Attendee, {recordType: 'ATTENDEE'}, {scanIndexForward:false, limit: 60})){
        times.unshift({name: attendee.name, from: attendee.identifier, reporter: attendee.reporter[0]})
        times[1] && (times[0].to = times[1].from)
    }
    times[times.length-1].to = (new Date()).getTime()
    return times
}

const getVisits = async()=>{
    let visits = []
    for await (const visit of mapper.query(Visit, {recordType: 'VISIT'}, {scanIndexForward:false, limit:10})){
        visits.push(visit)
    }
    return visits
}

router.get('/all', asyncHandler(async (req, res) => {
    Promise.all([getLatestAttendee(),getAttendances(),getTimes(),getVisits()])
    .then(res.json.bind(res))
}))

router.get('/attendees/latest', asyncHandler(async (req, res) => {
    getLatestAttendee().then(res.json.bind(res))
}))

router.get('/attendances', asyncHandler(async (req, res) => {
    getAttendances().then(res.json.bind(res))
}))


router.get('/times', asyncHandler(async (req, res) => {
    getTimes().then(res.json.bind(res))
}))

router.get('/visits', asyncHandler(async (req, res) => {
    getVisits().then(res.json.bind(res))
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
    visit.identifier = req.body.name || "Guest"
    visit.time = (new Date()).getTime()
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
            record: {type: 'Number'},
            longest: {type: 'Number'},
            shortest: {type: 'Number'}
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
            time: {type: 'String'},
            TTL: {type : 'Number'}
        },
    },
});