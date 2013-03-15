# StatsD Leftronic Metrics backend

## Overview

This is a pluggable backend for [StatsD](https://github.com/etsy/statsd/), which
publishes stats to the [Leftronic Dashboard API](https://www.leftronic.com/).

## Requirements

* An active [Leftronic Dashboard](https://www.leftronic.com/) account.

## Usage

To enable this backend, include 'statsd-leftronic-backend' in the
backends configuration array:

```javascript
  backends: ['statsd-leftronic-backend']
```

The backend will read the configuration options from the following
'leftronic' hash defined in the main statsd config file:

```javascript
 leftronic : {
   key : 'supersecretkey',   // (required)
   globalPrefix: 'myprefix'  // (optional, default to 'stats')
 }
 ```

## Limitation

* Only supports gauges and counters for now.
* Not battle-proven yet.
