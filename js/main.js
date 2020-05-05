var APIMixin = {
	methods: {
		API(method,URL,body,handler){
			body = body ? body : undefined;
			if(method != 'GET'){
				signedHttpRequest(method, URL, body)
				.then(axios)
				.then(({data}) => {
					if(handler) handler(data)
				})
			} else {
				unsignedHttpRequest(method, URL, body)
				.then(axios)
				.then(({data}) => {
					if(handler) handler(data)
				})
			}
		},
	}
}


Vue.component('ysgtb-jumbotron',{
	mixins:[APIMixin],
	inject:['profile','listenFor','colourScale'],
	data: function(){
		return {
			timer: false,
			refresher: false,
			attendee : {
				name: "You"
			},
			attendances : [],
			now : (new Date()).getTime()
		}
	},
	template:`
		<div>
			<div class="jumbotron" v-if = "attendee">
				<div class="container">
					<input @keyup = "newAttendee" class="form-control form-control-lg col-6 col-md-3 attendee-name" type="text" v-model="attendee.name" @click = "startAuthentication" :class = "{'btn-outline-success':!profile.ready}">
					<span class = "display-4">&nbsp;still {{go}} to Blue Coat</span>
					<br><br>
					<p class="lead" v-if = "attendee.reporter">Thanks for letting us know {{attendee.reporter}}</p>
					<small v-if = "attendee.identifier">It's been over <ysgtb-time :short="false" :millis="now-attendee.identifier"></ysgtb-time> now</small>
				</div>
			</div>
			<div class = "container" v-if = "attendances.length > 0">
				<h4>Grew in grace</h4>
				<ul class="list-group">
					<li class="list-group-item flex-column align-items-start" v-for = "attendance in orderedAttendances" :class= "{active:attendee.name == attendance.identifier, 'image-background':attendee.name == attendance.identifier}">
						<div class="d-flex w-100 justify-content-between">
							<h5 class="mb-1"><span :style="{color:colourScale(attendance.identifier[0])}">•</span>&nbsp;{{attendance.identifier}}</h5>
							<ysgtb-time :short = "true" :millis = "attendance.record"></ysgtb-time>
						</div>
						<div class="d-flex w-100 justify-content-between">
							<small><b>Longest: </b><ysgtb-time :short = "true" :millis = "attendance.longest"></ysgtb-time></small>
							<small><b>Shortest: </b><ysgtb-time :short = "true" :millis = "attendance.shortest"></ysgtb-time></small>
						</div>
					</li>
				</ul>
			</div>
		</div>
	`,
	watch:{
		"attendee"(){
			if(!this.attendee.name || !this.attendee.name.length || !this.attendee.name.length>1) this.attendee.name = "You"
		}
	},
	computed:{
		go: function(){
			return this.attendee.name==="You"?"go":"goes"
		},
		have: function(){
			return this.attendee.name==="You"?"have":"has"
		},
		orderedAttendances: function(){
			return this.attendances.map(attendance=>{
				attendance.record += (this.attendee.name == attendance.identifier ? (this.now-this.attendee.identifier) : 0)
				return attendance
			}).sort((a,b)=>a.record>b.record)
		}
	},
	mounted: function(){
		this.getAttendee()
		this.getAttendances()
		this.listenFor('ATTENDEE',this.getAttendee)
		this.listenFor('ATTENDANCE',this.getAttendances)
		this.timer && clearInterval(this.timer)
		this.timer = setInterval(()=>{this.now = (new Date().getTime())},1000)
		this.refresher && clearInterval(this.refresher)
		this.refresher = setInterval(this.refresh,60*1000)
	},
	methods: {
		startAuthentication(){
			if(this.profile.ready) return
			else Authenticator.then(GoogleAuth=>GoogleAuth.signIn())
		},
		refresh(){
			this.getAttendee()
			this.getAttendances()
		},
		visit(){
			this.API("PUT","/visits",this.profile)
		},
		getAttendee(){
			this.API("GET","/attendees/latest",false,attendee=>this.attendee=attendee)
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
				this.getAttendances()
			})
		},1000)
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
			{millis:1000*1,number:60,measure:"second"}
		]
	}),
	computed: {
		time: function(){
			let parts = this.bands.map(band=>{
				let rawCount = Math.max(0,this.millis) / band.millis
				rawCount = band.number ? rawCount % band.number : rawCount
				return {
					measure: band.measure,
					shortMeasure: band.measure[0],
					displayMeasure: band.measure + (rawCount>2 ? 's' : ''),
					rawCount : rawCount,
					fractionalCount : rawCount - (rawCount|0),
					count : rawCount|0
				}
			}).filter(part=>part.count>0 || part.measure == "second")
			let long = parts[0]
			let duration = long.count == 1 ? (long.measure == "hour" ? 'an' : 'a') : long.count
			let andAHalf = long.measure != "second" && (long.fractionalCount >= 0.5) ? " and a half " : " "
			let before = long.count > 1 ? andAHalf : " "
			let after = long.count == 1 ? andAHalf : " "
			let html = parts.map(part=>`${part.count}<sup>${part.shortMeasure}</sup>`).join(" ")
			return {
				html: html,
				text: `${duration}${before}${long.displayMeasure}${after}`
			}
		}
	},
	template:`<span v-if = "millis" v-html="short?time.html:time.text"></span>`
})


Vue.component('ysgtb-d3', {
	mixins:[APIMixin],
	inject:['profile','listenFor','colourScale'],
	data: function() {
		let margin = {
			top: 10,
			right: 25,
			bottom: 25,
			left: 25
		};
		let fullWidth = 1800
		let ticks = fullWidth/90
		let fullHeight = 60
		let width = fullWidth - margin.left - margin.right;
		let height = fullHeight - margin.top - margin.bottom;
		return {
			times:[],
			margin: margin,
			width: width,
			height: height,
			fullWidth : fullWidth,
			fullHeight : fullHeight,
			ticks:ticks
		}
	},
	template: `
		<div class = "row">
			<div id = "d3" class = "col-12 svgHolder"></div>
		</div>
    	`,
	mounted : function(){
		this.svg = d3.select("#d3")
			.append("svg")
			.attr('width',this.fullWidth)
			.attr('height',this.fullHeight)
			.append("g")
			.attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")")
		
		this.svg.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + this.height + ")")
		this.getTimes()
	},
	methods: {
		getTimes(){
			this.API("GET","/times",false,times=>{
				this.times=times
				this.draw()
			})
		},
		draw() {
			if (this.times.length == 0) return;
			let t = d3.transition().duration(750);
			
			let xScale = d3.scaleTime()
				.domain([this.times[0].from,this.times[this.times.length-1].to])
				.range([0, this.width])

			let xAxis = d3.axisBottom(xScale)
				.ticks(this.ticks)

			this.svg.select(".x")
				.transition(t)
				.call(xAxis);

			
			let timeBlocks = this.times.map(time=>{
				let output = {
					end: xScale(time.to),
					start: xScale(time.from),
					name: time.name
				}
				output.width = output.end - output.start
				return output
			})

			let times = this.svg.selectAll('.time')
				.data(timeBlocks)
			
						
			times.exit().remove()
			
			times
				.attr('class', function(d){return `time ${d.name}`})
				.attr('width', function(d) {
					return d.width
				})
				.attr('height', this.height)
				.attr('y', 0)
				.transition(t)
				.attr('x', function(d) {
					return d.start
				})
				.attr("fill", (d)=>this.colourScale(d.name[0]))


			
			times.enter()
				.append('rect')
				.attr('class', function(d){return `time ${d.name}`})
				.attr('width', function(d) {
					return d.width
				})
				.attr('height', this.height)
				.attr('y', 0)
				.transition(t)
				.attr('x', function(d) {
					return d.start
				})
				.attr("fill", (d)=>this.colourScale(d.name[0]))

			d3.selectAll("#d3").node()
				.scrollLeft = this.fullWidth

			return true;
		}
	}
})




var app = new Vue({
	el: '#app',
	data: {
		profile: {ready:false},
		pingInterval : false,
		pongTimeout : false,
		version:version,
		revision:revision.substring(0,5),
		scale: d3.scaleOrdinal().range(d3.schemeTableau10)
	},
	created: function(){
		this.connectSocket()
		Authenticator.then(GoogleAuth=>{
			if(GoogleAuth.isSignedIn.get()) this.userReady(GoogleAuth.currentUser.get())
			else GoogleAuth.currentUser.listen(this.userReady)		
		})
	},
	methods:{
		colourScale(x){
			return this.scale(x)
		},
		connectSocket(){
			this.socket = new WebSocket(window.config.socketGatewayUrl + window.config.socketGatewayPath)
			this.socket.onclose(this.connectSocket)
			this.listenFor("pong",this.pong)
			this.pingInterval && clearInterval(this.pingInterval)
			this.pingInterval = setInterval(this.ping,2*60*1000)
		},
		ping(){
			this.socket.send(JSON.stringify({action:"ping"}))
			this.pongTimeout = setTimeout(this.timeout,5000)
		},
		pong(){
			this.pongTimeout && clearInterval(this.pongTimeout)
			this.pongTimeout = false
		},
		timeout(){
			this.pingInterval && clearInterval(this.pingInterval)
			this.pingInterval = false;
			this.connectSocket()
		},
		userReady(event){
			console.log(`User Ready`)
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
			listenFor: this.listenFor,
			colourScale: this.colourScale
		}
	},
	template: `
		<div>
			<ysgtb-jumbotron></ysgtb-jumbotron>
			<ysgtb-d3></ysgtb-d3>
		</div>
	`
})	

	
