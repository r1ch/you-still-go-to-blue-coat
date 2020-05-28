var APIMixin = {
	methods: {
		API(method,URL,body,handler){
			body = body ? body : undefined;
			if(method != 'GET'){
				return signedHttpRequest(method, URL, body)
				.then(axios)
				.then(({data}) => {
					if(handler) handler(data)
				})
			} else {
				return unsignedHttpRequest(method, URL, body)
				.then(axios)
				.then(({data}) => {
					if(handler) handler(data)
				})
			}
		},
	}
}


Vue.component('ysgtb-jumbotron',{
	props:['profile','attendee','attendances','colourScale','now'],
	data: ()=>({}),
	template:`
		<div>
			<div class="jumbotron" v-if = "attendee">
				<div class="container">
					<input @keyup = "newAttendee" class="form-control form-control-lg col-6 col-md-3 attendee-name" type="text" v-model="attendee.name" @click = "startAuthentication" :class = "{'btn-outline-success':!profile.ready}">
					<span class = "display-4">&nbsp;still {{go}} to Blue Coat</span>
					<br><br>
					<p class="lead" v-if = "attendee.reporter">Thanks for letting us know {{attendee.reporter}}</p>
					<small v-if = "attendee.identifier">It's been over <ysgtb-time :mode="'text'" :millis="now-attendee.identifier"></ysgtb-time> now</small>
				</div>
			</div>
			<div class = "container" v-if = "attendances.length > 0">
				<ul class="list-group">
					<li class="list-group-item flex-column align-items-start" v-for = "(attendance, index) in attendances" :class= "{active:attendee.name == attendance.identifier, 'image-background':attendee.name == attendance.identifier}">
						<div class="d-flex w-100 justify-content-between">
							<h5 class="mb-1"><span :style="{color:colourScale(attendance.identifier[0])}">•</span>&nbsp;{{attendance.identifier}}</h5>
							<!--<span class="badge badge-pill badge-dark d-none d-sm-block">{{["Mr Inches' favourite","",""][index]}}</span>-->
							<ysgtb-time :mode = "'short'" :millis = "attendance.record"></ysgtb-time>
						</div>
						<div class="d-flex w-100 justify-content-between">
							<small><b>Longest: </b><ysgtb-time :mode = "'short'" :millis = "attendance.longest"></ysgtb-time></small>
							<small v-if = "attendance.lead"><b>Lead: </b><ysgtb-time :mode = "'lead'" :millis = "attendance.lead"></ysgtb-time></small>
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
		}
	},
	methods: {
		newAttendee(){
			this.$emit('newAttendee')
		},
		startAuthentication(){
			this.$emit('startAuthentication')
		}
	}
})

Vue.component('ysgtb-time', {
	props: ['millis','mode'],
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
			let sign = this.millis > 0 ? "+" : "-"
			let millis = this.mode == "lead" ? Math.abs(this.millis) : Math.max(0,this.millis)
			let parts = this.bands.map(band=>{	
				let rawCount = millis / band.millis
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
			let longest = parts[0]
			let duration = longest.count == 1 ? (longest.measure == "hour" ? 'an' : 'a') : longest.count
			let andAHalf = longest.measure != "second" && (longest.fractionalCount >= 0.5) ? " and a half " : " "
			let before = longest.count > 1 ? andAHalf : " "
			let after = longest.count == 1 ? andAHalf : " "
			let clazz = this.mode == 'lead' ? this.millis > 0 ? 'green' : 'red' : false
			return {
				lead: `${sign}${longest.count}<sup>${longest.shortMeasure}</sup>`,
				short: parts.map(part=>`${part.count}<sup>${part.shortMeasure}</sup>`).join(" "),
				text: `${duration}${before}${longest.displayMeasure}${after}`,
				clazz: clazz 
			}
		}
	},
	template:`<span v-if = "millis" v-html="time[mode]" :class= "time.clazz"></span>`
})


Vue.component('ysgtb-d3', {
	mixins:[APIMixin],
	props:['profile','colourScale','times','attendances','drawCount'],
	data: function() {
		let margin = {
			top: 10,
			right: 25,
			middle : 25,
			bottom: 10,
			left: 25
		};
		let fullWidth = 1800
		let ticks = fullWidth/90
		let fullHeight = 300
		let barHeight = 20
		let lineOffset = margin.top + margin.middle + barHeight
		let lineHeight = fullHeight - lineOffset - margin.bottom
		let width = fullWidth - margin.left - margin.right
		let height = fullHeight - margin.top - margin.bottom
		return {
			lines:[],
			margin: margin,
			width: width,
			height: height,
			fullWidth : fullWidth,
			fullHeight : fullHeight,
			barHeight : barHeight,
			lineOffset: lineOffset,
			lineHeight: lineHeight,
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
			.attr("transform", `translate(${this.margin.left},${this.margin.top})`)
		
		this.svg.append("g")
			.attr("class", "x axis")
			.attr("transform", `translate(0,${this.barHeight})`)
		
		this.svg.append("g")
			.attr("class", "y axis")
			.attr("transform", `translate(0,0)`)
		
		d3.selectAll("#d3").node()
			.scrollLeft = this.fullWidth
	},
	watch: {
		"drawCount": function(){
			this.draw()
		}
	},
	methods: {
		draw() {		
			console.log("Drawing")
			
			const t = this.svg.transition().duration(this.drawCount >= 1  ? 750 : 0)
			
			let xScale = d3.scaleTime()
				.domain([this.times[0].from,this.times[this.times.length-1].to])
				.range([0, this.width])

			let xAxis = d3.axisBottom(xScale)
				.ticks(this.ticks)

			this.svg.select(".x")
				.call(xAxis);
			
			let timeLines = [{}]
			let totals = this.attendances.reduce((accumulator,current)=>{accumulator[current.identifier]=current.record; return accumulator},[])
			
			let timeBlocks = this.times.slice(0).reverse().map(time=>{
				let output = {
					end: xScale(time.to),
					start: xScale(time.from),
					reporter: time.reporter,
					name: time.name,
				}
				output.width = output.end - output.start
				timeLines[0].at = output.end
				timeLines[0].totals = {...totals}
				timeLines.unshift({
					name: output.name,
					reporter:output.reporter
				})
				if(totals[time.name]) totals[time.name] -= (parseInt(time.to) - parseInt(time.from))
				return output
			})
			.reverse()
			
			timeLines[0].at = timeBlocks[0].start
			timeLines[0].totals = {...totals}
			
			let timeSeries = Object.keys(timeLines[0].totals)
			.map(key=>timeLines.reduce(
				(acc,current)=>{
					acc.push({
						name:key,
			    			at:current.at,
			    			total: current.totals[key]
					}); 
					return acc
				},[])
			)
			
			let yScale = d3.scaleLinear()
				.domain([
					d3.min(Object.values(timeLines[0].totals)),
					d3.max(Object.values(timeLines[timeLines.length-1].totals))
				])
				.range([this.lineHeight,this.lineOffset])
			
			let lineGenerator = d3.line()
    				.x(d=>d.at)
    				.y(d=>yScale(d.total))
   				.curve(d3.curveMonotoneX)
			
			let blocks = this.svg.selectAll('.block')
				.data(timeBlocks)
				.join(enter=>enter.append('rect'))
				.attr('class', d=>`block ${d.name}`)
				.attr('height', this.barHeight)
				.attr('y',0)
				.transition(t)
				.attr('width', d=>d.width)
				.attr('x', d=>d.start)
				.attr("fill", d=>this.colourScale(d.name[0]))
			
			let clips = this.svg.selectAll(".clip")
				.data(Object.keys(timeLines[0].totals))
				.join(enter=>enter.append("clipPath").attr("class",d=>`clip ${d}`).attr("id",d=>`clip-${d}`))
				.selectAll(".clipRect")
				.data(d=>timeBlocks.filter(block=>block.name==d))
				.join(enter=>enter.append("rect").attr("class",d=>`clipRect ${d.name}`))
				.attr("width",d=>d.width)
				.attr("height",this.lineHeight+5)
				.attr("x",d=>d.start)
				.attr("y",this.lineOffset-5)
			
			let linesOff = this.svg.selectAll('.lineOff')
				.data(timeSeries)
				.join(enter=>enter.append('path'))
				.attr("class", d=>`lineOff ${d[0].name}`)
				.attr("id", d=>`lineOff-${d[0].name}`)
				.attr("stroke", (d,i)=>this.colourScale(d[0].name[0]))
				.attr("d", lineGenerator)
			
			let linesOn = this.svg.selectAll('.lineOn')
				.data(timeSeries)
				.join(enter=>enter.append('path'))
				.attr("class", d=>`lineOn ${d[0].name}`)
				.attr("clip-path", d=>`url(#clip-${d[0].name})`)
				.attr("id", d=>`lineOn-${d[0].name}`)
				.attr("stroke", (d,i)=>this.colourScale(d[0].name[0]))
				.attr("d", lineGenerator)
			

			
			let lineLabels = this.svg.selectAll('.lineLabel')
				.data(timeSeries)
				.join(enter=>enter
					.append('text')
					.attr("class", d=>`lineLabel ${d[0].name}`)
				      	.attr("dy", -2)
				        .attr("fill", (d,i)=>this.colourScale(d[0].name[0]))
				   	.attr("text-anchor","end")
					.append('textPath')
					.attr('xlink:href',d=>`#lineOn-${d[0].name}`)
					.text((d,i)=>i>0?`${d[0].name}`:`${d[0].name} : growing in grace`)
				      	.attr("startOffset","0%")
				        .call(enter => enter.transition(d3.transition().duration(7500).ease(d3.easeCubicOut)).attr("startOffset","100%"))
				 )
			
			let reporters = this.svg.selectAll('.reporter')
				.data(timeLines.filter(point=>point.totals[point.name]))
				.join(enter=>enter.append('circle'))
				.attr('class',d=>`reporter ${d.name} ${d.reporter}`)
				.attr('r', 5)
				.attr('cy', d=>yScale(d.totals[d.name]))
				.attr('cx', d=>d.at)
				.attr('stroke',d=>this.colourScale(d.name[0]))
			
			let reportersLabels = this.svg.selectAll('.reporterLabel')
				.data(timeLines.filter(point=>point.totals[point.name]))
				.join(enter=>enter.append('text'))
				.text(d=>d.reporter)
				.attr('class', d=>`reporterLabel ${d.name} ${d.reporter}`)
				.attr('dy', 2.5)
				.attr('y', d=>yScale(d.totals[d.name]))
				.attr('x', d=>d.at)

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
		attendances: [],
		times: [],
		drawCount: 0,
		colourScale: d3.scaleOrdinal("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),d3.schemeCategory10),
		timer: false,
		refresher: false,
		redrawer: false,
		now : (new Date()).getTime()
	},
	created: function(){
		this.connectSocket()
		Authenticator.then(GoogleAuth=>{
			if(GoogleAuth.isSignedIn.get()) this.userReady(GoogleAuth.currentUser.get())
			else GoogleAuth.currentUser.listen(this.userReady)		
		})
		this.timer && clearInterval(this.timer)
		this.timer = setInterval(()=>{this.now = (new Date()).getTime()},1000)
		this.update()
		this.refresher && clearInterval(this.refresher)
		this.refresher = setInterval(this.update,5*60*1000)
		this.redrawer && clearInterval(this.redrawer)
		this.redrawer = setInterval(()=>this.drawCount++,10*1000)
		this.listenFor("ATTENDEE",this.update)
		this.listenFor("ATTENDANCE",this.update)
	},
	computed: {
		orderedAttendances: function(){
			let currentAttendance = {... this.attendances.find(attendance=>attendance.identifier==this.attendee.name)}
			currentAttendance.record += this.now - this.attendee.identifier
			return this.attendances
			.map(attendance=>{
				let a = {...attendance}
				if(attendance.identifier == currentAttendance.identifier) a.record = currentAttendance.record
				else a.lead = currentAttendance.record - a.record
				return a
			})
			.sort((a,b)=>b.record-a.record)
		}
	},
	methods:{
		update:  _.throttle(function(){
			this.getAll()
		},1000),
		postVisit(){
			return this.API("POST","/visits",this.profile)
		},
		getAll(){
			return this.API("GET","/all",false,([attendee,attendances,times])=>{
				this.attendee = attendee
				this.loadedAttendeeName=this.attendee.name
				this.attendances = attendances
				this.times = times
				this.drawCount++
			})
		},
		startAuthentication(){
			if(this.profile.ready) return
			else Authenticator.then(GoogleAuth=>GoogleAuth.signIn())
		},
		newAttendee: _.debounce(function(){
			if(this.attendee.name==this.loadedAttendeeName || ["","You"].includes(this.attendee.name)) return
			this.attendee.name = this.attendee.name.toUpperCase()[0] + this.attendee.name.slice(1).trim()
			this.API("POST","/attendees",{
				attendee:this.attendee,
				reporter:this.profile
			},this.update)
		},1500),
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
			this.postVisit()
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
			<ysgtb-jumbotron 
				@startAuthentication="startAuthentication"
				@newAttendee="newAttendee"
				:attendee = "attendee"
				:attendances = "orderedAttendances"
				:now = "now" 
				:profile="profile" 
				:colourScale="colourScale">
			</ysgtb-jumbotron>
			<ysgtb-d3 
				:times = "times"
				:attendances = "orderedAttendances"
				:profile="profile"
				:colourScale="colourScale"
				:drawCount = "drawCount">
			</ysgtb-d3>
		</div>
	`
})
