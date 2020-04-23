'use strict'
//AWS Setup
const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient()

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
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const compression = require('compression')
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
router.get('/attendees/latest/:count', asyncHandler(async (req, res) => {
    let countParam = req.params.count
    countParam = isNaN(countParam) ? 1 : Math.max(6,countParam|0)
    let attendees = []
    for await (const attendee of mapper.query(Attendee, {recordType: 'ATTENDEE'}, {scanIndexForward:false, limit:countParam})){
        attendees.push(attendee)
    }
    res.json(attendees)
}))

router.post('/attendees', asyncHandler(async (req, res) => {
    let attendee = new Attendee();
    attendee.identifier = (new Date()).getTime()
    attendee.name = req.body.attendee.name
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