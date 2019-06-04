var dgram = require('dgram');
var udpServer = dgram.createSocket('udp4');
var peer = require('./peer');

var udpPort = 6310;//6312
var rooms = [];

var messagePool = {};

var send = function(connection, msg, cb) {
	var data = new Buffer(JSON.stringify(msg));

	udpServer.send(data, 0, data.length, connection.port, connection.address, function(error, bytes) {
		if (error) {
			console.log('# stopped due to error: %s', error);
		}
		else {
			if (cb){
				cb();
			}
		}
	});
};

var peerAliveCheck = function(){
	var timestamp = (new Date()).getTime();

	for(var roomIndex = 0; roomIndex < rooms.length; roomIndex++){
		for(var key in rooms[roomIndex]){
			if(rooms[roomIndex][key].lastActiveTime == null){continue;}

			if((timestamp - rooms[roomIndex][key].lastActiveTime) / 1000 > 90){
				console.log('# peer %s disconnect', key);
				delete rooms[roomIndex][key];
				delete rooms[key];
			}
		}
	}

	setTimeout(function(){
		peerAliveCheck();
	}, 10 * 1000);
};

var broadcast = function(type/*warning, report, alive*/, message){
	var timestamp = (new Date()).getTime();
	for(var roomIndex = 0; roomIndex < rooms.length; roomIndex++){
		if(rooms[roomIndex] == undefined){continue;}

		for(var key in rooms[roomIndex]){
			if(rooms[roomIndex][key].isRoot == true){
				console.log("# send broadcast %s message to %s in room No.%s", type, key, roomIndex);

				send(rooms[key].external, {
					type: "broadcast",
					source: null,
					target: key,

					messageType: type,
					messageTimestamp: timestamp,
					messageContent: message
				});
			}
		}
	}
};

var time = require('./time');
time.start();

udpServer.on('listening', function() {
	var address = udpServer.address();
	console.log('# listening [%s:%s]', address.address, address.port);
	peerAliveCheck();

	// Prevent isolated peer
	setInterval(function(){
		broadcast("alive", "");
	}, 60 * 1000);
});

udpServer.on('message', function(data, connection) {
	try {
		data = JSON.parse(data);
	}
	catch (e) {
		return console.log('! Couldn\'t parse data (%s):\n%s', e, data);
	}

	if (data.type == 'register') {
		console.log('# receive register from %s@[%s:%s | %s:%s]', data.source, connection.address, connection.port, data.connection.address, data.connection.port);
		//console.log('# %s request enter room No.%s', data.source, data.roomIndex);

		if(!rooms[data.source]){
			if(data.roomIndex != undefined){
				var roomIndex = data.roomIndex;
			}
			else{
				for(var roomIndex = 0; roomIndex < rooms.length; roomIndex++){
					if(rooms[roomIndex] == undefined || Object.keys(rooms[roomIndex]).length < 100){
						break;
					}
				}
			}

			if(rooms[roomIndex] == undefined){// room not exist
				//console.log('# create room No.%s', roomIndex);

				// create new room
				rooms[roomIndex] = {};
				peer.create({
					portNumber: 0,
					outgoingAmount: 10,
					incomingAmount: 15,
					roomIndex: roomIndex
				});

				peer.create({
					portNumber: 0,
					outgoingAmount: 10,
					incomingAmount: 15,
					roomIndex: roomIndex
				});

				peer.create({
					portNumber: 0,
					outgoingAmount: 10,
					incomingAmount: 15,
					roomIndex: roomIndex
				});
			}

			// add to this room
			rooms[roomIndex][data.source] = {
				key: data.source,
				lastActiveTime: (new Date()).getTime(),
				internal: data.connection,//local
				external: connection,//public
				roomIndex: roomIndex,
				isRoot: data.isRoot
			};

			// create peer key reference
			rooms[data.source] = rooms[roomIndex][data.source];

			console.log('# assign peer %s to room No.%s', data.source, roomIndex);

			setTimeout(function(){
				send(connection, {
					type: 'ack',
					roomIndex: roomIndex,
					peers: Object.keys(rooms[rooms[data.source].roomIndex])
				});
			}, 1000);
		}
		else{
			var roomIndex = rooms[data.source].roomIndex;

			// update connection information
			rooms[data.source].lastActiveTime = (new Date()).getTime();
			rooms[data.source].internal = data.connection;
			rooms[data.source].external = connection;

			send(connection, {
				type: 'ack',
				roomIndex: roomIndex,
				peers: Object.keys(rooms[rooms[data.source].roomIndex])
			});
		}
	}
	else if (data.type == 'challenge') {
		//console.log('# receive challenge from %s to %s', data.source, data.target);

		if(!(rooms[data.source] && rooms[data.target])){
			//console.log('! peer key not found')
			return;
		}

		send(rooms[data.source].external, {
			type: 'fight',
			peer: rooms[data.target]
		});

		send(rooms[data.target].external, {
			type: 'fight',
			peer: rooms[data.source]
		});
	}
});

udpServer.on('error', function(err){
	console.log("! error occurs.");
});

udpServer.bind(udpPort);

// HTTP Server
var fs = require('fs');
var net = require('net');
var url = require('url');
var http = require('http');
var httpPort = 6311;

var httpServer = http.createServer(function(request, response){
	var parse = url.parse(request.url, true);
	var pathname = parse.pathname;
	var query = parse.query;

	if(pathname == "/warning"){
		var offset = 8;
	    var localDate = new Date(parseInt(query.time, 10));
	    var utcDate = localDate.getTime() + (localDate.getTimezoneOffset() * 60000);
	    var date = new Date(utcDate + (3600000 * offset));

		var dateString = date.getFullYear() + "-" + paddingZero(date.getMonth() + 1, 2) + "-" + paddingZero(date.getDate(), 2) + "T" + paddingZero(date.getHours(), 2) + ":" + paddingZero(date.getMinutes(), 2) + ":" + paddingZero(date.getSeconds(), 2) + "+08:00";
		var message = dateString + "," + toFixed(parseFloat(query.lat), 2) + "," + toFixed(parseFloat(query.lon), 2) + "," + toFixed(parseFloat(query.depth), 1) + "," + toFixed(parseFloat(query.magnitude), 1);

		// Prevent broadcast duplicate messages
		var isBroadcasted = false;
		if(messagePool[message] != true){
			broadcast("warning", message);

			messagePool[message] = true;
			isBroadcasted = true;

			// Send EEW to partner
			try{
				var client = new net.Socket();
				client.connect(55555, '114.33.249.130', function() {
					client.write(message);
					client.destroy();
				}).on('error', function(err){});
			}
			catch(err){}
		}

		// log
		var localDate = new Date(time.now());
		var utcDate = localDate.getTime() + (localDate.getTimezoneOffset() * 60000);
		var date = new Date(utcDate + (3600000 * offset));

		dateString = date.getFullYear() + "-" + paddingZero(date.getMonth() + 1, 2) + "-" + paddingZero(date.getDate(), 2) + "T" + paddingZero(date.getHours(), 2) + ":" + paddingZero(date.getMinutes(), 2) + ":" + paddingZero(date.getSeconds(), 2) + "+08:00";
		fs.appendFile("eew_log.csv", dateString + "," + message + "," + query.source + "," + (isBroadcasted ? "1" : "0") + "\n", function(err){});
	}
	else if(pathname == "/training"){
		var epicenterDepth = getRandomArbitrary(5, 20);//in km

		var offset = 8;
	    var localDate = new Date(time.now());
	    var utcDate = localDate.getTime() + (localDate.getTimezoneOffset() * 60000);
	    var date = new Date(utcDate + (3600000 * offset) - (epicenterDepth / 3.5 * 1000));

		var dateString = date.getFullYear() + "-" + paddingZero(date.getMonth() + 1, 2) + "-" + paddingZero(date.getDate(), 2) + "T" + paddingZero(date.getHours(), 2) + ":" + paddingZero(date.getMinutes(), 2) + ":" + paddingZero(date.getSeconds(), 2) + "+08:00";
		var message = dateString + "," + toFixed(getRandomArbitrary(22.6, 24.8), 2) + "," + toFixed(getRandomArbitrary(120.2, 121.7), 2) + "," + toFixed(epicenterDepth, 1) + "," + toFixed(getRandomArbitrary(4, 8), 1);

		broadcast("training", message);

		// log
		var localDate = new Date(time.now());
		var utcDate = localDate.getTime() + (localDate.getTimezoneOffset() * 60000);
		var date = new Date(utcDate + (3600000 * offset));

		dateString = date.getFullYear() + "-" + paddingZero(date.getMonth() + 1, 2) + "-" + paddingZero(date.getDate(), 2) + "T" + paddingZero(date.getHours(), 2) + ":" + paddingZero(date.getMinutes(), 2) + ":" + paddingZero(date.getSeconds(), 2) + "+08:00";
		fs.appendFile("eew_training_log.csv", dateString + "," + message + "\n", function(err){});
	}
	else if(pathname == "/online"){
		var counter = 0;
		for(var roomIndex = 0; roomIndex < rooms.length; roomIndex++){
			if(rooms[roomIndex] == undefined){continue;}

			for(var key in rooms[roomIndex]){
				if(rooms[roomIndex][key].isRoot != true){
					counter++;
				}
			}
		}

		response.writeHead(200, {"Content-Type": "text/plain"});
		response.write(counter.toString());
	}

	response.end();
});

httpServer.listen(httpPort);

// Utility
var paddingZero = function(number, digits) {
    return Array(Math.max(digits - String(number).length + 1, 0)).join(0) + number;
};

var toFixed = function(number, digits){
	return (Math.floor(number * Math.pow(10, digits)) / Math.pow(10, digits)).toFixed(digits);
};

var getRandomArbitrary = function(min, max) {
    return Math.random() * (max - min) + min;
};

/*
// Console
process.stdin.on('readable', function(data) {
	var str = String.fromCharCode.apply(this, process.stdin.read()).replace(/(\r\n|\n|\r)/gm, "");

	if(str == "warning"){

	}
	else if(str == "rooms"){
		console.log(rooms);
	}
});
*/