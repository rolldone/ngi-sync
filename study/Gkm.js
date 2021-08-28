var gkm = require('gkm');

// Listen to all key events (pressed, released, typed)
gkm.events.on('key.*', function(data) {
    console.log(this.event + ' ' + data);
});

// Listen to all mouse events (click, pressed, released, moved, dragged)
gkm.events.on('mouse.*', function(data) {
	console.log(this.event + ' ' + data);
});