const Rsync = require('rsync');

/* **** */

/**
 * Create a chainable function on the Rsync prototype for getting and setting an
 * internal value.
 * @param {String} name
 * @param {String} internal
 */
function createValueAccessor(name, internal) {
	var container = internal || '_' + name;

	Rsync.prototype[name] = function (value) {
		if (!arguments.length) return this[container];
		this[container] = value;
		return this;
	};
}

/**
 * @param {String} name
 * @param {String} internal
 */
function createListAccessor(name, internal) {
	var container = internal || '_' + name;

	Rsync.prototype[name] = function (value) {
		if (!arguments.length) return this[container];

		if (isArray(value)) {
			value.forEach(this[name], this);
		}
		else if (typeof (value) !== 'string') {
			throw new Error('Value for Rsync::' + name + ' must be a String');
		}
		else if (this[container].indexOf(value) < 0) {
			this[container].push(value);
		}

		return this;
	};
}

/**
 * Create a shorthand method on the Rsync prototype for setting and unsetting a simple option.
 * @param {String} option
 * @param {String} name
 */
function exposeShortOption(option, name) {
	name = name || option;

	Rsync.prototype[name] = function (set) {
		// When no arguments are passed in assume the option
		// needs to be set
		if (!arguments.length) set = true;

		var method = (set) ? 'set' : 'unset';
		return this[method](option);
	};
}

/**
 * Create a function for an option that can be set multiple time. The option
 * will accumulate all values.
 *
 * @param {String} option
 * @param {[String]} name
 */
function exposeMultiOption(option, name) {
	name = name || option;

	Rsync.prototype[name] = function (value) {
		// When not arguments are passed in assume the options
		// current value is requested
		if (!arguments.length) return this.option(option);

		if (!value) {
			// Unset the option on falsy
			this.unset(option);
		}
		else if (isArray(value)) {
			// Call this method for each array value
			value.forEach(this[name], this);
		}
		else {
			// Add the value
			var current = this.option(option);
			if (!current) {
				value = [value];
			}
			else if (!isArray(current)) {
				value = [current, value];
			}
			else {
				value = current.concat(value);
			}

			this.set(option, value);
		}

		return this;
	};
}

/**
 * Expose an rsync long option on the Rsync prototype.
 * @param {String} option   The option to expose
 * @param {String} name     An optional alternative name for the option.
 */
function exposeLongOption(option, name) {
	name = name || option;

	Rsync.prototype[name] = function (value) {
		// When not arguments are passed in assume the options
		// current value is requested
		if (!arguments.length) return this.option(option);

		var method = (value) ? 'set' : 'unset';
		return this[method](option, value);
	};
}

/**
 * Build an option for use in a shell command.
 *
 * @param {String} name
 * @param {String} value
 * @param {Function|boolean} escapeArg
 * @return {String}
 */
function buildOption(name, value, escapeArg) {
	if (typeof escapeArg === 'boolean') {
		escapeArg = (!escapeArg) ? noop : null;
	}

	if (typeof escapeArg !== 'function') {
		escapeArg = escapeShellArg;
	}

	// Detect single option key
	var single = (name.length === 1) ? true : false;

	// Decide on prefix and value glue
	var prefix = (single) ? '-' : '--';
	var glue = (single) ? ' ' : '=';

	// Build the option
	var option = prefix + name;
	if (arguments.length > 1 && value) {
		value = escapeArg(String(value));
		option += glue + value;
	}

	return option;
}

/**
 * Escape an argument for use in a shell command when necessary.
 * @param {String} arg
 * @return {String}
 */
function escapeShellArg(arg) {
	if (!/(["'`\\$ ])/.test(arg)) {
		return arg;
	}
	return '"' + arg.replace(/(["'`\\$])/g, '\\$1') + '"';
}

/**
 * Escape a filename for use in a shell command.
 * @param {String} filename the filename to escape
 * @return {String} the escaped version of the filename
 */
function escapeFileArg(filename) {
	filename = filename.replace(/(["'`\s\\\(\)\\$])/g, '\\$1');
	if (!/(\\\\)/.test(filename)) {
		return filename;
	}
	// Under Windows rsync (with cygwin) and OpenSSH for Windows
	// (http://www.mls-software.com/opensshd.html) are using 
	// standard linux directory separator so need to replace it
	if ('win32' === process.platform) {
		filename = filename.replace(/\\\\/g, '/').replace(/^["]?[A-Z]\:\//ig, '/');
	}
	return filename;
}

/**
 * Strip the leading dashes from a value.
 * @param {String} value
 * @return {String}
 */
function stripLeadingDashes(value) {
	if (typeof (value) === 'string') {
		value = value.replace(/^[\-]*/, '');
	}

	return value;
}

/**
 * Simple function for checking if a value is an Array. Will use the native
 * Array.isArray method if available.
 * @private
 * @param {Mixed} value
 * @return {Boolean}
 */
function isArray(value) {
	if (typeof (Array.isArray) === 'function') {
		return Array.isArray(value);
	}
	else {
		return toString.call(value) == '[object Array]';
	}
}

/**
 * Simple hasOwnProperty wrapper. This will call hasOwnProperty on the obj
 * through the Object prototype.
 * @private
 * @param {Object} obj  The object to check the property on
 * @param {String} key  The name of the property to check
 * @return {Boolean}
 */
function hasOP(obj, key) {
	return Object.prototype.hasOwnProperty.call(obj, key);
}

function noop() { }
var removeDuplicate = (x, theChar) => {
	let tt = [...x];
	var old = "";
	var newS = "";
	for (var a = 0; a < tt.length; a++) {
		old = tt[a - 1] || '';
		if (tt[a] == theChar) {
			newS = tt[a] + "";
		} else {
			newS = null;
		}
		if (old == newS) {
			tt.splice(a, 1);
		}
	}
	return tt.join("");
}
/**
 * Simple debug printer.
 *
 * @private
 * @param {Rsync} cmd
 * @param {String} message
 */
function debug(cmd, message) {
	if (!cmd._debug) return;
}


Rsync.prototype.args = function () {
	// Gathered arguments
	var args = [];

	// Add options. Short options (one letter) without values are gathered together.
	// Long options have a value but can also be a single letter.
	var short = [];
	var long = [];

	// Split long and short options
	for (var key in this._options) {
		if (hasOP(this._options, key)) {
			var value = this._options[key];
			var noval = (value === null || value === undefined);

			// Check for short option (single letter without value)
			if (key.length === 1 && noval) {
				short.push(key);
			}
			else {
				if (isArray(value)) {
					value.forEach(function (val) {
						long.push(buildOption(key, val, escapeShellArg));
					});
				}
				else {
					long.push(buildOption(key, value, escapeShellArg));
				}
			}

		}
	}

	// Add combined short options if any are present
	if (short.length > 0) {
		args.push('-' + short.join(''));
	}

	// Add long options if any are present
	if (long.length > 0) {
		args = args.concat(long);
	}

	// Add includes/excludes in order
	this._patterns.forEach(function (def) {
		if (def.action === '-') {
			args.push(buildOption('exclude', def.pattern, escapeFileArg));
		}
		else if (def.action === '+') {
			args.push(buildOption('include', def.pattern, escapeFileArg));
		}
		else {
			debug(this, 'Unknown pattern action ' + def.action);
		}
	});
	// Add sources
	if (this.source().length > 0) {
		args = args.concat(this.source().map(function (x) {
			/* If use windows as source */
			let tt = x.replace('wsl\\$', 'wsl$');
			if (tt.includes('wsl$') == true) {
				tt = tt.replace('wsl$', '');
				var gg = new RegExp("\\\\", 'g');
				tt = tt.replace(gg, '/');
				gg = new RegExp("//", 'g');
				tt = tt.replace(gg, '/');
				tt = '//wsl$/' + tt;
			} else {
				// Remove depan dulu
				tt = tt.replace('/','');
				// Remove duplicate \\ to /
				var gg = new RegExp("\\\\", 'g');
				tt = tt.replace(gg, '/');
				// Remove duplicate // to /
				gg = new RegExp("//", 'g');
				tt = tt.replace(gg, '/');
				// Change windows path :\\\\ to /
				gg = new RegExp(":\\\\", 'g');
				tt = tt.replace(gg,'/');
				// Change windows path :/ to /
				gg = new RegExp(":/", 'g');
				tt = tt.replace(gg, '/');
				// Add front to / again;
				tt = '/'+tt;
			}
			return tt;
		}));
	}
	// Add destination
	if (this.destination()) {
		/* If use wsl as target */
		args.push((() => {
			let tt = this.destination().replace('wsl\\$', 'wsl$');
			if (tt.includes('wsl$') == true) {
				tt = tt.replace('wsl$', '');
				var gg = new RegExp("\\\\", 'g');
				tt = tt.replace(gg, '/');
				gg = new RegExp("//", 'g');
				tt = tt.replace(gg, '/');
				tt = '//wsl$/' + tt;
			} else {
				// Remove depan dulu
				tt = tt.replace('/','');
				// Remove duplicate \\ to /
				var gg = new RegExp("\\\\", 'g');
				tt = tt.replace(gg, '/');
				// Remove duplicate // to /
				gg = new RegExp("//", 'g');
				tt = tt.replace(gg, '/');
				// Change windows path :\\\\ to /
				gg = new RegExp(":\\\\", 'g');
				tt = tt.replace(gg,'/');
				// Change windows path :/ to /
				gg = new RegExp(":/", 'g');
				tt = tt.replace(gg, '/');
				// Add front to / again;
				tt = '/'+tt;
			}
			return tt;
		})());
	}
	return args;
};

export default Rsync;