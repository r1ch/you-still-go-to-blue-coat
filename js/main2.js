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
	props:['profile','attendee','attendances','colourScale','now','loadedAttendeeName'],
	data: ()=>({}),
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
					<li class="list-group-item flex-column align-items-start" v-for = "(attendance, index) in orderedAttendances" :class= "{active:attendee.name == attendance.identifier, 'image-background':attendee.name == attendance.identifier}">
						<div class="d-flex w-100 justify-content-between">
							<h5 class="mb-1"><span :style="{color:colourScale(attendance.identifier[0])}">•</span>&nbsp;{{attendance.identifier}}</h5>
							<!--<span class="badge badge-pill badge-dark d-none d-sm-block">{{["Mr Inches' favourite","",""][index]}}</span>-->
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
	computed:{
		go: function(){
			return this.attendee.name==="You"?"go":"goes"
		},
		have: function(){
			return this.attendee.name==="You"?"have":"has"
		},
		orderedAttendances: function(){
			return this.attendances
			.map(attendance=>{
				let a = {...attendance}
				a.record += (this.attendee.name == a.identifier ? this.now-this.attendee.identifier : 0)
				return a
			})
			.sort((a,b)=>b.record-a.record)
		}
	},
	methods: {
		newAttendee : this.$emit('newAttendee'),
		startAuthentication: this.$emit('startAuthentication')
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
	props:['profile','colourScale'],
	data: function() {
		let margin = {
			top: 10,
			right: 25,
			middle : 20,
			bottom: 10,
			left: 75
		};
		let fullWidth = 1800
		let ticks = fullWidth/90
		let fullHeight = 300
		let barHeight = 40
		let lineOffset = margin.top + margin.middle + barHeight
		let lineHeight = fullHeight - lineOffset - margin.bottom
		let width = fullWidth - margin.left - margin.right
		let height = fullHeight - margin.top - margin.bottom
		return {
			times:[],
			lines:[],
			margin: margin,
			width: width,
			height: height,
			fullWidth : fullWidth,
			fullHeight : fullHeight,
			barHeight : barHeight,
			lineOffset: lineOffset,
			lineHeight: lineHeight,
			ticks:ticks,
			timer:false
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
			.attr("transform", `translate(${this.margin.left},${this.margin.top})`)
		
		this.svg.append("g")
			.attr("class", "x axis")
			.attr("transform", `translate(0,${this.barHeight})`)
		
		this.svg.append("g")
			.attr("class", "y axis")
			.attr("transform", `translate(0,0)`)
	},
	methods: {
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

			
			let timeBlocks = this.times.map((totals=>time=>{
				totals[time.name] = (totals[time.name] || 0) + parseInt(time.to) - parseInt(time.from)
				let output = {
					end: xScale(time.to),
					start: xScale(time.from),
					name: time.name,
					totals: {...totals}
				}
				output.width = output.end - output.start
				return output
			})({})).filter(output=>output.width>0.05)
			
			
			let yScale = d3.scaleLinear()
				.domain([0,Math.max(...Object.values(timeBlocks[timeBlocks.length-1].totals))])
				.range([this.lineHeight,this.lineOffset])
			
			let yAxis = d3.axisLeft(yScale)
			
			this.svg.select(".y")
				.transition(t)
				.call(yAxis)
			
			let lineGenerator = name => d3.line()
    				.x(d=>d.end)
    				.y(d=>yScale(d.totals[name] || 0))
   				.curve(d3.curveMonotoneX)
			
			Object.keys(timeBlocks[timeBlocks.length-1].totals).forEach((name)=>{
				if(!this.lines[`line-${name}`]){
					this.lines[`line-${name}`] = this.svg.append("path").datum(timeBlocks)
				}
				
				this.lines[`line-${name}`]
					.attr("class", `line line-${name}`)
					.attr("d", lineGenerator(name))
					.attr("fill", "none")
					.attr("stroke", ()=>this.colourScale(name[0]))
			})
			

			let times = this.svg.selectAll('.time')
				.data(timeBlocks)
			
						
			times.exit().remove()
			
			times
				.attr('class', d=>`time ${d.name}`)
				.attr('width', d=>d.width)
				.attr('height', 0)
				.attr('y', this.barHeight/2)
				.attr('x', d=>d.start)
				.attr("fill", "#aaaaaa")
				.transition(t)
				.delay((d,i,A)=>(A.length-i)*100)
				.attr('y',0)
				.attr("fill", (d)=>this.colourScale(d.name[0]))
				.attr('height', this.barHeight)
			
			
			times.enter()
				.append('rect')
				.attr('class', d=>`time ${d.name}`)
				.attr('width', d=>d.width)
				.attr('height', 0)
				.attr("fill", "#aaaaaa")
				.attr('y', this.barHeight/2)
				.attr('x', d=>d.start)
				.transition(t)
				.delay((d,i,A)=>(A.length-i)*100)
				.attr('y',0)
				.attr("fill", (d)=>this.colourScale(d.name[0]))
				.attr('height', this.barHeight)

			d3.selectAll("#d3").node()
				.scrollLeft = this.fullWidth

			return true;
		}
	}
})




var app = new Vue({
	el: '#app',
	mixins: [APIMixin],
	data: {
		profile: {ready:false},
		pingInterval : false,
		pongTimeout : false,
		version:version,
		revision:revision.substring(0,5),
		attendee: false,
		loadedAttendeeName: false,
		attendances: false,
		colourScale: d3.scaleOrdinal("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),d3.schemeCategory10)
	},
	created: function(){
		this.connectSocket()
		Authenticator.then(GoogleAuth=>{
			if(GoogleAuth.isSignedIn.get()) this.userReady(GoogleAuth.currentUser.get())
			else GoogleAuth.currentUser.listen(this.userReady)		
		})
		this.getTimes()
		this.getAttendee()
		this.getAttendances()
	},
	methods:{
		startAuthentication(){
			if(this.profile.ready) return
			else Authenticator.then(GoogleAuth=>GoogleAuth.signIn())
		},
		getTimes(){
			this.API("GET","/times",false,times=>this.times=times)
		},
		getAttendee(){
			this.API("GET","/attendees/latest",false,attendee=>{
				this.attendee=attendee
				this.loadedAttendeeName=this.attendee.name
			})
		},
		newAttendee: _.debounce(function(){
			if(this.attendee.name==this.loadedAttendeeName || ["","You"].includes(this.attendee.name)) return
			this.attendee.name = this.attendee.name.toUpperCase()[0] + this.attendee.name.slice(1).trim()
			this.API("POST","/attendeex",{
				attendee:this.attendee,
				reporter:this.profile
			},attendee=>{
				this.attendee=attendee
				this.loadedAttendeeName=attendee.name
				this.getAttendances()
			})
		},1500),
		getAttendances(){
			this.API("GET","/attendances",false,attendances=>this.attendances=attendances)
		},
		connectSocket(){
			this.socket = new WebSocket(window.config.socketGatewayUrl + window.config.socketGatewayPath)
			this.socket.onclose = this.connectSocket
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
	template: `
		<div>
			<ysgtb-jumbotron @startAuthentication="startAuthentication" @newAttendee="newAttendee" :attendee = "attendee" :attendances = "attendances" :now = "now" :profile="profile"></ysgtb-jumbotron>
			<ysgtb-d3 :times = "times" :attendances = "attendances" :now = "now" :profile="profile"></ysgtb-d3>
		</div>
	`
})	
