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
	inject:['profile','listenFor'],
	data: function(){
		return {
			timer: false,
			attendee : {
				name: "You"
			},
			attendances : [],
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
					<small v-if = "time">It's been over {{time.duration}}{{time.before?time.andAHalf:" "}}{{time.measure}}{{time.after?time.andAHalf:" "}}now</small>
				</div>
			</div>
			<div class = "container" v-if = "profile.ready">
				<h4>Grew in grace</h4>
				<ul class="list-group">
					<li class="list-group-item flex-column align-items-start" v-for = "attendance in attendances" :class= "{active:attendee.name == attendance.identifier, 'image-background':attendee.name == attendance.identifier}">
						<div class="d-flex w-100 justify-content-between">
							<h5 class="mb-1">{{attendance.identifier}}</h5>
							<p>&nbsp;{{attendee.name == attendance.identifier ? time.running :  attendance.record | grace}}</p>
						</div>
						<div class="d-flex w-100 justify-content-between">
							<small><b>Longest: </b>{{attendee.name == attendance.identifier && time.millis > attendance.longest ? time.millis : attendance.longest | grace}}</small>
							<small><b>Shortest: </b>{{attendee.name == attendance.identifier && time.millis < attendance.shortest ? time.millis : attendance.shortest | grace}}</small>
						</div>
					</li>
				</ul>
			</div>
		</div>
	`,
	watch:{
		"attendee"(){
			if(!this.attendee.name || !this.attendee.name.length || !this.attendee.name.length>1) this.attendee.name = "You"
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
				let millis = Math.max(1,this.now - this.attendee.identifier) | 0
				let band = bands.find(band=>band.limit<millis) || bands[bands.length-1]
				let rawCount = Math.max(1,millis/band.limit)
				let count = rawCount | 0
				let runningAttendance = this.attendances.find(attendance=>attendance.identifier==this.attendee.name)
				let running = runningAttendance ? runningAttendance.record + millis : 0
				return {
					duration: count == 1 ? (band.measure == "hour" ? 'an' : 'a') : count,
					measure: `${band.measure}${count!=1?'s':''}`,
					before: count > 1,
					after: count == 1,
					andAHalf: band.measure != "second" && (rawCount - count >= 0.5) ? " and a half " : " ",
					interval: Math.min(band.limit/2,1000*30),
					running : running,
					millis: millis
				}
			}
			
		}
	},
	filters: {
		grace: function (record) {
			let seconds = Number(record/1000);
			let d = Math.floor(seconds / (3600*24));
			let h = Math.floor(seconds % (3600*24) / 3600);
			let m = Math.floor(seconds % 3600 / 60);
			let s = Math.floor(seconds % 60);
			let dDisplay = d > 0 ? d + (d == 1 ? "d" : "d") : "";
			let hDisplay = h > 0 ? h + (h == 1 ? "h" : "h") : "";
			let mDisplay = m > 0 ? m + (m == 1 ? "m" : "m") : "";
			let sDisplay = s > 0 ? s + (s == 1 ? "s" : "s") : "";
			return [dDisplay,hDisplay,mDisplay,sDisplay].filter(item=>item!="").join(" ")
		}
	},
	mounted: function(){
		this.visit()
		this.getAttendee()
		this.getAttendances()
		this.listenFor('ATTENDEE',this.getAttendee)
		this.listenFor('ATTENDANCE',this.getAttendances)
	},
	methods: {
		visit(){
			this.API("POST","/visits",this.profile)
		},
		getAttendee(){
			this.API("GET","/attendees/latest",false,attendee=>this.attendee=attendee)
			this.timer && clearInterval(this.timer)
			this.timer = setInterval(()=>{this.now = (new Date().getTime())},1000)
		},
		getAttendances(){
			this.API("GET","/attendances",false,attendances=>this.attendances=attendances)
		},
		newAttendee: _.debounce(function(){
			this.API("POST","/attendees",{
				attendee:this.attendee,
				reporter:this.profile
			},attendee=>{
				this.attendee=attendee
			})
		},1500)
	}
})

Vue.component('ysgtb-time', {
	props: ['millis','short'],
	data: ()=>({
		bands:[
			{millis:1000*60*60*24*365,measure:"year"},
			{millis:1000*60*60*24*7,number:52,measure:"week"},
			{millis:1000*60*60*24,number:7,measure:"day"},
			{millis:1000*60*60,number:24,measure:"hour"},
			{millis:1000*60,number:60,measure:"minute"},
			{millis:1000*1,number:60,measure:"second"},
		]
	}),
	computed: {
		time: function(){
			let parts = this.bands.map(band=>{
				let rawCount = this.millis / band.millis
				if(band.number) rawCount %= band.number
				return {
					measure: band.measure,
					shortMeasure: band.measure[0],
					displayMeasure: band.measure + rawCount>2 ? 's' : '',
					rawCount : rawCount,
					fractionalCount : rawCount - rawCount|0,
					count : rawCount|0
				}
			}).filter(part=>part.count>0)
			let long = parts[0]
			let duration = long.count == 1 ? (long.measure == "hour" ? 'an' : 'a') : long.count
			let andAHalf = long.measure != "second" && (long.fractionalCount >= 0.5) ? " and a half " : " ",
			let before = long.count > 1 ? andAHalf : " "
			let after = long.count == 1 ? andAHalf : " "
			let html = parts.map(part=>`${part.count}<sup>${part.shortMeasure}</sup>`).join(" ")
			return {
				html: html,
				text: `${duration}${before}${long.measure}${after}`
			}
		}
	},
	template:`<span v-html="short ? text : html"></span>`
	`
})

var app = new Vue({
	el: '#app',
	data: {
		profile: {ready:false},
		version:version,
		revision:revision.substring(0,5)
	},
	created: function(){
		this.socket = new WebSocket(window.config.socketGatewayUrl + window.config.socketGatewayPath)
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
		},
		listenFor(key,handler){
			this.socket.addEventListener("message",event=>{
				let data = event && event.data
				try{
					data = JSON.parse(data)
				} catch(err){
					console.err(`Error in parse of ${JSON.stringify(event)} data`)
					data = false
				}
				data && data.eventType && (data.eventType == key || key == "*") ? handler(data) : false
			})
		}
	},
	provide: function(){
		return {
			profile: this.profile,
			listenFor: this.listenFor
		}
	},
	template: `
		<div>
			<google-login @userReady = "userReady"></google-login>
			<ysgtb-jumbotron></ysgtb-jumbotron>
		</div>
	`
})	

	
