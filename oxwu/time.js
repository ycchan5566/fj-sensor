var Sntp = require('sntp');
var os = require('os');

var options = {
    host: 'tw.pool.ntp.org',
    port: 123,
    timeout: 10000
};

var pid = null;
var t0 = Date.now();
var b0 = os.uptime() * 1000;

var sync = function(callback){
	Sntp.time(options, function (err, time) {
		callback(err);

		if (err) {
			if(t0 == null){// Never success get current time from SNTP server
				// Use local time
				t0 = Date.now();
				b0 = os.uptime() * 1000;// The uptime() return in seconds
			}

			// Retry 10 seconds later
			pid = setTimeout(function(){
				sync(callback);
			}, 10000);
	    }
		else{
			t0 = Date.now() + time.t;
			b0 = os.uptime() * 1000;

			// Update 60 mins later
			pid = setTimeout(function(){
				sync(callback);
			}, 3600000);
		}
	});
};

exports.start = function(callback){
	if(typeof(callback) == "undefined"){
		callback = function(){};
	}

	sync(callback);
};

exports.stop = function(){
	clearTimeout(pid);
}

exports.now = function(){
	var b1 = os.uptime() * 1000;
	var t1 = (b1 - b0) + t0;

	return t1;
};