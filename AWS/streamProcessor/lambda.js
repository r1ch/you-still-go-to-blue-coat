'use strict'
//AWS Setup
const AWS = require('aws-sdk');

//Dynamo Setup
const {
    DynamoDbSchema,
    DynamoDbTable,
    DataMapper
} = require('@aws/dynamodb-data-mapper');

const {
    lessThanOrEqualTo,
    UpdateExpression,
    MathematicalExpression,
    FunctionExpression,
    AttributePath
} = require('@aws/dynamodb-expressions')
const { v4 } = require('uuid');
const DynamoDB = require('aws-sdk/clients/dynamodb');

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





exports.handler = async (event, context) => {
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
        event.Records[0].dynamodb.NewImage.association &&
        event.Records[0].dynamodb.NewImage.association.S
    ){
        //extract
        let newAttendee = {
            time : event.Records[0].dynamodb.NewImage.identifier.S,
            association : event.Records[0].dynamodb.NewImage.association.S
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
        console.log(`Lastest attendee name = ${attendees[0].association}, New attendee name = ${newAttendee.association}`)
        console.log(`Previous attendee name = ${attendees[1].association}`)

        console.log(`So add ${attendees[0].identifier-attendees[1].identifier} to ${attendees[1].association} score`)

        //new total
        let attendance = new Attendance()
        attendance.identifier = attendees[1].association
        attendance.record = 0

        await mapper.put(attendance, {
            condition: new FunctionExpression('attribute_not_exists', new AttributePath('identifier') )
        })
        .then((either,or)=>{
            console.log(`E ${JSON.stringify(either)}`)
            console.log(`O ${JSON.stringify(or)}`)
            let updateExpression = new UpdateExpression
            await updateExpression.set('record', new MathematicalExpression('record','+',attendees[0].identifier-attendees[1].identifier))
            mapper.executeUpdateExpression(
                updateExpression,
                {recordType:"ATTENDANCE",identifier:attendees[1].association},
                Attendance
            )
            .catch(console.log)
        })

    } else {
        console.log(`IGNORE ${JSON.stringify(event)}`)
    }
}
