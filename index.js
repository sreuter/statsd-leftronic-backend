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

  this.client = require('leftronic-request').createClient(this.config.key);

  // attach
  emitter.on('flush', function(timestamp, metrics) { self.flush(timestamp, metrics); });
  emitter.on('status', function(callback) { self.status(callback); });
};

LeftronicBackend.prototype.flush = function(timestamp, metrics) {
  var self = this;
  console.log('Flushing stats at', new Date(timestamp * 1000).toString());

/*
  if(this.config.prettyprint) {
    console.log(util.inspect(metrics, false, 5, true));
  } else {
    console.log(metrics);
  }
*/

  // We have to split streams into seperate post requests as the
  // Leftronic API only allows 32 streams in one single post.

  // Prepare function to extend data object and return post_counter;

  function extend_post_data(stream_counter, stream_limit, metrics) {
    var post_count = Math.floor(stream_count/stream_limit);
    if(! data[post_count]) {
      data[post_count] = {
        streams: []
      };
    }
    return(post_count);
  }

  var data = [];

  var stream_count = 0,
      stream_limit = 32;

  var globalPrefix = self.config.globalPrefix ? self.config.globalPrefix : 'stats';

  for(var i in metrics) {
    if(metrics.hasOwnProperty(i)) {
      if(i === 'gauges') {
        for(var j in metrics[i]) {
          if(metrics[i].hasOwnProperty(j)) {
            var post_count = extend_post_data(stream_count, stream_limit, data);
            data[post_count].streams.push({
              streamName: globalPrefix + '.' + i + '.' + j,
              point: metrics[i][j]
            });
            stream_count +=1;
          }
        }
      } else if(i === 'counters') {
        for(var j in metrics[i]) {
          if(metrics[i].hasOwnProperty(j)) {
            var post_count = extend_post_data(stream_count, stream_limit, data);
            data[post_count].streams.push({
              streamName: globalPrefix + '.' + i + '.' + j + '.count',
              point: metrics[i][j]
            });
            stream_count += 1;
          }
        }
      } else if(i === 'counter_rates') {
        for(var j in metrics[i]) {
          if(metrics[i].hasOwnProperty(j)) {
            var post_count = extend_post_data(stream_count, stream_limit, data);
            data[post_count].streams.push({
              streamName: globalPrefix + '.counters.' + j + '.rate',
              point: metrics[i][j]
            });
            stream_count += 1;
          }
        }
      }
    }
  }

  var data_send_count = 0;

  (function send_data() {
    if(data.length > 0) {
      console.log('Sending POST data (' + (data_send_count + 1) + '/' + data.length + ') ...');
      console.log(util.inspect(data, false, 5, true));
      self.client.sendData(data[data_send_count], function(err, res, body) {
        console.log(err || body);
        data_send_count += 1;

        if(data.length > data_send_count) {
          send_data();
        }

      });
    }
  }());

};

LeftronicBackend.prototype.status = function(write) {
  ['lastFlush', 'lastException'].forEach(function(key) {
    write(null, 'leftronic', key, this[key]);
  }, this);
};

exports.init = function(startupTime, config, events) {
  if(typeof config.leftronic.key !== 'string') {
    util.log('Error: Missing config.leftronic.key');
    return false;
  }

  var instance = new LeftronicBackend(startupTime, config, events);
  return true;
};
