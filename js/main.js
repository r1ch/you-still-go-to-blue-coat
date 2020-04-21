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
			<div v-if = "!authenticated" class="g-signin2" data-width="200" data-height="50" data-onsuccess="authenticate" data-theme="dark"></div>
		</div>
	`,
	mounted: function() {
		Credentials.then((user) => {
			this.authenticated = true;
			this.$emit("userReady",user)
		})
	}
})

Vue.component('witb-container',{
	mixins:[APIMixin],
	inject:['profile','listenFor'],
	data: ()=>({
		games:[],
		currentGame:false
	}),
	computed:{
		currentGameIdentifier(){
			return this.currentGame ? this.currentGame.identifier : false;
		}
	},
	mounted: function(){
		this.fetchGames();
		this.listenFor("GAME",this.fetchGames)
	},
	methods: {
		fetchGames(){
			this.API("GET","/games",null,games=>{
				this.games=games
				if(this.currentGame) this.currentGame = this.games.find(game=>game.identifier==this.currentGame.identifier)
			})
		},
		chooseGame(event){
			this.currentGame = event
			this.API("PUT",`/games/${this.currentGame.identifier}/players`,this.profile)
		},
		endTurn(namesGot){
			this.API("PUT",`/games/${this.currentGame.identifier}/turn/${this.currentGame.playIndex}`,{namesGot:namesGot},game=>this.currentGame=game)
		}
	},
	template: `
		<div v-if = "games" >
			<witb-game @chooseGame= "chooseGame" v-if = "!currentGameIdentifier || (currentGameIdentifier == game.identifier && !game.started)"  v-for = "game in games" :key="game.identifier" :game="game" :currentGameIdentifier = "currentGameIdentifier"></witb-game>
			<witb-playspace @endTurn = "endTurn" v-if = "currentGame && currentGame.started" :game = "currentGame"></witb-playspace>
		</div>
	`
})

Vue.component('witb-game',{
	mixins: [APIMixin],
	inject:['profile','listenFor'],
	props: ['game','currentGameIdentifier'],
	data: function(){
		return{
			players:[],
			remoteNames:[],
			team:0,
			startProblem: ""
		}
	},
	computed: {
		gameReady : function(){
			if(this.game.identifier != this.currentGameIdentifier) this.startProblem = "Not in this game"
			else if(this.players.length <= 1) this.startProblem = "Not enough players"
			else if(this.players.filter(player=>player.numberOfNames != this.game.namesPerPerson).length !=0) this.startProblem = "Some players missing names"
			else this.startProblem = ""
			return this.startProblem == ""
		},
		names : function(){
			let list = []
			for(let i=0;i<this.game.namesPerPerson;i++){
				list.push({
					key:i,
					value: this.remoteNames[i]||""
				})
			}
			return list
		},
	},
	mounted: function(){
		this.listenFor("PLAYER",this.fetchOthers)
	},
	methods: {
		fetchOthers(){
			this.API("GET",`/games/${this.game.identifier}/players`,false,players=>this.players=players)
		},
		fetchMe(){
			this.API("GET",`/players/${this.profile.id}`,false,my=>{
				console.log(JSON.stringify(my))
				this.remoteNames = my.names || []
				this.team = my.team || 0
			})
		},
		chooseGame(){
			this.$emit("chooseGame",this.game)
			this.fetchOthers()
			this.fetchMe()
		},
		saveNames(names){
			this.API("PUT",`/players/${this.profile.id}/names`,{names:this.names.map(name=>name.value).filter(value=>value!="")},my=>{
				this.remoteNames = my.names || []
			})
		},
		saveTeam(team){
			this.API("PUT",`/players/${this.profile.id}/team`,{team:team},my=>{
				this.team = my.team || 0
			})
		},
		startGame(){
			if(this.gameReady) this.API("POST",`/games/${this.game.identifier}/start`)
		}
	},
	template: `
		<div class = row>
			<h5 class = "col-12">{{game.title}}</h5>
			<ul class = "list-group-flush" v-if = "currentGameIdentifier == game.identifier">
				<witb-me @saveNames="saveNames" @saveTeam = "saveTeam" :game="game" :names="names" :team="team"></witb-me>
				<witb-player v-for = "player in players" :key = "player.identifier" :player="player" v-if="player.identifier!=profile.id"></witb-player>
			</ul>
			<br>	
			<div class = "col-12">
				<small class= "col-6">{{game.namesPerPerson}} names, {{game.secondsPerRound}}s/turn</small>
				<button class = "btn btn-primary col-6" @click="chooseGame" v-if="currentGameIdentifier != game.identifier">Join</button>
				<button class = "btn btn-primary col-6" @click="startGame" :class="{'disabled': !gameReady}" v-if="currentGameIdentifier == game.identifier">Start</button>
				<span v-if = "startProblem" class="form-text text-muted col-6">{{startProblem}}</span>
			</div>
		</div>
	`
})

Vue.component('witb-playspace',{
	mixins:[APIMixin],
	inject:['profile','teams','teamColours','sendMessage','listenFor'],
	props: ['game'],
	data: function(){
		return {
			stages : {
				Ready:0,
				Started:1,
				Finished:2,
				Done:3,
				Next:4
			},
			stage:0,
			startTime: false,
			timer: false,
			timeRemaining: this.game.secondsPerRound,
			remoteTimeRemaining: this.game.secondsPerRound,
			namesLeft : this.game.namesLeftThisRound,
			nameInPlay : "",
			passed : "",
			namesGot : [],
		}
	},
	mounted: function(){
		this.listenFor("TIMER",(data)=>{
			let timerMessage = data.eventDetail
			//do we trust the clock?
			console.log(`${JSON.stringify(timerMessage)}, ${timerMessage.playerEpoch}`)
			let jitter = (new Date()).getTime()-timerMessage.playerEpoch
			if(jitter < 0 || jitter > 2000){
				//use network jitter correction if we get causal messages within 2 seconds
				jitter = 0
			} else {
				console.log(`Jitter: ${jitter}`)
			}
			this.remoteTimeRemaining = Math.max(0,timerMessage.playerSeconds - jitter/1000)
			if(this.remoteTimeRemaining <= 0){
				this.playSound("end")
			}
		})
		this.listenFor("TURN",(data)=>{
			this.playSound(data.eventDetail)
		})
	},
	computed:{
		scores: function(){
			if(!this.game.turns) return {}
			return this.game.turns.reduce((map, turn) => ({
			  ...map,
			  [turn.teamIndex]: (map[turn.teamIndex] || 0) + turn.names.length,
			}), {})
		},
		localTimeWidth: function(){
			return `width: ${this.timeRemaining/this.game.secondsPerRound * 100}%`;
		},
		remoteTimeWidth:function(){
			return `width: ${this.remoteTimeRemaining/this.game.secondsPerRound * 100}%`;
		},
		team: function(){
			return this.game.teams[this.game.teamIndex]
		},
		player: function(){
			return this.team.players[this.game.teamPlayerIndex[this.game.teamIndex]]
		}
	},
	watch: {
		"game.playIndex"(newVal,oldVal){
			console.log("Clean-up as new player")
			Object.assign(this.$data, this.$options.data.apply(this))
			if(this.player.identifier == this.profile.id){
				console.log("It's my go!")
				this.stage = this.stages.Ready
			} else {
				console.log("Someone else's go...")
				this.stage = this.stages.Next
			}
		}
	},
	methods:{
		playSound : function(sound){
			let sounds = {
				end: "/sounds/end.mp3",
				got: "/sounds/got.mp3",
				pass: "/sounds/pass.mp3"
			}
			if (sounds[sound]){
				var audio = new Audio(sounds[sound]);
				audio.play()
			}
		},
		pickNextName : function(){
			if(this.namesLeft && this.namesLeft.length > 0 && this.stage < this.stages.Finished){
				console.log(`Old name: ${this.nameInPlay}`)
				this.nameInPlay = this.namesLeft.splice(this.namesLeft.length * Math.random() | 0, 1)[0]
				console.log(`New name: ${this.nameInPlay}`)
			} else {
				this.nameInPlay = ""
				if(this.stage < this.stages.Finished) this.stage = this.stages.Finished
				console.log(`No names or time, ${this.nameInPlay}`)
			}
		},
		start : function(){
			this.pickNextName()
			this.startTimer()
			this.stage = this.stages.Started
		},
		startTimer : function(){
			this.startTime = Date.now()
			this.timer = setInterval(()=>{this.tick()},500)
		},
		tick : function(){
			let timeRemaining = Math.max((this.startTime+this.game.secondsPerRound*1000-Date.now())/1000,0)
			this.sendMessage("TIMER",{
				player: this.profile.id,
				playerEpoch: (new Date()).getTime(),
				playerSeconds: timeRemaining
			})
			if(timeRemaining <= 0){
				clearInterval(this.timer)
				this.stage = this.stages.Finished
			}
			this.timeRemaining = timeRemaining
		},
		gotIt : function(name){
			this.sendMessage("TURN","got")
			console.log(`GotIt before, got: event: ${this.namesGot}, event: ${name}, nameInPlay: ${this.nameInPlay}, passed:${this.passed}`)
			this.namesGot.push(name)
			this.pickNextName()
			console.log(`GotIt after, event: ${this.namesGot}, event: ${name}, nameInPlay: ${this.nameInPlay}, passed:${this.passed}`)
		},
		passIt : function(name){
			this.sendMessage("TURN","pass")
			console.log(`PassIt before, event: ${this.namesGot}, event: ${name}, nameInPlay: ${this.nameInPlay}, passed:${this.passed}`)
			this.passed = name
			this.pickNextName()
			console.log(`PassIt after, event: ${this.namesGot}, event: ${name}, nameInPlay: ${this.nameInPlay}, passed:${this.passed}`)
		},
		gotPass : function(name){
			this.sendMessage("TURN","got")
			console.log(`gotPass before, event: ${this.namesGot}, event: ${name}, nameInPlay: ${this.nameInPlay}, passed:${this.passed}`)
			this.namesGot.push(name)
			this.passed = false
			console.log(`gotPass after, event: ${this.namesGot}, event: ${name}, nameInPlay: ${this.nameInPlay}, passed:${this.passed}`)
		},
		endTurn : function(){
			this.timer && clearInterval(this.timer)
			this.stage = this.stages.Done
			this.$emit("endTurn",this.namesGot)
		}
	},
	template:`
		<div class="card" :class = "teamColours(teams[player.team].livery).card">
			{{game.title}}
			<div class="card-body">
				<h5 class="card-title">{{player.name}}'s Turn</h5>
    				<h6 class="card-subtitle mb-2 text-muted" v-if = "!game.ended">{{game.rounds[game.roundIndex]}} round</h6>
				<h6 class="card-subtitle mb-2" v-if = "game.ended">Finished!</h6>
				<span v-for = "(value,index) in scores" class="badge badge-pill" :class = "teamColours(teams[game.teams[index].team].livery).badge">{{value}}</span>
			</div>
			<div class = "card-body">
				<div v-if = "!game.ended && player.identifier == profile.id" class="progress" style="height: 20px;">
					<div class="progress-bar" :class = "teamColours(teams[player.team].livery).progress" role="progressbar" :style="localTimeWidth">{{Math.ceil(timeRemaining)}}s</div>
				</div>
				<div v-if = "!game.ended && player.identifier != profile.id" class="progress teamColours(teams[player.team].livery).progress" style="height: 20px;">
					<div class="progress-bar" :class = "teamColours(teams[player.team].livery).progress" role="progressbar" :style="remoteTimeWidth">{{Math.ceil(remoteTimeRemaining)}}s</div>
				</div>
			</div>
			<ul class="list-group list-group-flush" v-if = "!game.ended && stage<stages.Done && player.identifier == profile.id">
				<witb-playname @gotIt = "gotPass" :name="passed" :canPass = "false"></witb-playname>
				<witb-playname @gotIt = "gotIt" @passIt = "passIt" :name="nameInPlay" :canPass = "passed == ''"></witb-playname>
			</ul>
			<div class="card-body" v-if = "!game.ended && player.identifier == profile.id">
				<button @click = "start" class =  "btn btn-primary" v-if = "stage==stages.Ready">Start my go</button>
				<button @click = "endTurn" class =  "btn btn-primary" v-if = "stage==stages.Finished">End my go<br><small>Got {{namesGot.length}}</small></button>
			</div>
		</div>
	`	
})

Vue.component('witb-playname',{
	props: ['name','canPass'],
	methods:{
		gotIt: function(){
			this.$emit("gotIt",this.name)
		},
		passIt : function(){
			this.$emit("passIt",this.name)
		}
	},
	template: `
		<li class = "list-group-item" v-if='name!=""'>
			<div class="btn-group" role="group">
				<button @click = "gotIt" type="button" class="btn btn-success">Got it!</button>
				<button type="button" class="btn btn-secondary" disabled>{{name}}</button>
				<button @click = "passIt" type="button" class="btn btn-danger" v-if = "canPass">Pass</button>
			</div>
		</li>
	`
})

Vue.component('witb-me',{
	inject: ['teams','teamColours'],
	props: ['game','names','team'],
	methods: {
		saveNames: function(){
			this.$emit("saveNames",this.names)
		},
		saveTeam: function(team){
			this.$emit("saveTeam",team)
		}
	},
	template: `
		<li class="list-group-item" :class="teamColours(teams[team].livery).li">
			<div class="form-group row">
				<label class="col-4">Team</label> 
				<div class="col-8">
					<div class="btn-group" role="group">
						<button @click = "saveTeam(teamOption.key)" v-for = "teamOption in teams" :key="teamOption.key" class = "btn" :class = "teamColours(teamOption.livery).button">{{teamOption.name}}</button>
					</div>
					<span class="form-text text-muted">Pick your team</span>
				</div>
			</div>
			<div class="form-group row">
				<label class="col-4 col-form-label">Names</label> 
				<div class="col-8">
					<input v-for = "name in names" v-model="name.value" :key="name.key" type="text" required="required" class="form-control">
					<span class="form-text text-muted">Pick {{game.namesPerPerson}} names</span>
				</div>
			</div>
			<div class="form-group row">
				<div class="offset-2 col-10">
					<button @click = "saveNames" class="btn btn-primary">Save Names</button>
					<span class="form-text text-muted">{{names.filter(name=>name.value!="").length}} names saved</span>
				</div>
			</div>
		</li>
	`
})

Vue.component('witb-player',{
	props: ['player'],
	inject:['teams','teamColours'],
	template: `
		  <li class="list-group-item" :class="teamColours(teams[player.team].livery).li">
			<span class = "title">{{player.name}}</span>
			<span class="badge badge-primary badge-pill">{{player.numberOfNames}}</span>
		  </li>
	`
})

var app = new Vue({
	el: '#app',
	data: {
		profile: {ready:false,id:0,name:'',url:'',token:''},
		socket: null,
		messages: [],
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
		},
		sendMessage(eventType,eventDetail){
			this.socket.send(JSON.stringify({
				action:"sendmessage",
				data:{
					eventType:eventType,
					eventDetail:eventDetail
				}
			}));
		}
	},
	provide: function(){
		return {
			profile: this.profile,
			listenFor: this.listenFor,
			sendMessage: this.sendMessage,
			teams: [
				{name:"1",livery:"primary",key:0},
				{name:"2",livery:"success",key:1},
				{name:"3",livery:"danger",key:2},
				{name:"4",livery:"warning",key:3}
			],
			teamColours: (livery)=>({
				li:`list-group-item-${livery}`,
				button:`btn-${livery}`,
				card:`border-${livery}`,
				badge:`badge-${livery}`,
				progress:`bg-${livery}`
			})
			
		}
	},
	created: function(){
		this.socket = new WebSocket(window.config.socketGatewayUrl + window.config.socketGatewayPath)
		this.listenFor("*",(data)=>{
			this.messages.unshift(data.eventType)
			if(this.messages.length > 3) this.messages.pop()
			else {
				setTimeout(()=>{
					if(this.messages) this.messages.pop()
				},2000)
			}
		})
	},
	template: `
		<div class = "container">
			<google-login @userReady = "userReady"></google-login>
			<witb-container></witb-container>
			<span class = "badge badge-pill badge-primary" v-for = "message in messages">
				{{message.substring(0,1)}}		
			</span><br>
			<span class = "badge badge-pill badge-info">
				{{revision}}:{{version}}		
			</span>
		</div>
	`
})	
