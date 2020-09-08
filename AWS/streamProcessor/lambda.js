'use strict'
//AWS Setup
const AWS = require('aws-sdk');
const https = require('https');

//Dynamo Setup
const {
    DynamoDbSchema,
    DynamoDbTable,
    DataMapper
} = require('@aws/dynamodb-data-mapper');

const {
    lessThan,
    greaterThan,
    lessThanOrEqualTo,
    AttributePath,
    UpdateExpression,
} = require('@aws/dynamodb-expressions')
const { v4 } = require('uuid');
const DynamoDB = require('aws-sdk/clients/dynamodb');
const { runInNewContext } = require('vm');

const client = new DynamoDB({region: 'eu-west-1'});
const mapper = new DataMapper({client});


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

//Git handler
const trigger = (eventType) => new Promise((resolve,reject)=>{
    const req = https.request(
        {
            protocol : 'https',
            hostname : 'api.github.com',
            port : 443, 
            path: '/repos/r1ch/you-still-go-to-blue-coat/dispatches',
            headers : {
                'Authorization' : process.env['GITHUB_TOKEN'] || 'no_token'
            }
        }, console.log)
        .on("error",err=>reject(err));
    req.write(`{"event_type" : ${eventType} }`)
    resolve(req.end())
})


exports.handler = async (event, context) => {
    //tell git the record type
    if(
        event.Records &&
        event.Records[0] &&
        event.Records[0].dynamodb &&
        event.Records[0].dynamodb.NewImage && 
        event.Records[0].dynamodb.NewImage.recordType &&
        event.Records[0].dynamodb.NewImage.recordType.S
    ){ 
        let resp = await trigger(event.Records[0].dynamodb.NewImage.recordType.S);
        console.log(resp)
    }

    //am I interested?
    if(
        event.Records &&
        event.Records[0] &&
        event.Records[0].eventName &&
        event.Records[0].eventName == "INSERT" &&
        event.Records[0].dynamodb &&
        event.Records[0].dynamodb.NewImage && 
        event.Records[0].dynamodb.NewImage.recordType &&
        event.Records[0].dynamodb.NewImage.recordType.S &&
        event.Records[0].dynamodb.NewImage.recordType.S == "ATTENDEE" &&
        event.Records[0].dynamodb.NewImage.identifier &&
        event.Records[0].dynamodb.NewImage.identifier.S &&
        event.Records[0].dynamodb.NewImage.name
    ){
        //extract
        let newAttendee = {
            time : event.Records[0].dynamodb.NewImage.identifier.S,
            name : event.Records[0].dynamodb.NewImage.name.S || ""
        }
        //get the last in attendee
        let attendees = [];
        for await (const attendee of mapper.query(
                Attendee, 
                {recordType: 'ATTENDEE', identifier: lessThanOrEqualTo(newAttendee.time)},
                {scanIndexForward:false, limit:2}
            )
        ){
            attendees.push(attendee)
        }
        //checks
        console.log(JSON.stringify(attendees))
        console.log(`Lastest attendee name = ${attendees[0].name}, New attendee name = ${newAttendee.name}`)
        console.log(`Previous attendee name = ${attendees[1].name}`)
        console.log(`So add ${attendees[0].identifier-attendees[1].identifier} to ${attendees[1].name} score`)

        let delta = attendees[0].identifier-attendees[1].identifier

        
        let attendanceUpdateExpression = new UpdateExpression
        attendanceUpdateExpression.add('record', delta)
        await mapper.executeUpdateExpression(
            attendanceUpdateExpression,
            {recordType:"ATTENDANCE",identifier:attendees[1].name},
            Attendance
        )
        .then(console.log)
        .catch(console.log)

        let shortestStintUpdateExpression = new UpdateExpression
        shortestStintUpdateExpression.set('shortest', delta)
        let longestStintUpdateExpression = new UpdateExpression
        longestStintUpdateExpression.set('longest', delta)


        await mapper.executeUpdateExpression(
            shortestStintUpdateExpression,
            {recordType:"ATTENDANCE",identifier:attendees[1].name},
            Attendance,
            {
                condition: {
                    ... greaterThan(delta),
                    subject: 'shortest',
                }
            }
        )
        .then(console.log)
        .catch(err=>{
            if(err.code=="ConditionalCheckFailedException"){
                console.log("Not a new shortest record!")
            } else {
                console.log(err)
            }
        })

        await mapper.executeUpdateExpression(
            longestStintUpdateExpression,
            {recordType:"ATTENDANCE",identifier:attendees[1].name},
            Attendance,
            { 
                condition: {
                    ... lessThan(delta),
                    subject: 'longest',
                }
            }
        )
        .then(console.log)
        .catch(err=>{
            if(err.code=="ConditionalCheckFailedException"){
                console.log("Not a new longest record!")
            } else {
                console.log(err)
            }
        })


    } else {
        console.log(`IGNORE ${JSON.stringify(event)}`)
    }
}
