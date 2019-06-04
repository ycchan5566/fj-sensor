var dgram = require('dgram');
var net = require('net');

var server = {
	address: "139.162.87.174",
	port: 6310//6312
};

exports.create = function(settings){
	return new function(){
		// default function
		if(typeof(settings.getWarning) != "function"){
			settings.getWarning = function(){};
		}
		if(typeof(settings.connectionStatusChanged) != "function"){
			settings.connectionStatusChanged = function(){};
		}

		// public function
		this.getUdpSocket = function(){
			return udpSocket;
		};

		this.stopAllThread = function(){
			clearTimeout(registerTimeoutThread);
			clearTimeout(keepServerAliveThread);
			clearTimeout(checkPeerThread);

			for(var directionIndex = 0, directions = ["outgoing", "incoming"]; directionIndex < directions.length; directionIndex++){
				var direction = directions[directionIndex];

				for(var peerIndex = 0; peerIndex < peers[direction].length; peerIndex++){
					if(!peers[direction][peerIndex]){continue;}

					clearTimeout(peers[direction][peerIndex].punchTimeoutThread);
					clearTimeout(peers[direction][peerIndex].keepAliveThread);
					for(var i = 0; i < peers[direction][peerIndex].startPunchThreads.length; i++){
						clearTimeout(peers[direction][peerIndex].startPunchThreads[i]);
					}
				}
			}
		};

		var portOpened = false;// udp port is open

		var peers = {
			"outgoing": new Array(settings.outgoingAmount),
			"incoming": new Array(settings.incomingAmount)
		};
		var connected = false;// there are peer connected

		var isRoot = settings.roomIndex != undefined ? true : false;
		var broadcast = {};
		var lastBroadcastTime = (new Date()).getTime();// Isolated node testing

		var registered = false;
		var registerTimeoutThread = null;

		var keepServerAliveThread = null;
		var checkPeerThread = null;

		var list = [];

		var myKey = (function(){
		    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
		    var key = chars.charAt(Math.floor(Math.random() * chars.length));

			chars += "0123456789";

		    for( var i = 0; i < 15; i++){
		        key += chars.charAt(Math.floor(Math.random() * chars.length));
			}

		    return key;
		})();

		var send = function(connection, msg, cb) {
			var data = new Buffer(JSON.stringify(msg));

			if(!(connection.port > 0 && connection.port < 65536)){
				return;
			}

			udpSocket.send(data, 0, data.length, connection.port, connection.address, function(error, bytes) {
				if (error) {
					console.log('! stopped due to error: %s', error);
					//udpSocket.close();
				}
				else {
					if (cb){
						cb();
					}
				}
			});
		}

		var getNetworkIP = function(callback) {
			console.log('# try to get the internal ip and port');

			var socket = net.createConnection(6311, server.address);

			socket.on('connect', function() {
				callback(undefined, socket.address().address);
				socket.destroy();
			});

			socket.on('error', function(e) {
				callback(e, 'error');
				socket.destroy();
			});
		}

		var keepServerAlive = function(){
			var connection = {
				port: udpSocket.address().port
			};

			getNetworkIP(function(error, ip) {
				if (error){
					console.log("! unable to obtain connection information!");

					registered = false;
					settings.connectionStatusChanged(portOpened, registered, connected);

					// try again after 30 seconds
					keepServerAliveThread = setTimeout(function(){
						keepServerAlive();
					}, 30 * 1000);
				}
				else{
					connection.address = ip;
					console.log('# listening on %s:%s', connection.address, connection.port);

					console.log('# start register to the server');
					send(server, {
						type: 'register',
						source: myKey,
						connection: connection,
						roomIndex: settings.roomIndex,
						isRoot: isRoot
					});

					// register timeout(10 seconds)
					registerTimeoutThread = setTimeout(function(){
						console.log('# register timeout');

						registerTimeoutThread = null;
						registered = false;
						settings.connectionStatusChanged(portOpened, registered, connected);

						keepServerAlive();
					}, 10 * 1000);
				}
			});
		};

		var keepPeerAlive = function(peer){
			if (!peer.status/* || peer.lastAliveTime == null*/){
				return;
			}

			// clear previous thread
			clearTimeout(peer.keepAliveThread);

			//console.log('# sent ping to %s', peer.key);
			send(peer.connection, {
				type: 'ping',
				source: myKey,
				target: peer.key
			});

			peer.keepAliveThread = setTimeout(function(){
				keepPeerAlive(peer);
			}, 60 * 1000);
		};

		var peerConnected = function(peer){
			console.log("# connect to %s success", peer.key);

			peer.lastAliveTime = (new Date()).getTime();
			clearTimeout(peer.punchTimeoutThread);
			peer.punchTimeoutThread = null;

			peer.keepAliveThread = setTimeout(function(){
				keepPeerAlive(peer);
			}, 60 * 1000);

			connected = true;
			settings.connectionStatusChanged(portOpened, registered, connected);
		};

		var checkPeer = function(){
			var timestamp = (new Date()).getTime();

			// isolate check
			if((timestamp - lastBroadcastTime) / 1000 > 90){// Maybe me is a isolate peer, kick all outgoing(maybe include incoming) peer and connect to others
				console.log('# detected isolate, kick all not punching outgoing peer');

				for(var peerIndex = 0; peerIndex < peers.outgoing.length; peerIndex++){
					if(peers.outgoing[peerIndex] && peers.outgoing[peerIndex].lastAliveTime != null/*not punching*/){
						removePeer(peers.outgoing[peerIndex].key);
					}
				}

				lastBroadcastTime = timestamp;
			}

			// alive check
			var findAlivePeer = false;
			for(var directionIndex = 0, directions = ["outgoing", "incoming"]; directionIndex < directions.length; directionIndex++){
				var direction = directions[directionIndex];

				for(var peerIndex = 0; peerIndex < peers[direction].length; peerIndex++){
					if(peers[direction][peerIndex] && peers[direction][peerIndex].lastAliveTime != null/*not punching*/){
						if((timestamp - peers[direction][peerIndex].lastAliveTime) / 1000 > 90){
							console.log('# peer %s disconnect', peers[direction][peerIndex].key);

							removePeer(peers[direction][peerIndex].key);
						}
						else{
							findAlivePeer = true;
						}
					}
				}
			}

			connected = findAlivePeer;
			settings.connectionStatusChanged(portOpened, registered, connected);

			if(registered == true){
				connectPeers();
			}

			checkPeerThread = setTimeout(function(){
				checkPeer();
			}, 10 * 1000);
		};

		var connectPeers = function(){
			for(var peerIndex = 0; peerIndex < peers.outgoing.length; peerIndex++){
				// find a empty space
				if(!peers.outgoing[peerIndex]){
					while(list[0]){
						if(list[0] != myKey && !peers[list[0]]){
							var peer = createPeer();
							peer.key = list[0];
							peer.index = peerIndex;
							peer.direction = "outgoing";

							// punch timeout
							(function(peer){// callback in loop
								peer.punchTimeoutThread = setTimeout(function(){
									if (!peer.status){
										return;
									}

									console.log('# connect to %s failed, punch timeout', peer.key);

									removePeer(peer.key);
								}, 10 * 1000);
							})(peer);

							// add to outgoing peers
							peers.outgoing[peerIndex] = peer;
							peers[list[0]] = peer;

							// request server send connect command to peer
							console.log('# send connect request to %s to the server', list[0]);
							send(server, {
								type: 'challenge',
								source: myKey,
								target: list[0]
							});

							list.shift();
							break;
						}
						else{
							list.shift();
						}
					}
				}
			}
		};

		var startPunch = function(peer, fn) {
			if (!peer.status || peer.ouch){
				return;
			}

			fn();

			var pid = setTimeout(function() {
				startPunch(peer, fn);
			}, 1000);

			peer.startPunchThreads.push(pid);
		};

		var createPeer = function(){
			return {
				status: true,
				//key: data.peer.key,
				//index: peerIndex,
				punch: false,
				ouch: false,
				lastAliveTime: null,
				connection: {},

				// thread pid
				punchTimeoutThread: null,
				keepAliveThread: null,
				startPunchThreads: []
			};
		};

		var removePeer = function(peerKey){
			peers[peerKey].status = false;
			delete peers[peers[peerKey].direction][peers[peerKey].index];
			delete peers[peerKey];
		};

		var udpSocket = dgram.createSocket('udp4');

		udpSocket.on("listening", function() {
			portOpened = true;
			settings.connectionStatusChanged(portOpened, registered, connected);

			keepServerAlive();

			// delay start checkPeer();
			checkPeerThread = setTimeout(function(){
				checkPeer();
			}, 3 * 1000);
		});

		udpSocket.on('message', function(data, connection) {
			try {
				data = JSON.parse(data);
			}
			catch (e) {
				console.log('! couldn\'t parse data(%s):\n%s', e, data);
				return;
			}

			if (data.type == 'ack') {// the response of command "register"
				if(registerTimeoutThread == null){return;}

				console.log("# receive ack from server, register is success");

				roomIndex = data.roomIndex;

				// random the peer list
				for(var index = 0, temp; index < data.peers.length; index++){
					var randomIndex = Math.floor((Math.random() * data.peers.length));
					temp = data.peers[index];
					data.peers[index] = data.peers[randomIndex];
					data.peers[randomIndex] = temp;
				}
				list = data.peers;

				clearTimeout(registerTimeoutThread);
				registerTimeoutThread = null
				registered = true;
				settings.connectionStatusChanged(portOpened, registered, connected);

				keepServerAliveThread = setTimeout(function(){
					keepServerAlive();
				}, 60 * 1000);
			}
			else if (data.type == 'fight') {
				//console.log('# receive fight the peer %s from the server', data.peer.key);

				if(!peers[data.peer.key] || (peers[data.peer.key] && peers[data.peer.key].punchTimeoutThread == null)){
					if(peers[data.peer.key]){
						removePeer(data.peer.key);
					}

					// find a empty space
					for(var peerIndex = 0; peerIndex < peers.incoming.length; peerIndex++){
						if(!peers.incoming[peerIndex]){
							break;
						}
					}

					if(peerIndex < peers.incoming.length){// found a empty space
						var peer = createPeer();
						peer.key = data.peer.key;
						peer.index = peerIndex;
						peer.direction = "incoming";

						// punch timeout
						peer.punchTimeoutThread = setTimeout(function(){
							if (!peer.status){
								return;
							}

							console.log('# connect to %s failed, punch timeout', data.peer.key);

							removePeer(peer.key);
						}, 10 * 1000);

						// add to peers
						peers.incoming[peerIndex] = peer;
						peers[data.peer.key] = peer;
					}
					else{
						console.log('# peer number reach maximum amount');
						return;
					}
				}

				// punch data
				var punch = {
					type: 'punch',
					source: myKey,
					target: data.peer.key
				};

				// punch the internal address
				//console.log('# send punch to %s@%s:%s', data.peer.key, data.peer.internal.address, data.peer.internal.port);
				startPunch(peers[data.peer.key], function(){
					send(data.peer.internal, punch);
				});

				// punch the internal external
				//console.log('# send punch to %s@%s:%s', data.peer.key, data.peer.external.address, data.peer.external.port);
				startPunch(peers[data.peer.key], function(){
					send(data.peer.external, punch);
				});
			}
			else if (data.type == 'punch'/* && data.target == myKey*/ && peers[data.source] && !peers[data.source].punch) {
				//console.log("# receive punch from %s", data.source);

				peers[data.source].punch = true;

				send(connection, {
					type: 'ouch',
					source: myKey,
					target: data.source
				});

				if(peers[data.source].ouch == true){
					peerConnected(peers[data.source]);
				}
			}
			else if (data.type == 'ouch'/* && data.target == myKey*/ && peers[data.source] && !peers[data.source].ouch) {
				//console.log("# receive ouch from %s", data.source);

				peers[data.source].ouch = true;
				peers[data.source].connection = connection;

				if(peers[data.source].punch == true){
					peerConnected(peers[data.source]);
				}
			}
			else if (data.type == 'ping' && peers[data.source]) {
				//console.log("# receive ping from %s", data.source);

				send(peers[data.source].connection, {
					type: 'pong',
					source: myKey,
					target: data.source
				});
			}
			else if (data.type == 'pong' && peers[data.source]) {
				//console.log("# receive pong from %s", data.source);

				peers[data.source].lastAliveTime = (new Date()).getTime();
			}
			else if (data.type == 'broadcast') {
				if(typeof(broadcast[data.messageType]) == "undefined"){
					broadcast[data.messageType] = {
						timestamp: null
					};
				}

				if(!broadcast[data.messageType][data.messageTimestamp]){// Prevent broadcast loop
					broadcast[data.messageType][data.messageTimestamp] = true;

					// Send to everybody
					for(var directionIndex = 0, directions = ["outgoing", "incoming"]; directionIndex < directions.length; directionIndex++){
						var direction = directions[directionIndex];

						for(var peerIndex = 0; peerIndex < peers[direction].length; peerIndex++){
							if(!peers[direction][peerIndex] || peers[direction][peerIndex].key == data.source || peers[direction][peerIndex].lastAliveTime == null){continue;}

							send(peers[direction][peerIndex].connection, {
								type: data.type,
								source: myKey,
								target: peers[direction][peerIndex].key,

								messageType: data.messageType,
								messageTimestamp: data.messageTimestamp,
								messageContent: data.messageContent
							});
						}
					}

					console.log('> %s: %s [from %s@%s:%s]', data.messageType, data.messageContent, data.source, connection.address, connection.port);

					if(data.messageType == "warning"){
						if(data.messageTimestamp > broadcast.warning.timestamp){// Prevent get old message, only show new message
							settings.getWarning(data.messageContent);
						}

						broadcast.warning.timestamp = data.messageTimestamp;
					}

					lastBroadcastTime = (new Date()).getTime();
				}
			}
		});

		udpSocket.on('close', function(err){
			console.log("# close");
		});

		udpSocket.on('error', function(err){
			if(err.code == "EADDRINUSE"){
				console.log("! error occurs, the port is inuse.");

				portOpened = false;
				settings.connectionStatusChanged(portOpened, registered, connected);
			}
			else{
				console.log("! error occurs.");
			}

			//udpSocket.close();
		});

		if(settings.portNumber <= 0){
			udpSocket.bind();
		}
		else{
			udpSocket.bind(settings.portNumber);
		}

//		process.stdin.on('readable', function(data) {
//			var str = String.fromCharCode.apply(this, process.stdin.read()).replace(/(\r\n|\n|\r)/gm, "");
//
//			if(str == "peers"){
//				process.stdout.write("Outgoing: \n");
//				for(var peerIndex = 0; peerIndex < peers.outgoing.length; peerIndex++){
//					if(peers.outgoing[peerIndex]){
//						process.stdout.write(peers.outgoing[peerIndex].key + ", " + (peers.outgoing[peerIndex].lastAliveTime == null ? "Punching" : "Connected") + ", " + peers.outgoing[peerIndex].status + "\n");
//					}
//					else{
//						process.stdout.write("-\n");
//					}
//				}
//				process.stdout.write("\n");
//
//				process.stdout.write("Incoming: \n");
//				for(var peerIndex = 0; peerIndex < peers.incoming.length; peerIndex++){
//					if(peers.incoming[peerIndex]){
//						process.stdout.write(peers.incoming[peerIndex].key + ", " + (peers.incoming[peerIndex].lastAliveTime == null ? "Punching" : "Connected") + ", " + peers.incoming[peerIndex].status + "\n");
//					}
//					else{
//						process.stdout.write("-\n");
//					}
//				}
//				process.stdout.write("\n");
//			}
//			else if(str){
//				console.log(peers[str]);
//			}
//		});

		console.log('# peer key is %s', myKey);
	};
};

