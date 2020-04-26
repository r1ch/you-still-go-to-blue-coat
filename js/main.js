var APIMixin = {
	created: function () {
		console.log("API created")
	},
	methods: {
		API(method,URL,body,handler){
			body = body ? body : undefined;
			signHttpRequest(method, URL, body)
			.then(axios)
			.then(({data}) => {
				if(handler) handler(data)
			})
		},
	}
}

Vue.component('google-login', {
	mixins:[APIMixin],
	data: () => ({
		authenticated: false,
	}),
	template: `
		<div class = "row">
			<div v-if = "!authenticated" class="g-signin2 col" data-width="200" data-height="50" data-onsuccess="authenticate" data-theme="dark"></div>
		</div>
	`,
	mounted: function() {
		Credentials.then((user) => {
			this.authenticated = true;
			this.$emit("userReady",user)
		})
	},
})

Vue.component('ysgtb-jumbotron',{
	mixins:[APIMixin],
	inject:['profile'],
	data: function(){
		return {
			timer: false,
			attendee : {
				name: "You"
			},
			now : (new Date()).getTime()
		}
	},
	template:`
		<div>
			<div class="jumbotron" v-if = "profile.ready">
				<div class="container">
					<input @keyup = "newAttendee" class="form-control form-control-lg col-6 col-md-3 attendee-name" type="text" v-model="attendee.name">
					<span class = "display-4">&nbsp;still {{go}} to Blue Coat</span>
					<br><br>
					<p class="lead" v-if = "attendee.reporter">Thanks for letting us know {{attendee.reporter}}</p>
					<small v-if = "time">{{attendee.name}} {{have}} been going to Blue Coat for over {{time.duration}}{{time.before?time.andAHalf:" "}}{{time.measure}}{{time.after?time.andAHalf:" "}}now</small>
				</div>
			</div>
		</div>
	`,
	watch:{
		"attendee"(){
			if(!this.attendee.association || !this.attendee.association.length || !this.attendee.association.length>1) this.attendee.name = "You"
			console.log(JSON.stringify(this.attendee))
		}
	},
	computed:{
		go: function(){
			return this.attendee.name==="You"?"go":"goes"
		},
		have: function(){
			return this.attendee.name==="You"?"have":"has"
		},
		time: function(){
			if(!this.attendee.identifier) return false
			else{
				let bands = [
					{limit:1000*1,measure:"second"},
					{limit:1000*60,measure:"minute"},
					{limit:1000*60*60,measure:"hour"},
					{limit:1000*60*60*24,measure:"day"},
					{limit:1000*60*60*24*7,measure:"week"},
					{limit:1000*60*60*24*30,measure:"month"},
					{limit:1000*60*60*24*365,measure:"year"}
				].reverse()
				let duration = Math.max(1,this.now - this.attendee.identifier) | 0
				let band = bands.find(band=>band.limit<duration) || bands[bands.length-1]
				let rawCount = Math.max(1,duration/band.limit)
				let count = rawCount | 0
				return {
					duration: count == 1 ? (band.measure == "hour" ? 'an' : 'a') : count,
					measure: `${band.measure}${count!=1?'s':''}`,
					before: count > 1,
					after: count == 1,
					andAHalf: band.measure != "second" && (rawCount - count >= 0.5) ? " and a half " : " ",
					interval: Math.min(band.limit/2,1000*30)
				}
			}
			
		}
	},
	mounted: function(){
		this.getAttendee()
	},
	methods: {
		getAttendee(){
			this.API("GET","/attendees/latest",false,attendee=>this.attendee=attendee)
			this.timer && clearInterval(this.timer)
			this.timer = setInterval(()=>{this.now = (new Date().getTime())},this.time.interval)
		},
		newAttendee: _.debounce(function(){
			this.API("POST","/attendees",{
				attendee:this.attendee,
				reporter:this.profile
			},attendee=>this.attendee=attendee)
		},1000)
	}
})

var app = new Vue({
	el: '#app',
	data: {
		profile: {ready:false},
		version:version,
		revision:revision.substring(0,5)
	},
	methods:{
		userReady(event){
			console.log(`User Ready ${JSON.stringify(event)}`)
			let basicProfile = event.getBasicProfile();
			this.profile.id = basicProfile.getId();
			this.profile.name = basicProfile.getGivenName();
			this.profile.url = basicProfile.getImageUrl();
			this.profile.token = event.getAuthResponse().id_token
			this.profile.ready = true
		}
	},
	provide: function(){
		return {
			profile: this.profile
		}
	},
	template: `
		<div>
			<google-login @userReady = "userReady"></google-login>
			<ysgtb-jumbotron></ysgtb-jumbotron>
		</div>
	`
})	
