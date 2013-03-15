/*
 * Flushes stats to Leftronic (https://www.leftronic.com/).
 *
 * To enable this backend, include 'statsd-leftronic-backend' in the
 * backends configuration array:
 *
 *   backends: ['statsd-leftronic-backend']
 *
 * The backend will read the configuration options from the following
 * 'leftronic' hash defined in the main statsd config file:
 *
 *  leftronic : {
 *    key : Access key of your Leftronic account (req'd)
 *  }
 */

var util = require('util');

function LeftronicBackend(startupTime, config, emitter){
  var self = this;
  this.lastFlush = startupTime;
  this.lastException = startupTime;
  this.config = config.leftronic || {};

  this.statsCache = {
    counters: {},
    timers: {}
  };

  this.client = require('leftronic-request').createClient(this.config.key);

  // attach
  emitter.on('flush', function(timestamp, metrics) { self.flush(timestamp, metrics); });
  emitter.on('status', function(callback) { self.status(callback); });
};

LeftronicBackend.prototype.flush = function(timestamp, metrics) {
  var self = this;
  console.log('Flushing stats at', new Date(timestamp * 1000).toString());

  // merge with previously sent values
  Object.keys(self.statsCache).forEach(function(type) {
    if(!metrics[type]) return;
    Object.keys(metrics[type]).forEach(function(name) {
      var value = metrics[type][name];
      self.statsCache[type][name] || (self.statsCache[type][name] = 0);
      self.statsCache[type][name] += value;
    });
  });

  var out = {
    counters: this.statsCache.counters,
    timers: this.statsCache.timers,
    gauges: metrics.gauges,
    timer_data: metrics.timer_data,
    counter_rates: metrics.counter_rates,
    sets: function (vals) {
      var ret = {};
      for (val in vals) {
        ret[val] = vals[val].values();
      }
      return ret;
    }(metrics.sets),
    pctThreshold: metrics.pctThreshold
  };

/*
  if(this.config.prettyprint) {
    console.log(util.inspect(out, false, 5, true));
  } else {
    console.log(out);
  }
*/

  var data = {
    streams: []
  }

  var globalPrefix = self.config.globalPrefix ? self.config.globalPrefix : 'stats';

  for(var i in out) {
    if(out.hasOwnProperty(i)) {
      if(i === 'gauges') {
        for(var j in out[i]) {
          if(out.hasOwnProperty(i)) {
            data.streams.push({
              streamName: globalPrefix + '.' + i + '.' + j,
              point: out[i][j]
            });
          }
        }
      } else if(i === 'counters') {
        for(var j in out[i]) {
          if(out.hasOwnProperty(i)) {
            data.streams.push({
              streamName: globalPrefix + '.' + i + '.' + j + '.count',
              point: out[i][j]
            });
          }
        }
      } else if(i === 'counter_rates') {
        for(var j in out[i]) {
          if(out.hasOwnProperty(i)) {
            data.streams.push({
              streamName: globalPrefix + '.counters.' + j + '.rate',
              point: out[i][j]
            });
          }
        }
      }
    }
  }
  self.client.sendData(data, function(err, res, body) {
    console.log(err || body);
  })

};

LeftronicBackend.prototype.status = function(write) {
  ['lastFlush', 'lastException'].forEach(function(key) {
    write(null, 'leftronic', key, this[key]);
  }, this);
};

exports.init = function(startupTime, config, events) {
  if(typeof config.leftronic.key !== 'string') {
    util.log("Error: Missing config.leftronic.key");
    return false;
  }

  var instance = new LeftronicBackend(startupTime, config, events);
  return true;
};
