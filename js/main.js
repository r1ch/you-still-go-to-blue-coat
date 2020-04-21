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
		<div class = "d-flex flex-row">
			<div v-if = "!authenticated" class="g-signin2 justify-content-center" data-width="200" data-height="50" data-onsuccess="authenticate" data-theme="dark"></div>
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
			}
		}
	},
	template:`
	<div class = "row" v-if = "profile.ready">
		<h2 class = "col-12">
			<input @change = "newAttendee" class="form-control form-control-lg" type="text" :model = "attendee.name"> still {{go}} to Blue Coat
		</h2>
	</div>
	`,
	computed:{
		go: function(){
			return this.attendee.name==="You"?"go":"goes"
		}
	},
	mounted: function(){
		this.getAttendee()
	},
	methods: {
		getAttendee(){
			this.API("GET","/attendees/latest",false,attendee=>this.attendee=attendee)
		},
		newAttendee(){
			this.API("POST","/attendees",this.attendee,console.log)
		}
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
		<div class = "container">
			<google-login @userReady = "userReady"></google-login>
			<ysgtb-container>{{profile}}</ysgtb-container>
		</div>
	`
})	
