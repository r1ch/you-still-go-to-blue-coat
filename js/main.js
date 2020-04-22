var APIMixin = {
	created: function () {
		console.log("API created")
	},
	methods: {
		API(method,URL,body,handler){
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

Vue.component('ysgtb-container',{
	mixins:[APIMixin],
	inject:['profile'],
	data: function(){
		return {
			attendee : {
				name: "You"
			},
			now : (new Date()).getTime()
		}
	},
	template:`
		<div class="jumbotron" v-if = "profile.ready">
			<div class="container">
				<input @change = "newAttendee" class="form-control form-control-lg col-6 col-md-3 attendee-name" type="text" v-model="attendee.name">
				<span class = "display-4"> still {{go}} to Blue Coat</span>
				<br><br>
				<p class="lead" v-if = "attendee.reporter">Thanks for letting us know {{attendee.reporter}}</p>
				<small v-if = "time">and it's been over {{time.duration}} {{time.measure}} now</small>
			</div>
		</div>
	`,
	watch:{
		"attendee"(){
			console.log(JSON.stringify(this.attendee))
		}
	},
	computed:{
		go: function(){
			return this.attendee.name==="You"?"go":"goes"
		},
		time: function(){
			if(!this.attendee.identifier) return false
			else{
				let bands = [
					{limit:1,measure:"second"},
					{limit:60,measure:"minute"},
					{limit:60*60,measure:"hour"},
					{limit:60*60*24,measure:"day"},
					{limit:60*60*24*7,measure:"week"},
					{limit:60*60*24*30,measure:"month"},
					{limit:60*60*24*365,measure:"year"}
				].reverse()
				let duration = Math.max(1,(this.now - this.attendee.identifier)/1000) | 0
				let band = bands.find(band=>band.limit<duration) || bands[bands.length-1]
				let count = Math.max(1,duration/band.limit | 0)
				return {
					duration: count == 1 ? (band.measure == "hour" ? 'an' : 'a') : count,
					measure: `${band.measure}${count!=1?'s':''}`
				}
			}
			
		}
	},
	mounted: function(){
		this.getAttendee()
		setInterval(()=>{this.now = (new Date().getTime())},1000)
	},
	methods: {
		getAttendee(){
			this.API("GET","/attendees/latest",false,attendee=>this.attendee=attendee)
		},
		newAttendee: _.debounce(()=>{
			this.API("POST","/attendees",{
				attendee:this.attendee,
				reporter:this.profile
			},attendee=>this.attendee=attendee)
		},750)
	}
})

Vue.component('ysgtb-name',{
	props:['attendee'],
	data: ()=>({}),
	template:`
	<input type = "text" :model="attendee.name"></input>
	`
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
			<ysgtb-container>{{profile}}</ysgtb-container>
		</div>
	`
})	
