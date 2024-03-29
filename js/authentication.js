function Deferred() {
	let res, rej, object
	let promise = new Promise((resolve, reject) => {
		res = resolve;
		rej = reject;
	});
	promise.setObject = function(o){
		object = o
	};
	promise.value = function(){
		return object
	};
	promise.resolve = ()=>{
		res(object);
	};
	promise.reject = rej;
	return promise;
}

let Credentials = Deferred()
let Authenticator = Deferred()

google.accounts.id.initialize({client_id: config.googleClientId, callback: authenticationCallback})


function parseJwt (token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
};

function authenticationCallback(CredentialResponse) {
    console.log("Callback")
 	
    Authenticator.setObject(parseJwt(CredentialResponse.credential))
    Authenticator.resolve()
    getIdToken(CredentialResponse)
        .then(AWSSTSSignIn)
        .then(handleSTSResponse)
        .catch(handleError);
};

function getIdToken(CredentialResponse) {
    console.log("Setting Id Token from CredentialResponse")
    const id_token = CredentialResponse.credential
    Credentials.setObject(id_token)
    return new Promise(function (resolve) {
        console.log("Resolved Id Token")
        resolve(id_token);
    });
}

function AWSSTSSignIn(idToken) {
    console.log("Getting AWS STS Token")
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
		console.log("Got AWS STS Token")
                resolve(data);
            }
        });
    });
}

function handleSTSResponse(data) {
    console.log("Setting up AWS SDK")
    AWS.config.credentials = new AWS.Credentials(
        data.Credentials.AccessKeyId,
        data.Credentials.SecretAccessKey,
        data.Credentials.SessionToken);
    AWS.config.region = window.config.region;
    return Credentials.resolve()
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
