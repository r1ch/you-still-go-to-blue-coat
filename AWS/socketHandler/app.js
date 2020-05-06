const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
const apigwManagementApi = new AWS.ApiGatewayManagementApi({endpoint: process.env.ENDPOINT});
console.log(`Configured to send from ${process.env.ENDPOINT}`)

exports.handler = async event => {
 console.log(JSON.stringify(event))

 let route = {
   key:"error"
 }

 if(
     event &&
     event.requestContext &&
     event.requestContext.routeKey
    ){
   route.key = event.requestContext.routeKey
   route.connection = event.requestContext.connectionId
 } else if (
     event &&
     event.Records &&
     event.Records[0] &&
     event.Records[0].dynamodb &&
     event.Records[0].dynamodb.Keys &&
     event.Records[0].dynamodb.Keys.recordType &&
     event.Records[0].dynamodb.Keys.recordType.S &&
     ["ATTENDEE","ATTENDANCE","VISIT"].includes(event.Records[0].dynamodb.Keys.recordType.S)
     ){
    route.key = 'broadcast'
    route.data = JSON.stringify({eventType: event.Records[0].dynamodb.Keys.recordType.S})
 }

console.log(`After initial with ${JSON.stringify(route)}`)

 switch(route.key){
   case '$connect':
     return await ddb.put(connect(route.connection)).promise()
     .then(success("Connected"))
     .catch(error("Connection Error"))
   case '$disconnect':
      return await ddb.delete(disconnect(route.connection)).promise()
      .then(success("Disconnected"))
      .catch(error("Disconnection Error"))
   case 'ping':
      return await sendToConnection(route.connection,JSON.stringify({eventType:'pong'}))
      .then(success("Ping Pong"))
      .catch(error("Ping Pong error"))
   case 'broadcast':
      return await ddb.query(connections()).promise()
      .then(sendToConnections(route.data))
      .then(success("Sent to all"))
      .catch(error)
   default:
       console.log("Ignoring")
 }
};

const sendToConnections = message => async (connections) => {
  let postBag = []
  connections.Items.forEach(({identifier: connectionId})=>{
      postBag.push(sendToConnection(connectionId,message))
  })
  return Promise.all(postBag)
}

const sendToConnection = async (connectionId,message)=>{
  return apigwManagementApi.postToConnection({ConnectionId: connectionId, Data: message}).promise()
  .catch(err=>err.statusCode == 410 ? ddb.delete(disconnect(connectionId)).promise() : err)
}

const connect = (id)=>({
  TableName: 'bluecoat',
  Item: {
    recordType : "SOCKET",
    identifier : id
  }
})

const success = (message)=>(result)=>{
  console.log(`Success: ${message}, given ${JSON.stringify(result)}`)
  return {statusCode: 200, body: message}
}

const error = (message)=>(error)=>{
  console.log(`Error: ${message}, given ${JSON.stringify(error)}`)
  return {statusCode: 500, body: JSON.stringify(error)}
}

const connections = ()=>({
    TableName : 'bluecoat',
    KeyConditionExpression: "#recordType = :socket",
    ProjectionExpression: "identifier",
    ExpressionAttributeNames:{
        "#recordType": "recordType"
    },
    ExpressionAttributeValues: {
        ":socket": "SOCKET"
    }
})


const disconnect = (id)=>({
  TableName: 'bluecoat',
  Key: {
    recordType : "SOCKET",
    identifier : id
  }
})