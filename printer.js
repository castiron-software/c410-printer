var Job = require('./job');
var spawn = require('child_process').spawn;
var spawnSync = require('sync-exec');
var utils = require('util');
var events = require('events');
utils.inherits(Printer, events.EventEmitter);

/**
 * Describes the parameter options accepted by lp
 *
 * options array specifies the valid option names for the option
 * if expects is blank '' no option value is required for the option
 *
 * This was written according to lp man page
 * http://unixhelp.ed.ac.uk/CGI/man-cgi?lp
 */
var generalOptions = {
	'E': {
		'options': ['E', 'encryption'],
		'description': 'Forces encryption when connecting to the server',
		'expects': '',
		'default': false
	},
	'U': {
		'options': ['U', 'Username', 'username'],
		'description': 'Specifies the username to use when connecting to the server',
		'expects': 'string'
	},
	'c': {
		'options': ['c', 'backwardsCompatibility'],
		'description': 'This option is provided for backwards-compatibility only. On systems  that	support	 it,  this  option forces the print file to be copied to the spool directory before  printing. In CUPS, print files  are always sent to the scheduler via IPP which has the same effect.',
		'expects': '',
		'default': false
	},
	'd': {
		'options': ['d', 'destination'],
		'description': 'Prints files to the named printer',
		'expects': 'string'
	},
	'h': {
		'options': ['h', 'hostname'],
		'description': 'Chooses an alternate server',
		'expects': 'string'
	},
	'i': {
		'options': ['i', 'job-id'],
		'description': 'Specifies an existing job to modify',
		'expects': 'number'
	},
	'm': {
		'options': ['m'],
		'description': 'Sends an email when the job is completed',
		'expects': ''
	},
	'n': {
		'options': ['n', 'copies', 'numCopies'],
		'description': 'Sets the number of copies to print from 1 to 100',
		'expects': 'number',
		'default': 1
	},
	'o': {
		'options': ['o'],
		'description': '"name=value [name=value ...]" Sets one or more job options',
		'expects': 'string',
		'default': ''
	},
	'q': {
		'options': ['q', 'priority'],
		'description': 'Sets the job priority from	1 (lowest) to 100 (highest). The default priority is 50',
		'expects': 'number',
		'default': 1
	},
	's': {
		'options': ['s'],
		'description': 'Do not report the resulting job IDs (silent mode.)',
		'expects': ''
	},
	't': {
		'options': ['t', 'name'],
		'description': 'Sets the job name',
		'expects': 'string'
	},
	'H': {
		'options': ['H', 'when'],
		'description': 'Specifies  when  the  job  should be printed. A value of immediate will print the file immediately, a value of hold will hold the job indefinitely, and a time value (HH:MM) will hold the job until the specified time. Use a value of resume with the -i option to resume a  held job.  Use a value of restart with the -i option to restart a completed job.',
		'default': 'immediate',
		'expects': 'string'

	},
	'P': {
		'options': ['P', 'page-list'],
		'description': 'page-list Specifies which pages to print in the document. The list can  contain a list of numbers and ranges (#-#) separated by commas (e.g. 1,3-5,16).',
		'expects': 'string'
	}
};

/**
 * Describes the parameter options accepted by lp -o option
 *
 * options array specifies the valid option names for the option
 * if expects is blank '' no option value is required for the option
 *
 * This was written according to lp man page
 * http://unixhelp.ed.ac.uk/CGI/man-cgi?lp
 */
var oOptions = {
	'media': {
		'options': ['media'],
		'description': 'Sets  the  page  size  to size. Most printers support at least the size names "a4", "letter", and "legal".',
		'expects': 'string',
		'default': 'a4'
	},
	'landscape': {
		'options': ['landscape'],
		'description': 'landscape',
		'expects': ''
	},
	'orientation-requested': {
		'options': ['orientation-requested'],
		'description': '',
		'expects': 'number'
	},
	'sides': {
		'options': ['sides'],
		'description': 'Prints on one or two sides of the  paper.  The  value  "two-sided-long-edge" is  normally  used  when printing portrait (unrotated) pages, while "two-sided-short-edge" is used for landscape pages.',
		'expects': 'string'
	},
	'fitplot': {
		'options': ['fitplot'],
		'description': 'Scales the print file to fit on the page',
		'expects': '',
		'default': false
	},
	'scaling': {
		'options': ['scaling'],
		'description': 'Scales image files to use up to number percent of the page. Values greater than 100 cause the image file to be printed across multiple pages',
		'expects': 'number'
	},
	'cpi': {
		'options': ['cpi'],
		'description': 'Sets the number of characters per inch to use when printing a text file. The default is 10',
		'default': 10,
		'expects': 'number'
	},
	'lpi': {
		'options': ['lpi'],
		'description': 'Sets  the  number  of  lines  per inch to use when printing a text file. The default is 6',
		'default': 6,
		'expects': 'number'
	},
	'page-bottom': {
		'options': ['page-bottom'],
		'description': 'Sets the page margins when printing text files. The values are in points - there are 72 points to the inch',
		'expects': 'number'
	},
	'page-left': {
		'options': ['page-left'],
		'description': 'Sets the page margins when printing text files. The values are in points - there are 72 points to the inch',
		'expects': 'number'
	},
	'page-right': {
		'options': ['page-right'],
		'description': 'Sets the page margins when printing text files. The values are in points - there are 72 points to the inch',
		'expects': 'number'
	},
	'page-top': {
		'options': ['page-top'],
		'description': 'Sets the page margins when printing text files. The values are in points - there are 72 points to the inch',
		'expects': 'number'
	}
};


var forIn = function (obj, callback) {
	if (typeof obj !== "object") {
		return;
	}
	var keys = Object.keys(obj);
	for (var i = 0; i < keys.length; i++) {
		callback(obj[keys[i]], keys[i]);
	}
}
var hasValues = function (obj) {
	return (typeof obj === "object") && Object.keys(obj).length === 0;
}


var optionsFactory = function (options) {

	var selGeneralOptions = {};

	forIn(generalOptions, function (generalOption, generalOptionId) { // for each of lp available options
		forIn(generalOption.options, function (option) { // for each option possible name
			if (typeof options[option] !== 'undefined') { // check of the method options contains the value
				if (generalOption.expects === '') { // when expects is empty, ommit the options defined value, just add
					if (options[option]) {
						selGeneralOptions[generalOptionId] = true;
					}
				} else {
					selGeneralOptions[generalOptionId] = options[option];
				}
			}
		});
		if (typeof generalOption.default !== 'undefined') { // if method options does not contains the value, use default if available
			if (typeof selGeneralOptions[generalOptionId] === 'undefined') {
				selGeneralOptions[generalOptionId] = generalOption.default;
			}
		}
	});

	var selOOptions = {};

	forIn(oOptions, function (oOption, oOptionId) { // for each of lp available options
		forIn(oOption.options, function (option) { // for each option possible name
			if (typeof options[option] !== 'undefined') { // check of the method options contains the value
				if (oOption.expects === '') { // when `expects` is '', we just mark this option as true
					if (options[option]) {
						selOOptions[oOptionId] = true;
					}
				} else {
					selOOptions[oOptionId] = options[option];
				}
			} else if (typeof oOption.default !== 'undefined') { // if method options does not contains the value, use
				// default if available
				selOOptions[oOptionId] = oOption.default;
			}
		});
		if (typeof oOption.default !== 'undefined') { // if method options does not contains the value, use default
			// if available
			if (typeof selOOptions[oOptionId] === 'undefined') {
				selOOptions[oOptionId] = oOption.default;
			}
		}
	});

	if (hasValues(selOOptions)) {
		var selOoptionsString = '';
		forIn(selOOptions, function (oOption, oOptionId) {
			if (oOptions[oOptionId].expects === '') {
				if (oOption) {
					selOoptionsString = selOoptionsString + ' ' + oOptionId;
				}
			} else {
				selOoptionsString = selOoptionsString + ' ' + oOptionId + '=' + oOption;
			}
		});
		if (typeof selGeneralOptions.o === 'string') {
			selGeneralOptions.o = selGeneralOptions.o + selOoptionsString;
		} else {
			selGeneralOptions.o = selOoptionsString;
		}
	}

	return selGeneralOptions;
};

var argsFactory = function (options) {
	var args = [];
	forIn(options, function (optionValue, optionKey) {
		if (generalOptions[optionKey].expects === '') {
			if (optionValue) {
				args.push('-' + optionKey);
			}
		} else {
			args.push('-' + optionKey + optionValue);
		}

	});
	return args;
};

var buildArgs = function (options) {
	if (!options) return [];
	options = optionsFactory(options);
	return argsFactory(options);
};

var parseStdout = function (data) {
	if (!data) return [];
	return data.toString()
		.replace(/\n$/, '')
		.split('\n');
};

function Printer(name, options) {
	var self = this;
	if (!Printer.match(name, options)) {
		console.error(
			name + ' printer does not exist ; installed printers are ' + Printer.list(options)
		);
		throw new Error('Printer ' + name + ' does not exist on your system.');
	}
	self.name = name;
	self.jobs = [];
	self.watch();
}

Printer.list = function (options) {
	// Simple supports for .h option to lpstat.
	let args = '-p';
	if (options !== undefined && options.h) {
		args = `-h ${options.h} ${args}`;
	}

	const lpstatCommand = `lpstat ${args}`;
	console.debug(lpstatCommand);
	return parseStdout(spawnSync(lpstatCommand).stdout)
		.filter(function (line) {
			return (line.match(/^printer/) || line.match(/^impressora/));
		})
		.map(function (printer) {
			return (printer.match(/(?: \S+)/)[0].trim());
		});
};

Printer.match = function (name, options) {
	return Boolean(Printer.list(options).filter(function (printer) {
		return name === printer;
	}).length);
};

Printer.prototype.destroy = function () {
	var self = this;
	self.lpq.removeAllListeners();
	self.lpq.kill();
	self.jobs.forEach(function(job){
		job.removeAllListeners();
	})
}

Printer.prototype.watch = function (options) {
	var self = this;
	var args = ['-P', this.name];

	if (options !== undefined && options.h) {
		args.push('-h', options.h);
	}

	var lpq = spawn('lpq', args);
	self.lpq = lpq;

	lpq.stdout.on('data', function (data) {
		data = parseStdout(data);
		data.shift();
		data.shift();

		data = data.map(function (line) {
			line = line.split(/ +/);
			return {
				rank: (line[0] === 'active' ? line[0] : parseInt(line[0].slice(0, -2))),
				owner: line[1],
				identifier: parseInt(line[2]),
				files: line[3],
				totalSize: parseInt(line[4])
			};
		});
		self.jobs.map(function (job) {
			var status = data.filter(function (status) {
				if (status.identifier === job.identifier) return status;
			})[0];

			if (status) {
				job.update(status);
			} else {
				job.unqueue();
			}
		});
	});

	lpq.on('exit', function () {
		self.watch();
	});
};

Printer.prototype.findJob = function (jobId) {
	return this.jobs.filter(function (job) {
		if (job.identifier === jobId) return job;
	})[0];
};

const spawnLp = (printer, options) => {
	var args = buildArgs(options);

	args.push('-d', printer.name);

	var lp = spawn('lp', args);
	
	return lp;
};

const getLpJob = (printer, lp) => {
	lp.stdin.end()

	var job = new Job(lp);
	job.on('sent', function () {
		printer.jobs.push(job);
	});

	job.on('completed', function () {
		printer.jobs.splice(printer.jobs.indexOf(job), 1);
	});

	return job;
}

Printer.prototype.printBuffer = function (data, options) {
	let lp = spawnLp(this, options);

	lp.stdin.write(data);
	
	let job = getLpJob(this, lp);
	
	return job;
};

Printer.prototype.printBuffers = function (buffers, options) {
	let lp = spawnLp(this, options);

	buffers.forEach(buffer => {
		lp.stdin.write(' ');
		lp.stdin.write(buffer);
	});
	
	let job = getLpJob(this, lp);
	
	return job;
};

Printer.prototype.printFile = function (filePath, options) {
	var self = this;
	var args = buildArgs(options);
	args.push('-d', self.name);

	args.push('--');
	args.push(filePath);

	var lp = spawn('lp', args);

	var job = new Job(lp);
	job.on('sent', function () {
		self.jobs.push(job);
	});

	job.on('completed', function () {
		self.jobs.splice(self.jobs.indexOf(job), 1);
	});

	return job;
};

module.exports = Printer;
