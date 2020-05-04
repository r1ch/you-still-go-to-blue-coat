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

function initGoogleAuthentication(){
	gapi.load('auth2',()=>{
		gapi.auth2.init({
  			client_id: window.config.googleClientId
		}).then(GoogleAuth=>{
			GoogleAuth.currentUser.listen(authenticate)
			Authenticator.setObject(GoogleAuth)
			Authenticator.resolve()
		})
	})
}

function authenticate(googleUser) {
    getIdToken(googleUser)
        .then(AWSSTSSignIn)
        .then(handleSTSResponse)
        .catch(handleError);
};

function getIdToken(googleUser) {
    Credentials.setObject(googleUser)
    var idToken = googleUser.getAuthResponse().id_token;
    return new Promise(function (resolve) {
        resolve(idToken);
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
