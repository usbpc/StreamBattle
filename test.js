var username = $('#username')
var health = $('#health');
var bar = $('#bar');
var bartext = $('#bartext');

var url = new URL(document.URL);

var apiKey = url.searchParams.get('api');
var apiName = url.searchParams.get('username');

var state = new State();

var loaded = false;
var gotEarly = [];
var ids = new Set();

var socket = io('https://sso-cf.tipeeestream.com');
socket.emit('join-room', {room: apiKey, username: apiName});
socket.on('new-event', function(data){
	if (loaded) {
		processEvent(data.event, true);
	} else {
		gotEarly.push(data.event);
	}
	console.log(data)
});

state.display();
getOldData(0);

function State(username = 'usbpc', maxHealth = 500, currHealth = 333) {
	this.username = username;
	this.maxHealth = maxHealth;
	this.currHealth = currHealth;

	this.hit = function(user, hit) {
		var newHealth = this.currHealth - hit;
		if (newHealth <= 0) {
			return new State(user, 500-newHealth, 500-newHealth);
		}
		return new State(this.username, this.maxHealth, newHealth);
	};
	this.heal = function(amount) {
		return new State(this.username, this.maxHealth, Math.min(this.maxHealth, this.currHealth + amount));
	};
	this.display = function() {
		$('#username').text(this.username);
		$('#health').text(`${this.currHealth}/${this.maxHealth}`);
		$('#bar').css({width: this.getHealthBarWidth()});
	};
	this.getHealthBarWidth = function() {
		return `${100 - this.currHealth / this.maxHealth * 100}%`;
	}
}

function processEvent(event, animate) {
	var username = event.parameters.username;
	var amount;
	var message;

	switch(event.type) {
		case 'superchat':
			amount = event.parameters.amount * 100;
			message = `(-${amount}) ${username}'s Superchat`;
			break;
		case 'donation':
			amount = event.parameters.amount * 100;
			message = `(-${amount}) ${username}'s Donation`;
			break;
		case 'subscription': 
			amount = 500;
			message = `(-${amount}) ${username}'s VIP`;
			break;
		case 'follow': 
			amount = 50;
			message = `(-${amount}) ${username}'s Subscription`;
			break;
	}

	var newState;
	if (state.username == username) {
		newState = state.heal(amount);
		message = `(+${amount}) ${username} healed!`;
	} else {
		newState = state.hit(username, amount);
	}
	if (animate) {
		animateChanges(newState, state, message);
	}
	state = newState;
}

function getOldData(offset) {
	var limit = 500;
	var params = {
		type: ['donation', 'superchat', 'follow', 'subscription'],
		apiKey: apiKey,
		order: 'asc',
		limit: limit,
		offset: offset
	};
	$.getJSON(`https://api.tipeeestream.com/v1.0/events.json?${$.param(params)}`, function(data){
		for (var key in data.datas.items) {
			var event = data.datas.items[key];
			ids.add(event.id);
			processEvent(event, false);
		}
		if (data.datas.items.length >= limit) {
			getOldData(offset + limit);
		} else {
			for (var key in gotEarly) {
				var event = gotEarly[key];
				if (!ids.has(event.id)) {
					processEvent(event);
				}
			}
			loaded = true;
			gotEarly = null;
			ids = null;
			animateChanges(state, new State(), "");
		}
	});
}

function animateChanges(newState, oldState, message) {
	if (newState.username != oldState.username) {
		bar.animate({width: '100%'}, {duration:5000, start:function(){
			health.text(`0/${oldState.maxHealth}`);
		}});
		username.delay(5000);
		username.slideUp(function(){username.text(newState.username)});
		username.slideDown(function(){
			health.text(`${newState.currHealth}/${newState.maxHealth}`);
		});
		bar.delay(2*400);
		bar.animate({width: newState.getHealthBarWidth()});
		username.delay(400);
	} else {
		bar.animate({width: newState.getHealthBarWidth()}, {duration:2000, start:function(){
			bartext.text(message).fadeIn(1000).fadeOut(1000);
			health.text(`${newState.currHealth}/${newState.maxHealth}`);
		}});
		username.delay(2000);
	}
}
