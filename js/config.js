window.config = {
    googleClientId: Array.from(document.getElementsByTagName('meta')).find(meta=>meta.name=='google-signin-client_id').content,
    roleArn: "arn:aws:iam::312837731527:role/BlueCoatGoogleOAuthRole",
    region: "eu-west-1",
    apiGatewayUrl : "https://xyrm1h5e1h.execute-api.eu-west-1.amazonaws.com",
    apiGatewayPath : "/prod",
    socketGatewayUrl : "wss://oqir9akoel.execute-api.eu-west-1.amazonaws.com",
    socketGatewayPath : "/prod",
    version: "{{site.github.build_revision}}"
}
