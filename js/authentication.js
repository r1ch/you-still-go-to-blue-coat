function Deferred() {
	let res, rej, object
	let promise = new Promise((resolve, reject) => {
		res = resolve;
		rej = reject;
	});
	promise.setObject = function(o){
		object = o
	};
	promise.resolve = ()=>{
		res(object);
	};
	promise.reject = rej;
	return promise;
}

let Credentials = Deferred()
let Authenticator = Deferred()


function authenticationCallback(CredentialResponse) {
    getIdToken(CredentialResponse)
        .then(AWSSTSSignIn)
        .then(handleSTSResponse)
        .catch(handleError);
};

function getIdToken(CredentialResponse) {
    const id_token = CredentialResponse.credential
    console.log(id_token)
    Credentials.setObject(id_token)
    return new Promise(function (resolve) {
        resolve(id_token);
    });
}

function AWSSTSSignIn(idToken) {
    var sts = new AWS.STS();
    var params = {
        RoleArn: window.config.roleArn,
        RoleSessionName: "AssumeRoleSession",
        WebIdentityToken: idToken
    };
    return new Promise(function (resolve, reject) {
        sts.assumeRoleWithWebIdentity(params, function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

function handleSTSResponse(data) {
    AWS.config.credentials = new AWS.Credentials(
        data.Credentials.AccessKeyId,
        data.Credentials.SecretAccessKey,
        data.Credentials.SessionToken);
    AWS.config.region = window.config.region;
    return  Credentials.resolve()
}

function signedHttpRequest(method,path,data){
	return signHttpRequest(method,path,data)
}

function unsignedHttpRequest(method,path,data){
	return Promise.resolve(
		{
			method : method,
			url : `${window.config.apiGatewayPath}${path}`,
			baseURL: window.config.apiGatewayUrl,
			data: data
		}
	)
}


function signHttpRequest(method,path,data) {
    return Credentials.then(()=>{
	    let request = new AWS.HttpRequest(window.config.apiGatewayUrl, window.config.region);
	    request.method = method;
	    request.path = window.config.apiGatewayPath;
	    request.path += path
	    request.headers['Host'] = request.endpoint.host;
	    request.body = JSON.stringify(data);
	    var signer = new AWS.Signers.V4(request, 'execute-api');
	    signer.addAuthorization(AWS.config.credentials, AWS.util.date.getDate());
	    console.log(signer.canonicalString())
	    let r = signer.request
	    delete r.headers.Host
	    return {
	    	method : r.method,
		url : r.path,
		baseURL : r.endpoint.href,
		headers : r.headers,
		data: data
	    }
    });
}

function handleError(error) {
    console.log(`Authentication failed:  ${JSON.stringify(error)}`);
}
